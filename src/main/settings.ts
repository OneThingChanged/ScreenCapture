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
  recordFormat: 'webm',
  exportMp4: true,
  exportGif: false,
  keepWebm: false,
  recordFps: 30,
  shortcuts: {
    region: 'CommandOrControl+Shift+1',
    window: 'CommandOrControl+Shift+2',
    fullscreen: 'CommandOrControl+Shift+3',
    record: 'CommandOrControl+Shift+R'
  }
}

const store = new Store<AppSettings>({ defaults })

export function getSettings(): AppSettings {
  return store.store
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  store.set({ ...store.store, ...patch })
  return store.store
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return store.get(key)
}
