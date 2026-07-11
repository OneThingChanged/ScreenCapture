import {
  desktopCapturer,
  screen,
  Notification,
  type Display,
  type NativeImage
} from 'electron'
import { saveImage, copyImageToClipboard, imageToDataUrl } from './storage'
import { getSettings } from './settings'
import {
  getMainWindow,
  notifyCaptureCompleted,
  openOverlayWindow,
  openPickerWindow
} from './windows'
import type {
  CaptureMode,
  OverlaySource,
  Rect,
  WindowSource
} from '../shared/types'
import { sourceForDisplay } from './displays'

/** 디스플레이의 물리 픽셀 해상도 (스크린샷 원본 크기) */
function physicalSize(display: Electron.Display): { width: number; height: number } {
  return {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor)
  }
}

/** 모든 screen 소스를 디스플레이별 full-resolution NativeImage 로 가져온다 */
export async function grabScreenSources(): Promise<
  { display: Electron.Display; image: NativeImage }[]
> {
  const displays = screen.getAllDisplays()
  // 가장 큰 디스플레이 기준으로 thumbnailSize 지정 (소스별 실제 크기는 자동 매칭됨)
  const max = displays.reduce(
    (acc, d) => {
      const s = physicalSize(d)
      return { width: Math.max(acc.width, s.width), height: Math.max(acc.height, s.height) }
    },
    { width: 0, height: 0 }
  )

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: max
  })

  return displays.flatMap((display) => {
    const source = sourceForDisplay(sources, display)
    return source ? [{ display, image: source.thumbnail }] : []
  })
}

/** 커서가 위치한 디스플레이의 전체 화면 캡쳐 */
export async function captureFullScreen(target?: Display): Promise<NativeImage | null> {
  const display = target ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const sources = await grabScreenSources()
  const match = sources.find((s) => s.display.id === display.id) ?? sources[0]
  return match ? match.image : null
}

/** 커서가 위치한 디스플레이에서 영역을 드래그 선택하여 캡쳐 */
export async function captureRegion(target?: Display): Promise<NativeImage | null> {
  const display = target ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const sources = await grabScreenSources()
  const match = sources.find((s) => s.display.id === display.id) ?? sources[0]
  if (!match) return null

  const fullImage = match.image
  const overlaySource: OverlaySource = {
    displayId: display.id,
    bounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    },
    scaleFactor: display.scaleFactor,
    thumbnailDataUrl: imageToDataUrl(fullImage)
  }

  // 자동 테스트: 디스플레이 중앙 200x150 DIP 영역을 강제 선택
  if (process.env.SELFTEST_RECT) {
    overlaySource.testRect = {
      x: Math.round(display.bounds.width / 2 - 100),
      y: Math.round(display.bounds.height / 2 - 75),
      width: 200,
      height: 150
    }
  }

  const result = await openOverlayWindow(overlaySource)
  if (result.cancelled || !result.rect) return null

  // DIP 선택 영역 → 물리 픽셀 crop 영역으로 변환
  const sf = display.scaleFactor
  const size = fullImage.getSize()
  const crop: Rect = {
    x: Math.round(result.rect.x * sf),
    y: Math.round(result.rect.y * sf),
    width: Math.round(result.rect.width * sf),
    height: Math.round(result.rect.height * sf)
  }
  // 이미지 경계로 클램프
  crop.x = Math.max(0, Math.min(crop.x, size.width - 1))
  crop.y = Math.max(0, Math.min(crop.y, size.height - 1))
  crop.width = Math.max(1, Math.min(crop.width, size.width - crop.x))
  crop.height = Math.max(1, Math.min(crop.height, size.height - crop.y))

  return fullImage.crop(crop)
}

/** 열린 창 목록을 picker 로 보여주고 선택된 창을 캡쳐 */
export async function captureWindow(): Promise<NativeImage | null> {
  const raw = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1920, height: 1080 }
  })
  // 빈 썸네일/제목 없는 항목 제외
  const valid = raw.filter(
    (s) => s.name && !s.thumbnail.isEmpty()
  )
  if (valid.length === 0) {
    new Notification({ title: '창 캡쳐', body: '캡쳐할 창을 찾지 못했습니다.' }).show()
    return null
  }

  const sources: WindowSource[] = valid.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: imageToDataUrl(s.thumbnail)
  }))

  // 자동 테스트: picker 없이 첫 창 선택
  if (process.env.SELFTEST_PICK) {
    return valid[0].thumbnail
  }

  const result = await openPickerWindow(sources)
  if (result.cancelled || !result.id) return null

  const chosen = valid.find((s) => s.id === result.id)
  return chosen ? chosen.thumbnail : null
}

/** 캡쳐 결과 이미지를 설정에 따라 저장/복사 처리 */
export async function handleCapturedImage(image: NativeImage, mode: CaptureMode): Promise<void> {
  const settings = getSettings()
  let savedPath: string | null = null

  if (settings.afterCapture === 'save' || settings.afterCapture === 'both') {
    savedPath = await saveImage(image)
  }
  if (settings.copyToClipboard) {
    copyImageToClipboard(image)
  }

  const openEditor =
    settings.afterCapture === 'editor' || settings.afterCapture === 'both'
  notifyCaptureCompleted({
    dataUrl: imageToDataUrl(image),
    savedPath,
    mode,
    openEditor,
    createdAt: Date.now()
  })

  // 편집기를 여는 경우 알림은 생략 (편집기 자체가 피드백)
  if (!openEditor) {
    new Notification({
      title: '화면 캡쳐 완료',
      body: savedPath
        ? `저장됨: ${savedPath}${settings.copyToClipboard ? ' · 클립보드 복사됨' : ''}`
        : '클립보드에 복사됨'
    }).show()
  }
}

/** 캡쳐 모드별 진입점 */
export async function startCapture(mode: CaptureMode): Promise<void> {
  // 단축키를 누른 바로 그 순간의 커서 모니터를 고정한다.
  const targetDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const main = getMainWindow()
  // 주 창은 화면에 그대로 유지하되, 우리 앱이 캡처 결과에 포함되지 않도록 한다.
  // Windows에서는 WDA_EXCLUDEFROMCAPTURE가 적용되어 창 뒤의 화면이 캡처된다.
  main?.setContentProtection(true)
  await new Promise((resolve) => setTimeout(resolve, 60))
  try {
    const image =
      mode === 'fullscreen'
        ? await captureFullScreen(targetDisplay)
        : mode === 'region'
          ? await captureRegion(targetDisplay)
          : await captureWindow()
    if (image) await handleCapturedImage(image, mode)
  } finally {
    if (main && !main.isDestroyed()) {
      main.setContentProtection(false)
    }
  }
}
