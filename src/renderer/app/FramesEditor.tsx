import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Delete24Regular, FolderOpen24Regular, Image24Regular, Save24Regular, VideoClip24Regular } from '@fluentui/react-icons'
import type { FramesMeta } from '../../shared/types'

export function FramesEditor({ initialPath }: { initialPath?: string }) {
  const [path, setPath] = useState<string | undefined>(initialPath)
  const [meta, setMeta] = useState<FramesMeta | null>(null)
  const [items, setItems] = useState<number[]>([])
  const [selected, setSelected] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [fps, setFps] = useState(30)
  const selectedRow = useRef<HTMLButtonElement | null>(null)
  const historyRef = useRef<Array<{ items: number[]; selected: number }>>([])
  const undo = useCallback((): void => {
    const previous = historyRef.current.pop()
    if (!previous) return
    setItems(previous.items)
    setSelected(previous.selected)
  }, [])
  useEffect(() => { if (initialPath) setPath(initialPath) }, [initialPath])
  useEffect(() => {
    if (!path) return
    historyRef.current = []
    setBusy('프레임 추출 중…')
    setMeta(null)
    void window.api.frames.extract(path).then((next) => {
      setMeta(next)
      setItems(Array.from({ length: next.count }, (_, index) => index))
      setSelected(0)
      if (next.duration > 0) setFps(Math.max(1, Math.min(60, Math.round(next.count / next.duration))))
      setBusy('')
    }).catch((error) => setBusy(`오류: ${String(error)}`))
  }, [path])
  useEffect(() => {
    if (!meta || items.length === 0) { setPreview(null); return }
    const index = items[Math.min(selected, items.length - 1)]
    void window.api.frames.getImage(meta.tempDir, index).then(setPreview)
  }, [meta, items, selected])
  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) return
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if (items.length === 0) return

      let move: ((current: number) => number) | null = null
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move = (current) => current + 1
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') move = (current) => current - 1
      else if (event.key === 'PageDown') move = (current) => current + 10
      else if (event.key === 'PageUp') move = (current) => current - 10
      else if (event.key === 'Home') move = () => 0
      else if (event.key === 'End') move = () => items.length - 1
      if (!move) return

      event.preventDefault()
      setSelected((current) => Math.max(0, Math.min(items.length - 1, move!(current))))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [items.length, undo])
  const selectedIndex = items[Math.min(selected, items.length - 1)]
  const selectedTime = useMemo(() => meta && selectedIndex !== undefined ? meta.times[selectedIndex] : 0, [meta, selectedIndex])
  const pick = async (): Promise<void> => {
    const next = await window.api.frames.pick()
    if (next) setPath(next)
  }
  const remove = (): void => {
    if (!items.length) return
    historyRef.current.push({ items: [...items], selected })
    if (historyRef.current.length > 100) historyRef.current.shift()
    const next = items.filter((_, index) => index !== selected)
    setItems(next)
    setSelected(Math.max(0, Math.min(selected, next.length - 1)))
  }
  const exportFile = async (format: 'mp4' | 'gif'): Promise<void> => {
    if (!meta || !items.length) return
    setBusy(`${format.toUpperCase()} 내보내는 중…`)
    try {
      const output = await window.api.frames.export({ tempDir: meta.tempDir, indices: items, format, fps })
      setBusy(output ? `저장됨: ${output}` : '저장을 취소했습니다.')
      setTimeout(() => setBusy(''), 3000)
    } catch (error) { setBusy(`오류: ${String(error)}`) }
  }
  return <div className="frames-editor">
    <div className="toolbar">
      <button className="tool-button" onClick={() => void pick()}><FolderOpen24Regular />영상 열기</button>
      <button className="tool-button danger" disabled={!items.length} onClick={remove}><Delete24Regular />현재 프레임 삭제</button>
      <span className="toolbar-divider" />
      <label className="compact-field">FPS<input type="number" min="1" max="60" value={fps} onChange={(e) => setFps(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} /></label>
      <span className="toolbar-spacer" /><span className="inline-status">{busy}</span>
      <button className="tool-button" disabled={!items.length} onClick={() => void exportFile('gif')}><Image24Regular />GIF 저장</button>
      <button className="tool-button primary" disabled={!items.length} onClick={() => void exportFile('mp4')}><Save24Regular />MP4 저장</button>
    </div>
    <div className="frames-layout">
      <aside className="frames-list">
        <div className="frames-list-head"><strong>프레임</strong><span>{items.length}개</span></div>
        <div className="frames-scroll">{items.map((index, position) => <button ref={position === selected ? selectedRow : null} key={index} className={position === selected ? 'is-selected' : ''} onClick={() => setSelected(position)}><span>{index + 1}</span><small>{(meta?.times[index] ?? 0).toFixed(2)}초</small></button>)}</div>
      </aside>
      <main className="frame-preview">{preview ? <img src={preview} alt={`프레임 ${selected + 1}`} /> : <div className="editor-empty"><VideoClip24Regular /><strong>영상을 열어 프레임을 편집하세요</strong><span>불필요한 프레임을 삭제한 뒤 MP4 또는 GIF로 저장할 수 있습니다.</span></div>}</main>
      <aside className="properties"><div className="properties-title">영상 정보</div><div className="meta-grid"><span>파일</span><strong title={path}>{path?.split(/[\\/]/).pop() ?? '-'}</strong><span>해상도</span><strong>{meta ? `${meta.width} × ${meta.height}` : '-'}</strong><span>길이</span><strong>{meta ? `${meta.duration.toFixed(2)}초` : '-'}</strong><span>현재 위치</span><strong>{selectedTime.toFixed(2)}초</strong></div><div className="property-group"><label>내보내기</label><p className="help-text">목록에 남아 있는 프레임 전체를 현재 순서로 인코딩합니다.</p></div></aside>
    </div>
  </div>
}
