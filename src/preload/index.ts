import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AppSettings,
  type MainAction,
  type OverlaySource,
  type OverlayResult,
  type WindowSource,
  type PickerResult,
  type RecordStartPayload,
  type Rect,
  type FramesMeta,
  type FramesExportPayload,
  type CompressInfo,
  type CompressPayload,
  type CompressResult,
  type AppUpdateState,
  type ShellNavigation,
  type CaptureCompleted,
  type MediaFile,
  type EditorImageSource
} from '../shared/types'

const api = {
  main: {
    action: (action: MainAction): void => ipcRenderer.send(IPC.mainAction, action),
    home: (): void => ipcRenderer.send(IPC.mainHome),
    onRecordState: (cb: (recording: boolean) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, recording: boolean): void => cb(recording)
      ipcRenderer.on(IPC.mainRecordState, listener)
      return () => ipcRenderer.removeListener(IPC.mainRecordState, listener)
    },
    onNavigate: (cb: (navigation: ShellNavigation) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, navigation: ShellNavigation): void => cb(navigation)
      ipcRenderer.on(IPC.shellNavigate, listener)
      return () => ipcRenderer.removeListener(IPC.shellNavigate, listener)
    },
    onCaptureCompleted: (cb: (result: CaptureCompleted) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, result: CaptureCompleted): void => cb(result)
      ipcRenderer.on(IPC.captureCompleted, listener)
      return () => ipcRenderer.removeListener(IPC.captureCompleted, listener)
    }
  },
  media: {
    list: (): Promise<MediaFile[]> => ipcRenderer.invoke(IPC.mediaList),
    preview: (path: string): Promise<string | null> => ipcRenderer.invoke(IPC.mediaPreview, path),
    url: (path: string): string => `sc-media://file/${encodeURIComponent(path)}`,
    contextMenu: (path: string): void => ipcRenderer.send(IPC.mediaContextMenu, path),
    openFolder: (path?: string): Promise<void> => ipcRenderer.invoke(IPC.mediaOpenFolder, path),
    rename: (path: string, name: string): Promise<MediaFile> =>
      ipcRenderer.invoke(IPC.mediaRename, { path, name }),
    delete: (path: string): Promise<void> => ipcRenderer.invoke(IPC.mediaDelete, path)
  },
  frame: {
    setBounds: (bounds: Rect): void => ipcRenderer.send(IPC.frameSetBounds, bounds),
    start: (contentRect: Rect): void => ipcRenderer.send(IPC.frameStart, contentRect),
    stop: (): void => ipcRenderer.send(IPC.frameStop),
    close: (): void => ipcRenderer.send(IPC.frameClose),
    setIgnoreMouse: (ignore: boolean): void =>
      ipcRenderer.send(IPC.frameIgnoreMouse, ignore),
    onRecordState: (cb: (recording: boolean) => void): void => {
      ipcRenderer.on(IPC.frameRecordState, (_e, recording: boolean) => cb(recording))
    }
  },
  frames: {
    onInit: (cb: (videoPath: string) => void): void => {
      ipcRenderer.on(IPC.framesInit, (_e, videoPath: string) => cb(videoPath))
    },
    pick: (): Promise<string | null> => ipcRenderer.invoke(IPC.framesPick),
    extract: (videoPath: string): Promise<FramesMeta> =>
      ipcRenderer.invoke(IPC.framesExtract, videoPath),
    getImage: (tempDir: string, index: number): Promise<string> =>
      ipcRenderer.invoke(IPC.framesGetImage, { tempDir, index }),
    export: (payload: FramesExportPayload): Promise<string | null> =>
      ipcRenderer.invoke(IPC.framesExport, payload)
  },
  compress: {
    pick: (): Promise<string | null> => ipcRenderer.invoke(IPC.compressPick),
    info: (input: string): Promise<CompressInfo> =>
      ipcRenderer.invoke(IPC.compressInfo, input),
    run: (payload: CompressPayload): Promise<CompressResult> =>
      ipcRenderer.invoke(IPC.compressRun, payload)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.settingsSet, patch),
    captureShortcut: (active: boolean): void =>
      ipcRenderer.send(IPC.settingsShortcutCapture, active)
  },
  dialog: {
    pickFolder: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC.dialogPickFolder)
  },
  updater: {
    getState: (): Promise<AppUpdateState> => ipcRenderer.invoke(IPC.updateGetState),
    check: (): Promise<AppUpdateState> => ipcRenderer.invoke(IPC.updateCheck),
    download: (): Promise<AppUpdateState> => ipcRenderer.invoke(IPC.updateDownload),
    install: (): void => ipcRenderer.send(IPC.updateInstall),
    openReleases: (): void => ipcRenderer.send(IPC.updateOpenReleases),
    onState: (cb: (state: AppUpdateState) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, state: AppUpdateState): void => cb(state)
      ipcRenderer.on(IPC.updateState, listener)
      return () => ipcRenderer.removeListener(IPC.updateState, listener)
    }
  },
  overlay: {
    onInit: (cb: (source: OverlaySource) => void): void => {
      ipcRenderer.on(IPC.overlayInit, (_e, source: OverlaySource) => cb(source))
    },
    submit: (result: OverlayResult): void => {
      ipcRenderer.send(IPC.overlayResult, result)
    }
  },
  picker: {
    onInit: (cb: (sources: WindowSource[]) => void): void => {
      ipcRenderer.on(IPC.pickerInit, (_e, sources: WindowSource[]) => cb(sources))
    },
    submit: (result: PickerResult): void => {
      ipcRenderer.send(IPC.pickerResult, result)
    }
  },
  editor: {
    onLoad: (cb: (dataUrl: string) => void): void => {
      ipcRenderer.on(IPC.editorLoad, (_e, dataUrl: string) => cb(dataUrl))
    },
    pick: (): Promise<EditorImageSource | null> => ipcRenderer.invoke(IPC.editorPick),
    save: (dataUrl: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.editorSave, dataUrl),
    copy: (dataUrl: string): Promise<void> =>
      ipcRenderer.invoke(IPC.editorCopy, dataUrl),
    close: (): void => ipcRenderer.send(IPC.editorClose),
    onSelftest: (cb: () => void): void => {
      ipcRenderer.on(IPC.editorSelftest, () => cb())
    }
  },
  recorder: {
    onStart: (cb: (payload: RecordStartPayload) => void): void => {
      ipcRenderer.on(IPC.recordStart, (_e, payload: RecordStartPayload) =>
        cb(payload)
      )
    },
    onStop: (cb: () => void): void => {
      ipcRenderer.on(IPC.recordStop, () => cb())
    },
    save: (buffer: ArrayBuffer): void => {
      ipcRenderer.send(IPC.recordSave, buffer)
    },
    error: (message: string): void => {
      ipcRenderer.send(IPC.recordState, { error: message })
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
