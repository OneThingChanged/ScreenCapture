/** 캡쳐 모드 */
export type CaptureMode = 'region' | 'window' | 'fullscreen'

/** 캡쳐 후 동작 */
export type AfterCapture = 'editor' | 'save' | 'both'

/** 이미지 포맷 */
export type ImageFormat = 'png' | 'jpg'

/** 녹화 포맷 */
export type RecordFormat = 'webm' | 'mp4' | 'gif'

/** 화면 위 사각형 영역 (DIP 좌표) */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 앱 설정 */
export interface AppSettings {
  saveDir: string
  imageFormat: ImageFormat
  jpgQuality: number
  afterCapture: AfterCapture
  copyToClipboard: boolean
  /** @deprecated exportMp4/exportGif/keepWebm 로 대체됨 (구버전 호환용) */
  recordFormat: RecordFormat
  /** 녹화 결과를 MP4 로 내보내기 */
  exportMp4: boolean
  /** 녹화 결과를 GIF 로 내보내기 */
  exportGif: boolean
  /** 원본 WebM 파일 유지 */
  keepWebm: boolean
  recordFps: number
  shortcuts: {
    region: string
    window: string
    fullscreen: string
    record: string
  }
}

/** 오버레이에 넘기는 디스플레이 + freeze 이미지 정보 */
export interface OverlaySource {
  displayId: number
  bounds: Rect
  scaleFactor: number
  /** 해당 디스플레이의 freeze 스크린샷 (dataURL) */
  thumbnailDataUrl: string
  /** 자동 테스트용: 지정되면 오버레이가 이 영역(DIP)을 즉시 제출 */
  testRect?: Rect
}

/** 오버레이 선택 결과 */
export interface OverlayResult {
  /** 사용자가 취소(ESC) */
  cancelled: boolean
  /** 선택한 디스플레이 id */
  displayId?: number
  /** 디스플레이 로컬 좌표(px, scaleFactor 반영 전) 기준 선택 영역 */
  rect?: Rect
}

/** 창 picker 항목 */
export interface WindowSource {
  id: string
  name: string
  thumbnailDataUrl: string
}

/** 창 picker 결과 */
export interface PickerResult {
  cancelled: boolean
  id?: string
}

/** 녹화 모드 (이미지 캡쳐와 동일하게 영역/창/전체) */
export type RecordMode = 'region' | 'window' | 'fullscreen'

/** 녹화 시작 페이로드 */
export interface RecordStartPayload {
  sourceId: string
  fps: number
  /** 영역 녹화 시 잘라낼 영역(물리 픽셀). 없으면 전체 스트림 녹화 */
  crop?: Rect
}

/** 메인 윈도우(대시보드) 액션 */
export type MainAction =
  | 'region'
  | 'window'
  | 'fullscreen'
  | 'record-region'
  | 'record-window'
  | 'record-fullscreen'
  | 'frames'
  | 'compress'
  | 'settings'

/** 프레임 편집 결과 내보내기 포맷 */
export type ExportFormat = 'mp4' | 'gif'

/** 프레임 내보내기 요청 */
export interface FramesExportPayload {
  tempDir: string
  /** 내보낼 프레임들의 원본 인덱스(재생 순서대로) */
  indices: number[]
  format: ExportFormat
  fps: number
}

/** 영상 압축 대상 정보 */
export interface CompressInfo {
  path: string
  size: number // 바이트
  width: number
  height: number
  duration: number
}

/** 영상 압축 요청 */
export interface CompressPayload {
  input: string
  /** libx264 CRF (낮을수록 고화질/큰 용량) */
  crf: number
  /** 목표 세로 해상도 (0=원본 유지) */
  scaleHeight: number
  preset: string
}

/** 영상 압축 결과 */
export interface CompressResult {
  output: string
  originalSize: number
  newSize: number
}

/** 프레임 추출 결과 메타 */
export interface FramesMeta {
  tempDir: string
  count: number
  width: number
  height: number
  duration: number
  /** 각 프레임의 절대 재생 시각(초) */
  times: number[]
}

/** 앱 업데이트 화면에 표시할 상태 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateState {
  status: UpdateStatus
  currentVersion: string
  availableVersion?: string
  releaseNotes?: string
  percent?: number
  transferred?: number
  total?: number
  message?: string
}

/** IPC 채널 이름 모음 */
export const IPC = {
  captureStart: 'capture:start',
  mainAction: 'main:action',
  mainHome: 'main:home',
  mainRecordState: 'main:recordState',
  overlayInit: 'overlay:init',
  overlayResult: 'overlay:result',
  pickerInit: 'picker:init',
  pickerResult: 'picker:result',
  editorLoad: 'editor:load',
  editorSave: 'editor:save',
  editorCopy: 'editor:copy',
  editorClose: 'editor:close',
  editorSelftest: 'editor:selftest',
  recordSources: 'record:sources',
  recordStart: 'record:start',
  recordStop: 'record:stop',
  recordState: 'record:state',
  recordSave: 'record:save',
  frameInit: 'frame:init',
  frameSetBounds: 'frame:setBounds',
  frameStart: 'frame:start',
  frameStop: 'frame:stop',
  frameClose: 'frame:close',
  frameIgnoreMouse: 'frame:ignoreMouse',
  frameRecordState: 'frame:recordState',
  framesInit: 'frames:init',
  framesPick: 'frames:pick',
  framesExtract: 'frames:extract',
  framesGetImage: 'frames:getImage',
  framesExport: 'frames:export',
  compressInit: 'compress:init',
  compressPick: 'compress:pick',
  compressInfo: 'compress:info',
  compressRun: 'compress:run',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  dialogPickFolder: 'dialog:pickFolder',
  updateGetState: 'update:getState',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateOpenReleases: 'update:openReleases',
  updateState: 'update:state'
} as const
