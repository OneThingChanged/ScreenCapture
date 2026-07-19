import type { RecordStartPayload, Rect } from '../../shared/types'

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []
let rafId: number | null = null
let video: HTMLVideoElement | null = null
let stopRequested = false

/** crop 이 지정되면 video → canvas 로 잘라낸 스트림을 만든다 */
async function buildCroppedStream(source: MediaStream, crop: Rect, fps: number): Promise<MediaStream> {
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
  source.getAudioTracks().forEach((track) => cropped.addTrack(track))
  return cropped
}

window.api.recorder.onStart(async ({ fps, crop }: RecordStartPayload) => {
  try {
    stopRequested = false
    chunks = []
    // 메인 프로세스가 선택한 화면/창과 Windows 시스템 오디오(loopback)를 허용한다.
    const source = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        frameRate: { ideal: fps, max: fps }
      }
    })
    if (source.getAudioTracks().length === 0) {
      source.getTracks().forEach((track) => track.stop())
      throw new Error('Windows 시스템 오디오 트랙을 가져오지 못했습니다.')
    }

    // 영역 녹화면 canvas 로 crop, 아니면 원본 스트림 그대로
    stream = crop ? await buildCroppedStream(source, crop, fps) : source

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
      stream?.getTracks().forEach((t) => t.stop())
      source.getTracks().forEach((t) => t.stop())
      window.api.recorder.save(buf)
    }
    recorder.start(1000) // 1초마다 청크 flush
    if (stopRequested && recorder.state !== 'inactive') recorder.stop()
  } catch (err) {
    window.api.recorder.error(String(err))
  }
})

window.api.recorder.onStop(() => {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  else stopRequested = true
})
