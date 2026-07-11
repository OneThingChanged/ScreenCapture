import { globalShortcut } from 'electron'
import { getSettings } from './settings'
import { startCapture } from './capture'
import { toggleRecording } from './recorder'

/** 설정된 전역 단축키 등록 */
export function registerShortcuts(): void {
  unregisterShortcuts()
  const { shortcuts } = getSettings()
  const map: [string, () => void][] = [
    [shortcuts.region, () => startCapture('region')],
    [shortcuts.window, () => startCapture('window')],
    [shortcuts.fullscreen, () => startCapture('fullscreen')],
    [shortcuts.recordRegion, () => toggleRecording('region')],
    [shortcuts.recordWindow, () => toggleRecording('window')],
    [shortcuts.recordFullscreen, () => toggleRecording('fullscreen')]
  ]
  for (const [accel, fn] of map) {
    if (accel) {
      try {
        globalShortcut.register(accel, fn)
      } catch {
        // 잘못된 액셀러레이터는 무시
      }
    }
  }
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
