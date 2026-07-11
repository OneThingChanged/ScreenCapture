import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { IPC, type AppUpdateState } from '../shared/types'

const RELEASES_URL = 'https://github.com/OneThingChanged/ScreenCapture/releases'

let state: AppUpdateState = {
  status: 'idle',
  currentVersion: app.getVersion()
}
let registered = false

function releaseNotes(info: UpdateInfo): string | undefined {
  if (typeof info.releaseNotes === 'string') return info.releaseNotes
  if (Array.isArray(info.releaseNotes)) {
    return info.releaseNotes
      .map((item) => item.note)
      .filter(Boolean)
      .join('\n\n')
  }
  return undefined
}

function setState(patch: Partial<AppUpdateState>): AppUpdateState {
  state = {
    ...state,
    ...patch,
    currentVersion: app.getVersion()
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.updateState, state)
  }
  return state
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** electron-updater 이벤트와 IPC를 한 번만 등록한다. */
export function registerUpdaterIpc(): void {
  if (registered) return
  registered = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', message: undefined, percent: undefined })
  })
  autoUpdater.on('update-available', (info) => {
    setState({
      status: 'available',
      availableVersion: info.version,
      releaseNotes: releaseNotes(info),
      message: undefined,
      percent: undefined
    })
  })
  autoUpdater.on('update-not-available', () => {
    setState({
      status: 'not-available',
      availableVersion: undefined,
      releaseNotes: undefined,
      message: undefined,
      percent: undefined
    })
  })
  autoUpdater.on('download-progress', (progress) => {
    setState({
      status: 'downloading',
      percent: Math.max(0, Math.min(100, progress.percent)),
      transferred: progress.transferred,
      total: progress.total,
      message: undefined
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    setState({
      status: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      message: undefined
    })
  })
  autoUpdater.on('error', (error) => {
    setState({ status: 'error', message: errorMessage(error) })
  })

  ipcMain.handle(IPC.updateGetState, () => state)

  ipcMain.handle(IPC.updateCheck, async () => {
    if (!app.isPackaged) {
      return setState({
        status: 'error',
        message: '업데이트 확인은 설치된 릴리즈 빌드에서 사용할 수 있습니다.'
      })
    }
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      return setState({
        status: 'error',
        message: 'Portable 버전은 릴리즈 페이지에서 새 버전을 직접 받아주세요.'
      })
    }
    setState({ status: 'checking', message: undefined, percent: undefined })
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) })
    }
    return state
  })

  ipcMain.handle(IPC.updateDownload, async () => {
    if (state.status !== 'available') return state
    setState({ status: 'downloading', percent: 0, message: undefined })
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) })
    }
    return state
  })

  ipcMain.on(IPC.updateInstall, () => {
    if (state.status === 'downloaded') autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.on(IPC.updateOpenReleases, () => {
    void shell.openExternal(RELEASES_URL)
  })
}
