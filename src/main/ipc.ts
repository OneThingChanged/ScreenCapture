import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { IPC, type AppSettings, type MainAction, type Rect } from '../shared/types'
import { getSettings, setSettings } from './settings'
import { registerShortcuts } from './shortcuts'
import { saveImage, copyImageToClipboard, imageFromDataUrl } from './storage'
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
  showMainDashboard,
  isMainDashboard
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
    const win = getMainWindow()
    win?.hide()
    await new Promise((r) => setTimeout(r, 200))
    openRecordFrameWindow()
    win?.show()
    return
  }

  // 창/전체 녹화: 진행 중이면 즉시 정지(숨길 필요 없음)
  if (action.startsWith('record-')) {
    const mode = action.slice('record-'.length) as 'region' | 'window' | 'fullscreen'
    if (isRecording()) {
      toggleRecording(mode) // 정지
      return
    }
    // 새로 시작: 대시보드를 잠시 숨겨 영역/창 선택·녹화를 방해하지 않는다
    const win = getMainWindow()
    win?.hide()
    await new Promise((r) => setTimeout(r, 250))
    toggleRecording(mode)
    win?.show()
    return
  }

  // 이미지 캡쳐: 메인 창이 스크린샷에 찍히지 않도록 잠시 숨긴다
  const win = getMainWindow()
  win?.hide()
  await new Promise((r) => setTimeout(r, 250))
  try {
    await startCapture(action as 'region' | 'window' | 'fullscreen')
  } finally {
    // 편집기로 전환됐다면 해당 화면의 로드 완료 시점에 주 창이 표시된다.
    // 취소/즉시 저장이면 기존 대시보드를 다시 보여준다.
    if (isMainDashboard()) win?.show()
  }
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

  ipcMain.handle(IPC.dialogPickFolder, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getSettings().saveDir
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.editorSave, async (_e, dataUrl: string) => {
    const image = imageFromDataUrl(dataUrl)
    const path = await saveImage(image)
    if (process.env.EDITOR_SELFTEST) {
      console.log('[selftest] editor saved:', path, image.getSize())
      setTimeout(() => app.quit(), 200)
    }
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
