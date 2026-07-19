import type { RecordStartPayload, Rect } from '../../shared/types'

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let microphoneStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let audioNodes: AudioNode[] = []
let chunks: Blob[] = []
let rafId: number | null = null
let video: HTMLVideoElement | null = null
let stopRequested = false

/** crop 이 지정되면 video → canvas 로 잘라낸 비디오 스트림을 만든다 */
async function buildCroppedVideoStream(source: MediaStream, crop: Rect, fps: number): Promise<MediaStream> {
  video = document.createElement('video')
  video.srcObject = source
  video.muted = true
  await video.play()

  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')!

  const draw = (): void => {
    ctx.drawImage(
      video!,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, crop.width, crop.height
    )
    rafId = requestAnimationFrame(draw)
  }
  draw()

  const cropped = canvas.captureStream(fps)
  return cropped
}

/** Windows 시스템 출력과 기본 마이크 입력을 하나의 오디오 트랙으로 믹싱한다. */
async function buildMixedStream(
  displaySource: MediaStream,
  microphone: MediaStream,
  crop: Rect | undefined,
  fps: number
): Promise<MediaStream> {
  const systemTracks = displaySource.getAudioTracks()
  const microphoneTracks = microphone.getAudioTracks()
  if (systemTracks.length === 0) {
    throw new Error('Windows 시스템 오디오 트랙을 가져오지 못했습니다.')
  }
  if (microphoneTracks.length === 0) {
    throw new Error('마이크 오디오 트랙을 가져오지 못했습니다.')
  }

  const videoStream = crop
    ? await buildCroppedVideoStream(displaySource, crop, fps)
    : new MediaStream(displaySource.getVideoTracks())

  audioContext = new AudioContext({ sampleRate: 48_000 })
  const destination = audioContext.createMediaStreamDestination()
  const compressor = audioContext.createDynamicsCompressor()
  compressor.threshold.value = -3
  compressor.knee.value = 6
  compressor.ratio.value = 12
  compressor.attack.value = 0.003
  compressor.release.value = 0.25
  compressor.connect(destination)

  const systemNode = audioContext.createMediaStreamSource(
    new MediaStream(systemTracks)
  )
  const microphoneNode = audioContext.createMediaStreamSource(
    new MediaStream(microphoneTracks)
  )
  systemNode.connect(compressor)
  microphoneNode.connect(compressor)
  audioNodes = [systemNode, microphoneNode, compressor, destination]
  await audioContext.resume()

  return new MediaStream([
    ...videoStream.getVideoTracks(),
    ...destination.stream.getAudioTracks()
  ])
}

function stopMediaStream(mediaStream: MediaStream | null): void {
  mediaStream?.getTracks().forEach((track) => track.stop())
}

async function closeAudioGraph(): Promise<void> {
  audioNodes.forEach((node) => node.disconnect())
  audioNodes = []
  if (audioContext && audioContext.state !== 'closed') await audioContext.close()
  audioContext = null
}

window.api.recorder.onStart(async ({ fps, crop }: RecordStartPayload) => {
  let displaySource: MediaStream | null = null
  try {
    stopRequested = false
    chunks = []
    // 메인 프로세스가 선택한 화면/창과 Windows 시스템 오디오(loopback)를 허용한다.
    displaySource = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        frameRate: { ideal: fps, max: fps }
      }
    })

    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      })
    } catch (error) {
      throw new Error(`기본 마이크 입력을 가져오지 못했습니다: ${String(error)}`)
    }

    // 영역 녹화면 비디오만 crop하고, 시스템 출력과 마이크는 항상 함께 믹싱한다.
    stream = await buildMixedStream(displaySource, microphoneStream, crop, fps)

    const mime = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? 'video/webm'
    recorder = new MediaRecorder(stream, { mimeType: mime })
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const buf = await blob.arrayBuffer()
      if (rafId !== null) cancelAnimationFrame(rafId)
      stopMediaStream(stream)
      stopMediaStream(displaySource)
      stopMediaStream(microphoneStream)
      microphoneStream = null
      await closeAudioGraph()
      window.api.recorder.save(buf)
    }
    recorder.start(1000) // 1초마다 청크 flush
    if (stopRequested && recorder.state !== 'inactive') recorder.stop()
  } catch (err) {
    stopMediaStream(stream)
    stopMediaStream(displaySource)
    stopMediaStream(microphoneStream)
    microphoneStream = null
    await closeAudioGraph()
    window.api.recorder.error(String(err))
  }
})

window.api.recorder.onStop(() => {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  else stopRequested = true
})
