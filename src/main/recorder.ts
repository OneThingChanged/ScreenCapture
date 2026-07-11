import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  Notification
} from 'electron'
import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import ffmpegStatic from 'ffmpeg-static'
import {
  IPC,
  type RecordStartPayload,
  type RecordMode,
  type Rect,
  type OverlaySource,
  type WindowSource
} from '../shared/types'

// 패키징(asar) 환경에서는 바이너리가 app.asar.unpacked 에 위치
const ffmpegPath = ffmpegStatic
  ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
  : null
import { getSettings } from './settings'
import { saveBuffer } from './storage'
import {
  preloadPath,
  loadRoute,
  openOverlayWindow,
  openPickerWindow,
  openFramesWindow
} from './windows'

let recorderWin: BrowserWindow | null = null
let recording = false
const stateListeners: ((recording: boolean) => void)[] = []

export function setRecorderStateListener(cb: (r: boolean) => void): void {
  stateListeners.push(cb)
}

export function isRecording(): boolean {
  return recording
}

function setRecording(value: boolean): void {
  recording = value
  for (const cb of stateListeners) cb(value)
}

/** 디스플레이의 물리 픽셀 해상도 */
function physicalSize(display: Electron.Display): { width: number; height: number } {
  return {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor)
  }
}

/** 녹화 대상 결정 결과 */
interface RecordTarget {
  sourceId: string
  crop?: Rect
}

/** 영역 녹화: 커서 화면의 freeze 위에서 영역을 드래그 선택 → screen source + crop(물리px) */
async function resolveRegionTarget(): Promise<RecordTarget | null> {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: physicalSize(display)
  })
  const source =
    sources.find((s) => String(display.id) === s.display_id) ?? sources[0]
  if (!source) return null

  const overlaySource: OverlaySource = {
    displayId: display.id,
    bounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    },
    scaleFactor: display.scaleFactor,
    thumbnailDataUrl: source.thumbnail.toDataURL()
  }
  const result = await openOverlayWindow(overlaySource)
  if (result.cancelled || !result.rect) return null

  const sf = display.scaleFactor
  const size = source.thumbnail.getSize()
  const crop: Rect = {
    x: Math.max(0, Math.round(result.rect.x * sf)),
    y: Math.max(0, Math.round(result.rect.y * sf)),
    width: Math.round(result.rect.width * sf),
    height: Math.round(result.rect.height * sf)
  }
  // 짝수 보정(인코더 호환) + 경계 클램프
  crop.width = Math.max(2, Math.min(crop.width, size.width - crop.x)) & ~1
  crop.height = Math.max(2, Math.min(crop.height, size.height - crop.y)) & ~1
  return { sourceId: source.id, crop }
}

/** 창 녹화: 열린 창 picker 로 선택 → window source */
async function resolveWindowTarget(): Promise<RecordTarget | null> {
  const raw = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1920, height: 1080 }
  })
  const valid = raw.filter((s) => s.name && !s.thumbnail.isEmpty())
  if (valid.length === 0) {
    new Notification({ title: '창 녹화', body: '녹화할 창을 찾지 못했습니다.' }).show()
    return null
  }
  const sources: WindowSource[] = valid.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.toDataURL()
  }))
  const result = await openPickerWindow(sources)
  if (result.cancelled || !result.id) return null
  return { sourceId: result.id }
}

/** 전체화면 녹화: 커서가 있는 화면 전체 */
async function resolveFullscreenTarget(): Promise<RecordTarget | null> {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const sources = await desktopCapturer.getSources({ types: ['screen'] })
  const source =
    sources.find((s) => String(display.id) === s.display_id) ?? sources[0]
  return source ? { sourceId: source.id } : null
}

/** 확정된 대상(sourceId+crop)으로 숨은 recorder 렌더러를 띄워 녹화 시작 */
function startWithTarget(target: RecordTarget): void {
  if (recording) return
  recorderWin = new BrowserWindow({
    show: false,
    webPreferences: { preload: preloadPath, sandbox: false }
  })
  const payload: RecordStartPayload = {
    sourceId: target.sourceId,
    fps: getSettings().recordFps,
    crop: target.crop
  }
  recorderWin.webContents.on('did-finish-load', () => {
    recorderWin?.webContents.send(IPC.recordStart, payload)
  })
  loadRoute(recorderWin, 'recorder')
  setRecording(true)
  new Notification({ title: '녹화 시작', body: '다시 누르면 녹화가 종료됩니다.' }).show()
}

