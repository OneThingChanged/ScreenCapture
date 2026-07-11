import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import {
  IPC,
  type OverlaySource,
  type OverlayResult,
  type WindowSource,
  type PickerResult
} from '../shared/types'

const preloadPath = join(__dirname, '../preload/index.js')

/** 렌더러 라우트(html 엔트리)를 dev/prod 에 맞게 로드 */
function loadRoute(win: BrowserWindow, route: string): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(`${devUrl}/${route}/index.html`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${route}/index.html`))
  }
}

type PrimaryRoute = 'main' | 'editor' | 'settings' | 'frames' | 'compress'

let mainWin: BrowserWindow | null = null
let primaryRoute: PrimaryRoute = 'main'
let primaryNavigationId = 0

function ensureMainWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) return mainWin

  mainWin = new BrowserWindow({
    width: 420,
    height: 560,
    title: '화면 캡쳐',
    backgroundColor: '#1f2330',
    show: false,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    webPreferences: { preload: preloadPath, sandbox: false }
  })
  mainWin.setMenuBarVisibility(false)
  mainWin.on('closed', () => {
    mainWin = null
    primaryRoute = 'main'
  })
  return mainWin
}

/** 한 개의 주 창 안에서 도구 화면을 전환한다. */
function showPrimaryRoute(
  route: PrimaryRoute,
  options: {
    width: number
    height: number
    resizable: boolean
    onLoaded?: (win: BrowserWindow) => void
  }
): BrowserWindow {
  const win = ensureMainWindow()
  const navigationId = ++primaryNavigationId
  primaryRoute = route

  win.hide()
  win.setMinimumSize(0, 0)
  win.setResizable(options.resizable)
  win.setMaximizable(options.resizable)
  win.setFullScreenable(options.resizable)

  const display = screen.getDisplayMatching(win.getBounds())
  const width = Math.min(options.width, display.workAreaSize.width)
  const height = Math.min(options.height, display.workAreaSize.height)
  win.setBounds({
    x: Math.round(display.workArea.x + (display.workArea.width - width) / 2),
    y: Math.round(display.workArea.y + (display.workArea.height - height) / 2),
    width,
    height
  })

  if (options.resizable) {
    win.setMinimumSize(Math.min(640, width), Math.min(420, height))
  }

  win.webContents.once('did-finish-load', () => {
    if (navigationId !== primaryNavigationId || win.isDestroyed()) return
    options.onLoaded?.(win)
    win.show()
    win.focus()
  })
  loadRoute(win, route)
  return win
}

/** 메인 창을 연다. 다른 도구를 보고 있다면 그 화면을 그대로 포커스한다. */
export function openMainWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) {
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.show()
    mainWin.focus()
    return mainWin
  }
  return showMainDashboard()
}

/** 현재 주 창을 대시보드 화면으로 되돌린다. */
export function showMainDashboard(): BrowserWindow {
  return showPrimaryRoute('main', {
    width: 420,
    height: 560,
    resizable: false
  })
}

/** 메인 윈도우 핸들 (없으면 null) */
export function getMainWindow(): BrowserWindow | null {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null
}

export function isMainDashboard(): boolean {
  return primaryRoute === 'main'
}

let frameWin: BrowserWindow | null = null

/** 영역 녹화용 프레임(테두리) 윈도우를 연다 (이미 있으면 포커스) */
export function openRecordFrameWindow(): BrowserWindow {
  if (frameWin && !frameWin.isDestroyed()) {
    frameWin.show()
    frameWin.focus()
    return frameWin
  }
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const wa = display.workArea
  // 기본 크기: 작업영역의 60% (최대 960x600)
  const w = Math.min(960, Math.round(wa.width * 0.6))
  const h = Math.min(600, Math.round(wa.height * 0.6))

  frameWin = new BrowserWindow({
    x: Math.round(wa.x + (wa.width - w) / 2),
    y: Math.round(wa.y + (wa.height - h) / 2),
    width: w,
    height: h,
    minWidth: 160,
    minHeight: 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false, // 리사이즈는 렌더러 핸들로 직접 처리
    hasShadow: false,
    skipTaskbar: false,
    title: '녹화 영역',
    alwaysOnTop: true,
    webPreferences: { preload: preloadPath, sandbox: false }
  })
  frameWin.setAlwaysOnTop(true, 'screen-saver')
  loadRoute(frameWin, 'frame')
  frameWin.on('closed', () => {
    frameWin = null
  })
  return frameWin
}

/** 프레임 윈도우 핸들 (없으면 null) */
export function getFrameWindow(): BrowserWindow | null {
  return frameWin && !frameWin.isDestroyed() ? frameWin : null
}

/** 프레임 추출/편집 화면을 주 창에 표시한다. */
export function openFramesWindow(videoPath?: string): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed() && primaryRoute === 'frames') {
    if (videoPath) mainWin.webContents.send(IPC.framesInit, videoPath)
    mainWin.show()
    mainWin.focus()
    return mainWin
  }
  return showPrimaryRoute('frames', {
    width: 1100,
    height: 720,
    resizable: true,
    onLoaded: (win) => {
      if (videoPath) win.webContents.send(IPC.framesInit, videoPath)
    }
  })
}

/** 프레임 화면을 표시 중인 주 창 핸들 */
export function getFramesWindow(): BrowserWindow | null {
  return primaryRoute === 'frames' ? getMainWindow() : null
}

/** 영상 압축 화면을 주 창에 표시한다. */
export function openCompressWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed() && primaryRoute === 'compress') {
    mainWin.show()
    mainWin.focus()
    return mainWin
  }
  return showPrimaryRoute('compress', {
    width: 520,
    height: 560,
    resizable: false
  })
}

/** 캡쳐 이미지를 별도 창 대신 주 창의 편집기 화면으로 연다. */
export function openEditorWindow(imageDataUrl: string): void {
  showPrimaryRoute('editor', {
    width: 1280,
    height: 860,
    resizable: true,
    onLoaded: (win) => {
      win.webContents.send(IPC.editorLoad, imageDataUrl)
      if (process.env.EDITOR_SELFTEST) {
        setTimeout(() => win.webContents.send(IPC.editorSelftest), 600)
      }
    }
  })
}

/** 설정 화면을 주 창에 표시한다. */
export function openSettingsWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed() && primaryRoute === 'settings') {
    mainWin.show()
    mainWin.focus()
    return mainWin
  }
  return showPrimaryRoute('settings', {
    width: 520,
    height: 640,
    resizable: false
  })
}

/**
 * 영역 선택 오버레이 윈도우를 띄우고 사용자의 선택 결과를 반환한다.
 * source.bounds(DIP)에 맞춰 해당 디스플레이를 덮는다.
 */
export function openOverlayWindow(source: OverlaySource): Promise<OverlayResult> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: OverlayResult): void => {
      if (settled) return
      settled = true
      ipcMain.removeListener(IPC.overlayResult, onResult)
      if (!win.isDestroyed()) win.close()
      resolve(result)
    }

    const onResult = (_e: Electron.IpcMainEvent, result: OverlayResult): void => {
      finish(result)
    }

    const win = new BrowserWindow({
      x: source.bounds.x,
      y: source.bounds.y,
      width: source.bounds.width,
      height: source.bounds.height,
      frame: false,
      transparent: false,
      backgroundColor: '#000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      hasShadow: false,
      fullscreenable: false,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      webPreferences: { preload: preloadPath, sandbox: false }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setBounds(source.bounds) // DIP 좌표로 정확히 맞춤

    win.webContents.on('did-finish-load', () => {
      win.webContents.send(IPC.overlayInit, source)
      win.focus()
    })
    win.on('closed', () => finish({ cancelled: true }))

    ipcMain.on(IPC.overlayResult, onResult)
    loadRoute(win, 'overlay')
  })
}

/** 창 선택 picker 를 띄우고 선택된 source id 를 반환한다 */
export function openPickerWindow(sources: WindowSource[]): Promise<PickerResult> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: PickerResult): void => {
      if (settled) return
      settled = true
      ipcMain.removeListener(IPC.pickerResult, onResult)
      if (!win.isDestroyed()) win.close()
      resolve(result)
    }
    const onResult = (_e: Electron.IpcMainEvent, result: PickerResult): void => {
      finish(result)
    }

    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: false,
      backgroundColor: '#0b0d12',
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      webPreferences: { preload: preloadPath, sandbox: false }
    })
    win.setAlwaysOnTop(true, 'screen-saver')

    win.webContents.on('did-finish-load', () => {
      win.webContents.send(IPC.pickerInit, sources)
      win.focus()
    })
    win.on('closed', () => finish({ cancelled: true }))

    ipcMain.on(IPC.pickerResult, onResult)
    loadRoute(win, 'picker')
  })
}

export { loadRoute, preloadPath }
