import { globalShortcut } from 'electron'
import { getSettings } from './settings'
import { startCapture } from './capture'
import { toggleRecording } from './recorder'

let shortcutCaptureActive = false

/** 설정된 전역 단축키 등록 */
export function registerShortcuts(): void {
  if (shortcutCaptureActive) return
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
        if (!globalShortcut.register(accel, fn)) {
          console.warn(`[shortcuts] 전역 단축키를 등록하지 못했습니다: ${accel}`)
        }
      } catch (error) {
        console.warn(`[shortcuts] 잘못된 전역 단축키입니다: ${accel}`, error)
      }
    }
  }
}

/** 단축키 입력 중에는 기존 전역 단축키를 잠시 해제한다. */
export function setShortcutCaptureActive(active: boolean): void {
  shortcutCaptureActive = active
  if (active) unregisterShortcuts()
  else registerShortcuts()
}

/** 단축키 입력 도중 앱 포커스를 잃으면 전역 단축키를 즉시 복구한다. */
export function resumeShortcutsIfSuspended(): void {
  if (!shortcutCaptureActive) return
  shortcutCaptureActive = false
  registerShortcuts()
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
