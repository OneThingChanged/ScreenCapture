import { useEffect, useState } from 'react'
import { ArrowSync24Regular, Dismiss24Regular, FolderOpen24Regular, Settings24Regular } from '@fluentui/react-icons'
import type { AppSettings, AppUpdateState } from '../../shared/types'

function toAccelerator(event: React.KeyboardEvent<HTMLInputElement>): string | null {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null
  const map: Record<string, string> = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Escape: 'Esc', Enter: 'Return' }
  const key = /^[a-z0-9]$/i.test(event.key) ? event.key.toUpperCase() : /^F\d{1,2}$/.test(event.key) ? event.key : map[event.key]
  if (!key) return null
  parts.push(key)
  return parts.join('+')
}

function updateMessage(state: AppUpdateState | null): string {
  if (!state) return '업데이트 정보를 불러오는 중…'
  if (state.status === 'checking') return '새 버전을 확인하는 중…'
  if (state.status === 'available') return `새 버전 v${state.availableVersion}을 사용할 수 있습니다.`
  if (state.status === 'not-available') return '현재 최신 버전입니다.'
  if (state.status === 'downloading') return `다운로드 중… ${Math.round(state.percent ?? 0)}%`
  if (state.status === 'downloaded') return '다운로드 완료 · 재시작하면 설치됩니다.'
  if (state.status === 'error') return `업데이트 오류: ${state.message ?? '알 수 없는 오류'}`
  return '새 버전이 있는지 확인할 수 있습니다.'
}

function displayShortcut(value: string): string {
  return value.replace('CommandOrControl', 'Ctrl').replaceAll('+', ' + ')
}

export function SettingsDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (settings: AppSettings) => void }) {
  const [form, setForm] = useState<AppSettings | null>(null)
  const [update, setUpdate] = useState<AppUpdateState | null>(null)
  const [saved, setSaved] = useState(false)
  const [editingShortcut, setEditingShortcut] = useState<keyof AppSettings['shortcuts'] | null>(null)
  useEffect(() => {
    void window.api.settings.get().then(setForm)
    void window.api.updater.getState().then(setUpdate)
    const offUpdate = window.api.updater.onState(setUpdate)
    return () => {
      offUpdate()
      window.api.settings.captureShortcut(false)
    }
  }, [])
  if (!form) return <aside className="settings-drawer"><div className="drawer-head"><div><Settings24Regular /><strong>설정</strong></div><button className="icon-button" onClick={onClose}><Dismiss24Regular /></button></div><div className="drawer-loading">설정을 불러오는 중…</div></aside>
  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => setForm((current) => current ? { ...current, [key]: value } : current)
  const browse = async (): Promise<void> => {
    const path = await window.api.dialog.pickFolder()
    if (path) patch('saveDir', path)
  }
  const save = async (): Promise<void> => {
    const next = await window.api.settings.set(form)
    setForm(next)
    onSaved(next)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 700)
  }
  const shortcut = (key: keyof AppSettings['shortcuts'], event: React.KeyboardEvent<HTMLInputElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (editingShortcut !== key) return
    if (event.key === 'Escape') {
      window.api.settings.captureShortcut(false)
      setEditingShortcut(null)
      event.currentTarget.blur()
      return
    }
    const value = toAccelerator(event)
    if (value) {
      setForm({ ...form, shortcuts: { ...form.shortcuts, [key]: value } })
      window.api.settings.captureShortcut(false)
      setEditingShortcut(null)
      event.currentTarget.blur()
    }
  }
  const updateAction = async (): Promise<void> => {
    if (update?.status === 'available') setUpdate(await window.api.updater.download())
    else if (update?.status === 'downloaded') window.api.updater.install()
    else setUpdate(await window.api.updater.check())
  }
  return <aside className="settings-drawer">
    <div className="drawer-head"><div><Settings24Regular /><strong>설정</strong></div><button className="icon-button" onClick={onClose} title="닫기"><Dismiss24Regular /></button></div>
    <div className="drawer-content">
      <h3>저장</h3>
      <label>저장 폴더<div className="input-with-button"><input value={form.saveDir} onChange={(e) => patch('saveDir', e.target.value)} /><button onClick={() => void browse()} title="폴더 선택"><FolderOpen24Regular /></button></div></label>
      <label>이미지 형식<select value={form.imageFormat} onChange={(e) => patch('imageFormat', e.target.value as AppSettings['imageFormat'])}><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
      {form.imageFormat === 'jpg' && <label>JPG 품질<input type="range" min="1" max="100" value={form.jpgQuality} onChange={(e) => patch('jpgQuality', Number(e.target.value))} /><span className="range-value">{form.jpgQuality}%</span></label>}
      <label className="check-row"><input type="checkbox" checked={form.copyToClipboard} onChange={(e) => patch('copyToClipboard', e.target.checked)} />클립보드에 자동 복사</label>
      <h3>녹화</h3>
      <label>기본 FPS<input type="number" min="5" max="60" value={form.recordFps} onChange={(e) => patch('recordFps', Math.max(5, Math.min(60, Number(e.target.value) || 30)))} /></label>
      <label className="check-row"><input type="checkbox" checked={form.exportMp4} onChange={(e) => patch('exportMp4', e.target.checked)} />MP4로 내보내기</label>
      <label className="check-row"><input type="checkbox" checked={form.exportGif} onChange={(e) => patch('exportGif', e.target.checked)} />GIF로 내보내기</label>
      <label className="check-row"><input type="checkbox" checked={form.keepWebm} onChange={(e) => patch('keepWebm', e.target.checked)} />원본 WebM 유지</label>
      <h3>단축키</h3>
      {([
        ['region', '영역 캡처'],
        ['window', '창 캡처'],
        ['fullscreen', '전체 화면 캡처'],
        ['recordRegion', '영역 녹화'],
        ['recordWindow', '창 녹화'],
        ['recordFullscreen', '전체 화면 녹화']
      ] as const).map(([key, label]) => <label key={key}>{label}<div className={`shortcut-editor ${editingShortcut === key ? 'is-editing' : ''}`}><input className="shortcut-input" readOnly value={editingShortcut === key ? 'Ctrl, Shift와 원하는 키를 누르세요…' : displayShortcut(form.shortcuts[key])} onKeyDownCapture={(e) => shortcut(key, e)} onBlur={() => { if (editingShortcut === key) { window.api.settings.captureShortcut(false); setEditingShortcut(null) } }} /><button type="button" onClick={(event) => { window.api.settings.captureShortcut(true); setEditingShortcut(key); const input = event.currentTarget.previousElementSibling as HTMLInputElement; window.setTimeout(() => input.focus(), 0) }}>{editingShortcut === key ? '입력 중' : '변경'}</button></div></label>)}
      <h3>업데이트</h3>
      <div className="update-card"><div><ArrowSync24Regular /><span><strong>ScreenCapture v{update?.currentVersion ?? '…'}</strong><small>{updateMessage(update)}</small></span></div><button disabled={update?.status === 'checking' || update?.status === 'downloading'} onClick={() => void updateAction()}>{update?.status === 'available' ? '다운로드' : update?.status === 'downloaded' ? '재시작' : '확인'}</button></div>
      {update?.status === 'downloading' && <progress max="100" value={update.percent ?? 0} />}
    </div>
    <div className="drawer-footer"><span>{saved ? '저장됨 ✓' : ''}</span><button className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" onClick={() => void save()}>저장</button></div>
  </aside>
}
