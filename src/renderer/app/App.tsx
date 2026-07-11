import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera24Regular,
  Checkmark24Regular,
  ArchiveRegular,
  Crop24Regular,
  Delete24Regular,
  Desktop24Regular,
  Dismiss24Regular,
  Edit24Regular,
  Filter24Regular,
  Folder24Regular,
  FolderOpen24Regular,
  Image24Regular,
  List24Regular,
  Record24Filled,
  Rename24Regular,
  Settings24Regular,
  VideoClip24Regular,
  Window24Regular
} from '@fluentui/react-icons'
import type {
  AppSettings,
  AppTab,
  CaptureCompleted,
  EditTool,
  MediaFile,
  ShellNavigation
} from '../../shared/types'
import { FabricEditor } from './FabricEditor'
import { FramesEditor } from './FramesEditor'
import { CompressTool } from './CompressTool'
import { SettingsDrawer } from './SettingsDrawer'

const tabs: { id: AppTab; label: string; icon: typeof Camera24Regular }[] = [
  { id: 'capture', label: '캡처', icon: Camera24Regular },
  { id: 'manage', label: '관리', icon: Folder24Regular },
  { id: 'edit', label: '편집', icon: Edit24Regular }
]

function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  const { label, active, className = '', children, ...rest } = props
  return <button {...rest} className={`icon-button ${active ? 'is-active' : ''} ${className}`} title={label} aria-label={label}>{children}</button>
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function fmtDate(value: number): string {
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value)
}

function fmtShortcut(value: string): string {
  return value.replace('CommandOrControl', 'Ctrl').replaceAll('+', ' + ')
}