/** 녹화 시작 (모드별 대상 선택 → 숨은 recorder 렌더러로 위임) */
async function startRecording(mode: RecordMode): Promise<void> {
  if (recording) return

  const target =
    mode === 'region'
      ? await resolveRegionTarget()
      : mode === 'window'
        ? await resolveWindowTarget()
        : await resolveFullscreenTarget()

  if (!target) {
    // 사용자가 취소했거나 대상을 못 찾음 → 조용히 종료
    return
  }
  startWithTarget(target)
}

/**
 * 프레임 윈도우가 지정한 영역(절대 DIP 좌표)을 녹화 시작.
 * 영역이 걸친 디스플레이의 전체화면 스트림을 물리 픽셀로 crop 한다.
 */
export async function startFrameRegionRecording(absRect: Rect): Promise<void> {
  if (recording) return
  const display = screen.getDisplayMatching(absRect)
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: physicalSize(display)
  })
  const source =
    sources.find((s) => String(display.id) === s.display_id) ?? sources[0]
  if (!source) {
    new Notification({ title: '녹화', body: '녹화할 화면을 찾지 못했습니다.' }).show()
    return
  }
  const sf = display.scaleFactor
  const size = source.thumbnail.getSize()
  const crop: Rect = {
    x: Math.max(0, Math.round((absRect.x - display.bounds.x) * sf)),
    y: Math.max(0, Math.round((absRect.y - display.bounds.y) * sf)),
    width: Math.round(absRect.width * sf),
    height: Math.round(absRect.height * sf)
  }
  crop.width = Math.max(2, Math.min(crop.width, size.width - crop.x)) & ~1
  crop.height = Math.max(2, Math.min(crop.height, size.height - crop.y)) & ~1
  startWithTarget({ sourceId: source.id, crop })
}

/** 외부(프레임 윈도우 등)에서 녹화를 정지시킨다 */
export function stopRecordingExternal(): void {
  stopRecording()
}

/** 녹화 정지 요청 */
function stopRecording(): void {
  if (!recording || !recorderWin) return
  recorderWin.webContents.send(IPC.recordStop)
}

export function toggleRecording(mode: RecordMode = 'fullscreen'): void {
  if (recording) stopRecording()
  else void startRecording(mode)
}

/** webm → mp4/gif 변환 (ffmpeg). 변환 결과 경로 반환 */
function convert(input: string, output: string, format: 'mp4' | 'gif'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg 없음'))
    const args =
      format === 'mp4'
        ? ['-y', '-i', input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]
        : ['-y', '-i', input, '-vf', 'fps=12,scale=720:-1:flags=lanczos', output]
    const ps = spawn(ffmpegPath, args)
    ps.on('error', reject)
    ps.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))))
  })
}

/** IPC 등록 (recorder 렌더러로부터 결과 수신) */
export function registerRecorderIpc(): void {
  ipcMain.on(IPC.recordSave, async (_e, buffer: ArrayBuffer) => {
    const settings = getSettings()
    try {
      const webmPath = await saveBuffer(Buffer.from(buffer), 'Recording', 'webm')
      const produced: string[] = []

      // 선택된 포맷으로 각각 변환
      const targets: ('mp4' | 'gif')[] = []
      if (settings.exportMp4) targets.push('mp4')
      if (settings.exportGif) targets.push('gif')

      for (const fmt of targets) {
        const out = webmPath.replace(/\.webm$/, `.${fmt}`)
        try {
          await convert(webmPath, out, fmt)
          produced.push(out)
        } catch (err) {
          console.error(`[recorder] ${fmt} 변환 실패:`, err)
        }
      }

      // 원본 WebM: 유지 설정이거나 변환 결과가 하나도 없으면 남긴다
      if (settings.keepWebm || produced.length === 0) {
        produced.unshift(webmPath)
      } else {
        await rm(webmPath, { force: true })
      }

      const primary = produced[0]
      new Notification({
        title: '녹화 완료',
        body:
          produced.length > 1
            ? `${produced.length}개 파일 저장됨: ${primary}`
            : `저장됨: ${primary}`
      }).show()

      // 영상이 만들어졌으면 프레임 추출 창을 바로 열어준다
      if (primary) openFramesWindow(primary)

      if (process.env.RECORD_SELFTEST) {
        console.log('[selftest] recording saved:', primary)
        setTimeout(() => app.quit(), 200)
      }
    } catch (err) {
      console.error('[recorder] 저장 실패:', err)
      new Notification({ title: '녹화 오류', body: String(err) }).show()
    } finally {
      setRecording(false)
      recorderWin?.close()
      recorderWin = null
    }
  })

  ipcMain.on(IPC.recordState, (_e, state: { error?: string }) => {
    if (state.error) {
      console.error('[recorder] 렌더러 오류:', state.error)
      new Notification({ title: '녹화 오류', body: state.error }).show()
      setRecording(false)
      recorderWin?.close()
      recorderWin = null
    }
  })
}
