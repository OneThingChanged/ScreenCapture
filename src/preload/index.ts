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
  type CompressResult
} from '../shared/types'

const api = {
  main: {
    action: (action: MainAction): void => ipcRenderer.send(IPC.mainAction, action),
    home: (): void => ipcRenderer.send(IPC.mainHome),
    onRecordState: (cb: (recording: boolean) => void): void => {
      ipcRenderer.on(IPC.mainRecordState, (_e, recording: boolean) => cb(recording))
    }
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
    export: (payload: FramesExportPayload): Promise<string> =>
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
      ipcRenderer.invoke(IPC.settingsSet, patch)
  },
  dialog: {
    pickFolder: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC.dialogPickFolder)
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
