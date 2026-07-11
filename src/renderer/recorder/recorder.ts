import type { RecordStartPayload, Rect } from '../../shared/types'

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []
let rafId: number | null = null
let video: HTMLVideoElement | null = null

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

  return canvas.captureStream(fps)
}

window.api.recorder.onStart(async ({ sourceId, fps, crop }: RecordStartPayload) => {
  try {
    chunks = []
    // Electron 데스크탑 캡쳐 제약 (표준 타입에 없어 any 캐스팅)
    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxFrameRate: fps
        }
      }
    } as unknown as MediaStreamConstraints

    const source = await navigator.mediaDevices.getUserMedia(constraints)
    // 영역 녹화면 canvas 로 crop, 아니면 원본 스트림 그대로
    stream = crop ? await buildCroppedStream(source, crop, fps) : source

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
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
  } catch (err) {
    window.api.recorder.error(String(err))
  }
})

window.api.recorder.onStop(() => {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
})
