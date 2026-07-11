import { ipcMain, dialog, BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'node:path'
import { IPC, type AppSettings, type MainAction, type Rect } from '../shared/types'
import { getSettings, setSettings } from './settings'
import { registerShortcuts, setShortcutCaptureActive } from './shortcuts'
import {
  copyImageToClipboard,
  imageFromDataUrl,
  imageToDataUrl,
  saveImage,
  saveImageToPath
} from './storage'
import { startCapture } from './capture'
import {
  toggleRecording,
  isRecording,
  startFrameRegionRecording,
  stopRecordingExternal
} from './recorder'
import {
  openSettingsWindow,
  getMainWindow,
  openRecordFrameWindow,
  getFrameWindow,
  openFramesWindow,
  openCompressWindow,
  showMainDashboard
} from './windows'

/** 메인 대시보드에서 들어온 액션 처리 */
async function handleMainAction(action: MainAction): Promise<void> {
  if (action === 'settings') {
    openSettingsWindow()
    return
  }

  if (action === 'frames') {
    openFramesWindow()
    return
  }

  if (action === 'compress') {
    openCompressWindow()
    return
  }

  // 영역 녹화: 화면에 조절 가능한 녹화 프레임을 띄운다 (꼴캠 스타일)
  if (action === 'record-region') {
    if (isRecording()) {
      stopRecordingExternal()
      return
    }
    openRecordFrameWindow()
    return
  }

  // 창/전체 녹화: 진행 중이면 즉시 정지(숨길 필요 없음)
  if (action.startsWith('record-')) {
    const mode = action.slice('record-'.length) as 'region' | 'window' | 'fullscreen'
    if (isRecording()) {
      toggleRecording(mode) // 정지
      return
    }
    // 주 창은 유지하고 녹화 대상에서는 제외한다.
    toggleRecording(mode)
    return
  }

  await startCapture(action as 'region' | 'window' | 'fullscreen')
}

/** IPC 핸들러 등록 (메인 ↔ 렌더러) */
export function registerIpc(): void {
  ipcMain.on(IPC.mainAction, (_e, action: MainAction) => {
    void handleMainAction(action)
  })

  ipcMain.on(IPC.mainHome, () => {
    showMainDashboard()
  })

  ipcMain.handle(IPC.settingsGet, () => getSettings())

  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<AppSettings>) => {
    const next = setSettings(patch)
    // 단축키가 바뀌었을 수 있으니 재등록
    if (patch.shortcuts) registerShortcuts()
    return next
  })

  ipcMain.on(IPC.settingsShortcutCapture, (_e, active: boolean) => {
    setShortcutCaptureActive(active)
  })

  ipcMain.handle(IPC.dialogPickFolder, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getSettings().saveDir
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.editorPick, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '편집할 이미지 선택',
      properties: ['openFile'],
      defaultPath: getSettings().saveDir,
      filters: [
        { name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
        { name: '모든 파일', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    const image = nativeImage.createFromPath(path)
    if (image.isEmpty()) throw new Error('이미지를 불러올 수 없습니다.')
    return { path, dataUrl: imageToDataUrl(image) }
  })

  ipcMain.handle(IPC.editorSave, async (e, dataUrl: string) => {
    const image = imageFromDataUrl(dataUrl)
    if (process.env.EDITOR_SELFTEST) {
      const path = await saveImage(image)
      console.log('[selftest] editor saved:', path, image.getSize())
      setTimeout(() => app.quit(), 200)
      return path
    }
    const now = new Date()
    const part = (value: number): string => String(value).padStart(2, '0')
    const name = `Edited_${now.getFullYear()}-${part(now.getMonth() + 1)}-${part(now.getDate())}_${part(now.getHours())}-${part(now.getMinutes())}-${part(now.getSeconds())}.png`
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showSaveDialog(win!, {
      title: '편집 이미지 저장',
      defaultPath: join(getSettings().saveDir, name),
      filters: [
        { name: 'PNG 이미지', extensions: ['png'] },
        { name: 'JPEG 이미지', extensions: ['jpg', 'jpeg'] }
      ]
    })
    if (result.canceled || !result.filePath) return null
    const path = await saveImageToPath(image, result.filePath)
    return path
  })

  ipcMain.handle(IPC.editorCopy, (_e, dataUrl: string) => {
    copyImageToClipboard(imageFromDataUrl(dataUrl))
  })

  ipcMain.on(IPC.editorClose, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && win === getMainWindow()) showMainDashboard()
    else win?.close()
  })

  // --- 녹화 프레임 윈도우 ---
  ipcMain.on(IPC.frameSetBounds, (e, bounds: Rect) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    win?.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    })
  })

  ipcMain.on(IPC.frameStart, (_e, contentRect: Rect) => {
    void startFrameRegionRecording(contentRect)
  })

  ipcMain.on(IPC.frameStop, () => {
    stopRecordingExternal()
  })

  ipcMain.on(IPC.frameClose, (e) => {
    if (isRecording()) stopRecordingExternal()
    BrowserWindow.fromWebContents(e.sender)?.close()
  })

  ipcMain.on(IPC.frameIgnoreMouse, (e, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    win?.setIgnoreMouseEvents(ignore, { forward: true })
  })
}

/** 녹화 상태가 바뀔 때 프레임 윈도우에 알린다 (index.ts 에서 등록) */
export function notifyFrameRecordState(recording: boolean): void {
  getFrameWindow()?.webContents.send(IPC.frameRecordState, recording)
}
