import { app } from 'electron'
import { createTray } from './tray'
import { registerIpc, notifyFrameRecordState } from './ipc'
import { registerFramesIpc } from './frames'
import { registerCompressIpc } from './compress'
import { registerUpdaterIpc } from './updater'
import {
  registerMediaIpc,
  registerMediaProtocol,
  registerMediaScheme
} from './media'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { captureFullScreen, captureRegion, captureWindow } from './capture'
import { saveImage } from './storage'
import { openEditorWindow, openMainWindow, getMainWindow } from './windows'
import {
  registerRecorderIpc,
  toggleRecording,
  setRecorderStateListener
} from './recorder'
import { IPC } from '../shared/types'

registerMediaScheme()

// 단일 인스턴스 보장
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// 두 번째 실행 시도 시 기존 메인 창을 띄워준다
app.on('second-instance', () => {
  openMainWindow()
})

app.whenReady().then(async () => {
  registerMediaProtocol()
  registerIpc()
  registerRecorderIpc()
  registerFramesIpc()
  registerCompressIpc()
  registerUpdaterIpc()
  registerMediaIpc()
  createTray()
  registerShortcuts()

  // 녹화 상태를 메인 대시보드 + 녹화 프레임에 반영
  setRecorderStateListener((recording) => {
    getMainWindow()?.webContents.send(IPC.mainRecordState, recording)
    notifyFrameRecordState(recording)
  })

  const isSelftest =
    process.env.RECORD_SELFTEST ||
    process.env.EDITOR_SELFTEST ||
    process.env.CAPTURE_SELFTEST
  if (!isSelftest) {
    openMainWindow()
  }

  // 녹화 자가 테스트: 시작 → 2초 후 정지 → 저장/변환 확인
  if (process.env.RECORD_SELFTEST) {
    toggleRecording()
    setTimeout(() => toggleRecording(), 2500)
  }

  // 편집기 자가 테스트: 캡쳐 → 편집기 → 도형 추가 → 저장 → 종료
  if (process.env.EDITOR_SELFTEST && !process.env.CAPTURE_SELFTEST) {
    const image = await captureFullScreen()
    if (image) openEditorWindow(image.toDataURL())
    return
  }

  // 자가 테스트 (CAPTURE_SELFTEST=fullscreen|region)
  const selftest = process.env.CAPTURE_SELFTEST
  if (selftest) {
    try {
      const image =
        selftest === 'region'
          ? await captureRegion()
          : selftest === 'window'
            ? await captureWindow()
            : await captureFullScreen()
      if (image) {
        const path = await saveImage(image)
        console.log('[selftest] saved:', path, image.getSize())
      } else {
        console.log('[selftest] no image (cancelled?)')
      }
    } catch (err) {
      console.error('[selftest] error:', err)
    }
    app.quit()
  }
})

// 트레이 상주형: 모든 창이 닫혀도 종료하지 않는다 (app.quit 호출 안 함)
app.on('window-all-closed', () => {
  // intentionally empty
})

app.on('will-quit', () => {
  unregisterShortcuts()
})

// macOS Dock 아이콘 숨김 (트레이 전용). Windows 영향 없음
if (process.platform === 'darwin') {
  app.dock?.hide()
}
