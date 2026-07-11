import { app } from 'electron'
import { join } from 'node:path'
import Store from 'electron-store'
import type { AppSettings } from '../shared/types'

const defaults: AppSettings = {
  saveDir: join(app.getPath('pictures'), 'ScreenCapture'),
  imageFormat: 'png',
  jpgQuality: 90,
  afterCapture: 'both',
  copyToClipboard: true,
  closeToTray: true,
  recordFormat: 'webm',
  exportMp4: true,
  exportGif: false,
  keepWebm: false,
  recordFps: 30,
  shortcuts: {
    region: 'CommandOrControl+Shift+1',
    window: 'CommandOrControl+Shift+2',
    fullscreen: 'CommandOrControl+Shift+3',
    recordRegion: 'CommandOrControl+Shift+4',
    recordWindow: 'CommandOrControl+Shift+5',
    recordFullscreen: 'CommandOrControl+Shift+R',
    record: 'CommandOrControl+Shift+R'
  }
}

const store = new Store<AppSettings>({ defaults })

export function getSettings(): AppSettings {
  const current = store.store
  const shortcuts = current.shortcuts
  return {
    ...current,
    closeToTray: current.closeToTray ?? defaults.closeToTray,
    shortcuts: {
      ...defaults.shortcuts,
      ...shortcuts,
      recordRegion: shortcuts.recordRegion || defaults.shortcuts.recordRegion,
      recordWindow: shortcuts.recordWindow || defaults.shortcuts.recordWindow,
      recordFullscreen:
        shortcuts.recordFullscreen || shortcuts.record || defaults.shortcuts.recordFullscreen,
      record: shortcuts.record || shortcuts.recordFullscreen || defaults.shortcuts.record
    }
  }
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next: AppSettings = {
    ...current,
    ...patch,
    shortcuts: patch.shortcuts
      ? { ...current.shortcuts, ...patch.shortcuts }
      : current.shortcuts
  }
  store.set(next)
  return getSettings()
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return store.get(key)
}