function CapturePanel({ settings, recording, onRefreshSettings }: {
  settings: AppSettings | null
  recording: boolean
  onRefreshSettings: () => void
}) {
  const [recordSeconds, setRecordSeconds] = useState(0)
  const capture = (action: 'region' | 'window' | 'fullscreen'): void => window.api.main.action(action)
  const record = (action: 'record-region' | 'record-window' | 'record-fullscreen'): void => window.api.main.action(action)
  useEffect(() => {
    if (!recording) {
      setRecordSeconds(0)
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => setRecordSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [recording])
  const recordTime = `${String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:${String(recordSeconds % 60).padStart(2, '0')}`
  const updateFormat = async (imageFormat: AppSettings['imageFormat']): Promise<void> => {
    await window.api.settings.set({ imageFormat })
    onRefreshSettings()
  }
  return <section className="panel capture-panel">
    <div className="capture-layout">
      <main className="capture-stage">
        <div className="welcome-card">
          <div className="welcome-icon"><Camera24Regular /></div>
          <div><span className="eyebrow">SCREEN CAPTURE</span><h1>무엇을 캡처할까요?</h1><p>주 창은 그대로 유지되며 캡처 결과만 편집 탭으로 전달됩니다.</p></div>
        </div>
        <div className="capture-cards">
          <button onClick={() => capture('region')}><Crop24Regular /><strong>영역 캡처</strong><span>드래그로 원하는 부분만 선택</span><kbd>{fmtShortcut(settings?.shortcuts.region ?? 'Ctrl+Shift+1')}</kbd></button>
          <button onClick={() => capture('window')}><Window24Regular /><strong>창 캡처</strong><span>열려 있는 창을 골라 캡처</span><kbd>{fmtShortcut(settings?.shortcuts.window ?? 'Ctrl+Shift+2')}</kbd></button>
          <button onClick={() => capture('fullscreen')}><Desktop24Regular /><strong>전체 화면</strong><span>현재 모니터를 즉시 캡처</span><kbd>{fmtShortcut(settings?.shortcuts.fullscreen ?? 'Ctrl+Shift+3')}</kbd></button>
        </div>
        <section className="record-section">
          <div className="record-heading"><Record24Filled /><div><strong>화면 녹화</strong><span>녹화할 대상을 선택하세요</span></div></div>
          {recording
            ? <div className="recording-banner"><div className="recording-pulse" /><div><strong>녹화 중 · {recordTime}</strong><span>정지하면 MP4 변환 후 관리 목록에 저장됩니다.</span></div><button className="stop-record-button" onClick={() => record('record-fullscreen')}>녹화 정지</button></div>
            : <div className="record-cards">
              <button onClick={() => record('record-region')}><Crop24Regular /><strong>영역 녹화</strong><span>크기를 조절해 원하는 영역만 녹화</span><kbd>{fmtShortcut(settings?.shortcuts.recordRegion ?? 'Ctrl+Shift+4')}</kbd></button>
              <button onClick={() => record('record-window')}><Window24Regular /><strong>창 녹화</strong><span>열려 있는 창을 선택해 녹화</span><kbd>{fmtShortcut(settings?.shortcuts.recordWindow ?? 'Ctrl+Shift+5')}</kbd></button>
              <button onClick={() => record('record-fullscreen')}><Desktop24Regular /><strong>전체 화면 녹화</strong><span>현재 모니터 전체를 바로 녹화</span><kbd>{fmtShortcut(settings?.shortcuts.recordFullscreen ?? 'Ctrl+Shift+R')}</kbd></button>
            </div>}
        </section>
      </main>
      <aside className="properties">
        <div className="properties-title">빠른 설정</div>
        <div className="property-group"><label>저장 형식</label><div className="segmented"><button className={settings?.imageFormat === 'png' ? 'is-active' : ''} onClick={() => void updateFormat('png')}>PNG</button><button className={settings?.imageFormat === 'jpg' ? 'is-active' : ''} onClick={() => void updateFormat('jpg')}>JPG</button></div></div>
        <div className="property-group"><label>저장 위치</label><div className="path-field">{settings?.saveDir ?? '불러오는 중…'}</div><button className="secondary-button" onClick={() => void window.api.media.openFolder()}><FolderOpen24Regular />폴더 열기</button></div>
      </aside>
    </div>
  </section>
}

function ManagePanel({ refreshKey, onOpen }: { refreshKey: number; onOpen: (file: MediaFile, dataUrl?: string) => void }) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [preview, setPreview] = useState<string | null>(null)
  const [videoError, setVideoError] = useState(false)
  const [query, setQuery] = useState('')
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const refresh = useCallback(async () => {
    const next = await window.api.media.list()
    setFiles(next)
    setSelectedPath((current) => next.some((f) => f.path === current) ? current : (next[0]?.path ?? ''))
  }, [])
  useEffect(() => { void refresh() }, [refresh, refreshKey])
  const visible = files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
  const selected = files.find((f) => f.path === selectedPath) ?? null
  useEffect(() => {
    setPreview(null)
    setVideoError(false)
    if (selected?.kind === 'image') void window.api.media.preview(selected.path).then(setPreview)
  }, [selected?.path, selected?.kind])
  const selectVisibleFile = useCallback((index: number): void => {
    const file = visible[index]
    if (!file) return
    setSelectedPath(file.path)
    window.requestAnimationFrame(() => {
      const row = rowRefs.current.get(file.path)
      row?.focus({ preventScroll: true })
      row?.scrollIntoView({ block: 'nearest' })
    })
  }, [visible])
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !visible.length) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, video, [contenteditable="true"]') || target?.closest('.settings-drawer')) return
      const current = visible.findIndex((file) => file.path === selectedPath)
      let next = current
      if (event.key === 'ArrowDown') next = current < 0 ? 0 : Math.min(current + 1, visible.length - 1)
      else if (event.key === 'ArrowUp') next = current < 0 ? visible.length - 1 : Math.max(current - 1, 0)
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = visible.length - 1
      else return
      event.preventDefault()
      selectVisibleFile(next)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedPath, selectVisibleFile, visible])
  const renameFile = async (): Promise<void> => {
    if (!selected) return
    const name = window.prompt('새 파일명', selected.name)
    if (!name || name === selected.name) return
    await window.api.media.rename(selected.path, name)
    await refresh()
  }
  const deleteFile = async (): Promise<void> => {
    if (!selected || !window.confirm(`삭제할까요?\n${selected.name}`)) return
    await window.api.media.delete(selected.path)
    await refresh()
  }
  return <section className="panel manage-panel">
    <div className="toolbar">
      <button className="tool-button" onClick={() => void window.api.media.openFolder()}><FolderOpen24Regular />저장 폴더 열기</button>
      <span className="toolbar-divider" />
      <button className="tool-button" disabled={!selected} onClick={() => void renameFile()}><Rename24Regular />이름 변경</button>
      <button className="tool-button danger" disabled={!selected} onClick={() => void deleteFile()}><Delete24Regular />삭제</button>
      <span className="toolbar-spacer" />
      <label className="search-box"><Filter24Regular /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="파일 검색" /></label>
      <IconButton label="목록 보기" active><List24Regular /></IconButton>
    </div>
    <div className="manage-layout">
      <div className="file-browser">
        <div className="file-header"><span>파일명</span><span>날짜</span><span>크기</span></div>
        <div className="file-list">{visible.length ? visible.map((file) => <button ref={(element) => { if (element) rowRefs.current.set(file.path, element); else rowRefs.current.delete(file.path) }} key={file.path} className={`file-row ${file.path === selectedPath ? 'is-selected' : ''}`} onClick={() => setSelectedPath(file.path)} onContextMenu={(event) => { event.preventDefault(); setSelectedPath(file.path); window.api.media.contextMenu(file.path) }}>{file.kind === 'image' ? <Image24Regular /> : <VideoClip24Regular />}<span className="file-name">{file.name}</span><span>{fmtDate(file.modifiedAt)}</span><span>{fmtSize(file.size)}</span></button>) : <div className="empty-list"><Folder24Regular /><strong>저장된 미디어가 없습니다</strong><span>캡처하거나 녹화하면 여기에 표시됩니다.</span></div>}</div>
        <div className="browser-footer">총 {visible.length}개 · {fmtSize(visible.reduce((sum, file) => sum + file.size, 0))}</div>
      </div>
      <div className="media-preview">
        {selected ? <><div className="preview-heading"><div><strong>{selected.name}</strong><span>{selected.kind === 'image' ? '이미지' : '동영상'} · {fmtSize(selected.size)}</span></div><button className="secondary-button" onClick={() => onOpen(selected, preview ?? undefined)}><Edit24Regular />{selected.kind === 'image' ? '편집에서 열기' : '프레임 편집'}</button></div><div className="preview-canvas">{selected.kind === 'image' ? (preview ? <img src={preview} alt={selected.name} /> : <div className="video-placeholder"><Image24Regular /><strong>이미지 불러오는 중…</strong></div>) : videoError ? <div className="video-placeholder"><VideoClip24Regular /><strong>이 영상은 내장 플레이어로 재생할 수 없습니다</strong><span>프레임 편집 또는 파일 위치 열기를 이용하세요.</span></div> : <video key={selected.path} src={window.api.media.url(selected.path)} controls preload="metadata" onError={() => setVideoError(true)} />}</div><div className="preview-footer"><span>{selected.path}</span><button onClick={() => void window.api.media.openFolder(selected.path)}>파일 위치 열기</button></div></> : <div className="preview-empty"><Image24Regular /><span>미리 볼 파일을 선택하세요.</span></div>}
      </div>
    </div>
  </section>
}

