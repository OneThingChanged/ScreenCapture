import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { getSettings } from './settings'
import {
  IPC,
  type CaptureCompleted,
  type OverlaySource,
  type OverlayResult,
  type PickerResult,
  type ShellNavigation,
  type WindowSource
} from '../shared/types'

export const preloadPath = join(__dirname, '../preload/index.js')

export function loadRoute(win: BrowserWindow, route: string): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) win.loadURL(`${devUrl}/${route}/index.html`)
  else win.loadFile(join(__dirname, `../renderer/${route}/index.html`))
}

let mainWin: BrowserWindow | null = null
let shellReady = false
let quitting = false
let trayRecreateHandler: (() => void) | null = null
const pending: (() => void)[] = []

app.on('before-quit', () => {
  quitting = true
})

function afterShellReady(task: () => void): void {
  if (shellReady && mainWin && !mainWin.isDestroyed()) task()
  else pending.push(task)
}

function ensureMainWindow(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) return mainWin

  shellReady = false
  mainWin = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: 'ScreenCapture',
    backgroundColor: '#111318',
    show: false,
    resizable: true,
    fullscreenable: true,
    maximizable: true,
    webPreferences: { preload: preloadPath, sandbox: false }
  })
  mainWin.setMenuBarVisibility(false)
  mainWin.on('close', (event) => {
    if (!quitting && getSettings().closeToTray) {
      event.preventDefault()
      mainWin?.hide()
      // 일부 Windows 환경에서는 창을 숨긴 뒤 알림 영역 아이콘이 유실될 수 있다.
      // 새 Tray 객체를 만들어 Shell_NotifyIcon에 다시 등록한다.
      trayRecreateHandler?.()
    } else if (!quitting) {
      quitting = true
      app.quit()
    }
  })
  mainWin.on('closed', () => {
    mainWin = null
    shellReady = false
  })
  mainWin.webContents.once('did-finish-load', () => {
    shellReady = true
    for (const task of pending.splice(0)) task()
    mainWin?.show()
    mainWin?.focus()
  })
  loadRoute(mainWin, 'app')
  return mainWin
}

export function openMainWindow(): BrowserWindow {
  const win = ensureMainWindow()
  if (win.isMinimized()) win.restore()
  if (shellReady) {
    win.show()
    win.focus()
  }
  return win
}

export function showMainDashboard(): BrowserWindow {
  const win = openMainWindow()
  sendShellNavigation({ tab: 'capture' })
  return win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null
}

export function setTrayRecreateHandler(handler: () => void): void {
  trayRecreateHandler = handler
}

export function isMainDashboard(): boolean {
  return true
}

export function sendShellNavigation(navigation: ShellNavigation): void {
  openMainWindow()
  afterShellReady(() => mainWin?.webContents.send(IPC.shellNavigate, navigation))
}

export function notifyCaptureCompleted(result: CaptureCompleted): void {
  if (!getMainWindow() && !result.openEditor) return
  openMainWindow()
  afterShellReady(() => mainWin?.webContents.send(IPC.captureCompleted, result))
}

export function openFramesWindow(videoPath?: string): BrowserWindow {
  const win = openMainWindow()
  sendShellNavigation({ tab: 'edit', tool: 'frames', path: videoPath })
  return win
}

export function getFramesWindow(): BrowserWindow | null {
  return getMainWindow()
}

export function openCompressWindow(): BrowserWindow {
  const win = openMainWindow()
  sendShellNavigation({ tab: 'edit', tool: 'compress' })
  return win
}

export function openEditorWindow(imageDataUrl: string): void {
  notifyCaptureCompleted({
    dataUrl: imageDataUrl,
    savedPath: null,
    mode: 'fullscreen',
    openEditor: true,
    createdAt: Date.now()
  })
}

export function openSettingsWindow(): BrowserWindow {
  const win = openMainWindow()
  sendShellNavigation({ settingsOpen: true })
  return win
}

let frameWin: BrowserWindow | null = null

export function openRecordFrameWindow(): BrowserWindow {
  if (frameWin && !frameWin.isDestroyed()) {
    frameWin.show()
    frameWin.focus()
    return frameWin
  }
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const wa = display.workArea
  const width = Math.min(960, Math.round(wa.width * 0.6))
  const height = Math.min(600, Math.round(wa.height * 0.6))
  frameWin = new BrowserWindow({
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
    width,
    height,
    minWidth: 160,
    minHeight: 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    title: '녹화 영역',
    alwaysOnTop: true,
    webPreferences: { preload: preloadPath, sandbox: false }
  })
  frameWin.setAlwaysOnTop(true, 'screen-saver')
  loadRoute(frameWin, 'frame')
  frameWin.on('closed', () => { frameWin = null })
  return frameWin
}

export function getFrameWindow(): BrowserWindow | null {
  return frameWin && !frameWin.isDestroyed() ? frameWin : null
}

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
    const onResult = (_e: Electron.IpcMainEvent, result: OverlayResult): void => finish(result)
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
    win.setBounds(source.bounds)
    win.webContents.on('did-finish-load', () => {
      win.webContents.send(IPC.overlayInit, source)
      win.focus()
    })
    win.on('closed', () => finish({ cancelled: true }))
    ipcMain.on(IPC.overlayResult, onResult)
    loadRoute(win, 'overlay')
  })
}

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
    const onResult = (_e: Electron.IpcMainEvent, result: PickerResult): void => finish(result)
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