function EditPanel({ tool, image, imageName, videoPath, setTool, onOpenImage }: { tool: EditTool; image: string | null; imageName: string; videoPath?: string; setTool: (tool: EditTool) => void; onOpenImage: () => void }) {
  return <section className="edit-shell">
    <div className="subtabs"><button className={tool === 'image' ? 'is-active' : ''} onClick={() => setTool('image')}><Edit24Regular />이미지 편집</button><button className={tool === 'frames' ? 'is-active' : ''} onClick={() => setTool('frames')}><VideoClip24Regular />프레임 편집</button><button className={tool === 'compress' ? 'is-active' : ''} onClick={() => setTool('compress')}><ArchiveRegular />영상 압축</button></div>
    <div className="edit-content">{tool === 'image' ? <FabricEditor dataUrl={image} fileName={imageName} onOpen={onOpenImage} /> : tool === 'frames' ? <FramesEditor initialPath={videoPath} /> : <CompressTool initialPath={videoPath} />}</div>
  </section>
}

export function App() {
  const [tab, setTab] = useState<AppTab>('capture')
  const [editTool, setEditTool] = useState<EditTool>('image')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [recording, setRecording] = useState(false)
  const [capture, setCapture] = useState<CaptureCompleted | null>(null)
  const [videoPath, setVideoPath] = useState<string | undefined>()
  const [toast, setToast] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const loadSettings = useCallback(() => { void window.api.settings.get().then(setSettings) }, [])
  useEffect(loadSettings, [loadSettings])
  useEffect(() => {
    const offRecord = window.api.main.onRecordState(setRecording)
    const offNavigate = window.api.main.onNavigate((navigation: ShellNavigation) => {
      if (navigation.tab) setTab(navigation.tab)
      if (navigation.tool) setEditTool(navigation.tool)
      if (navigation.path) setVideoPath(navigation.path)
      if (navigation.settingsOpen !== undefined) setSettingsOpen(navigation.settingsOpen)
    })
    const offCapture = window.api.main.onCaptureCompleted((result) => {
      setCapture(result)
      setRefreshKey((key) => key + 1)
      if (result.openEditor) { setEditTool('image'); setTab('edit') }
      setToast(`${result.mode === 'region' ? '영역' : result.mode === 'window' ? '창' : '전체 화면'} 캡처 완료`)
      setTimeout(() => setToast(''), 2800)
    })
    return () => { offRecord(); offNavigate(); offCapture() }
  }, [])
  const openMedia = (file: MediaFile, dataUrl?: string): void => {
    if (file.kind === 'image' && dataUrl) {
      setCapture({ dataUrl, savedPath: file.path, mode: 'fullscreen', openEditor: true, createdAt: Date.now() })
      setEditTool('image')
    } else {
      setVideoPath(file.path)
      setEditTool('frames')
    }
    setTab('edit')
  }
  const openImage = async (): Promise<void> => {
    const source = await window.api.editor.pick()
    if (!source) return
    setCapture({ dataUrl: source.dataUrl, savedPath: source.path, mode: 'fullscreen', openEditor: true, createdAt: Date.now() })
    setEditTool('image')
    setTab('edit')
  }
  const captureName = capture?.savedPath?.split(/[\\/]/).pop() ?? '새 캡처'
  const toggleTray = async (): Promise<void> => {
    if (!settings) return
    const next = await window.api.settings.set({ closeToTray: !settings.closeToTray })
    setSettings(next)
  }
  return <div className="app-frame">
    <header className="titlebar">
      <nav className="tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}><Icon /><span>{label}</span></button>)}</nav>
      <div />
      <div className="titlebar-actions"><button className={`tray-toggle ${settings?.closeToTray ? 'is-on' : ''}`} aria-pressed={settings?.closeToTray ?? false} onClick={() => void toggleTray()}><span className="toggle-track"><span /></span><span>트레이 상주</span></button><IconButton label="설정" active={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}><Settings24Regular /></IconButton></div>
    </header>
    <main className="app-content">{tab === 'capture' ? <CapturePanel settings={settings} recording={recording} onRefreshSettings={loadSettings} /> : tab === 'manage' ? <ManagePanel refreshKey={refreshKey} onOpen={openMedia} /> : <EditPanel tool={editTool} image={capture?.dataUrl ?? null} imageName={captureName} videoPath={videoPath} setTool={setEditTool} onOpenImage={() => void openImage()} />}</main>
    <footer className="statusbar"><span><Checkmark24Regular />{settings?.closeToTray ? '트레이 유지 켜짐' : '창을 닫으면 종료'}</span><span className="status-path">{settings?.saveDir ?? ''}</span><span>{recording ? '녹화 중' : '준비됨'}</span></footer>
    {settingsOpen && <><button className="drawer-scrim" onClick={() => setSettingsOpen(false)} aria-label="설정 닫기" /><SettingsDrawer onClose={() => setSettingsOpen(false)} onSaved={(next) => setSettings(next)} /></>}
    {toast && <div className="toast"><Checkmark24Regular />{toast}</div>}
  </div>
}
