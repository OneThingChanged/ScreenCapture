import { useEffect, useState } from 'react'
import { ArchiveRegular, FolderOpen24Regular, VideoClip24Regular } from '@fluentui/react-icons'
import type { CompressInfo, CompressResult } from '../../shared/types'

function fmtSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function CompressTool({ initialPath }: { initialPath?: string }) {
  const [path, setPath] = useState<string | undefined>(initialPath)
  const [info, setInfo] = useState<CompressInfo | null>(null)
  const [result, setResult] = useState<CompressResult | null>(null)
  const [crf, setCrf] = useState(23)
  const [height, setHeight] = useState(0)
  const [preset, setPreset] = useState('medium')
  const [status, setStatus] = useState('')
  useEffect(() => { if (initialPath) setPath(initialPath) }, [initialPath])
  useEffect(() => {
    if (!path) return
    setStatus('영상 정보 읽는 중…')
    setResult(null)
    void window.api.compress.info(path).then((next) => { setInfo(next); setStatus('') }).catch((error) => setStatus(`오류: ${String(error)}`))
  }, [path])
  const pick = async (): Promise<void> => {
    const next = await window.api.compress.pick()
    if (next) setPath(next)
  }
  const run = async (): Promise<void> => {
    if (!info) return
    setStatus('압축 중… 영상 길이에 따라 시간이 걸릴 수 있습니다.')
    setResult(null)
    try {
      const next = await window.api.compress.run({ input: info.path, crf, scaleHeight: height, preset })
      setResult(next)
      setStatus(`저장됨: ${next.output}`)
    } catch (error) { setStatus(`오류: ${String(error)}`) }
  }
  const decrease = result && result.originalSize > 0 ? Math.round((1 - result.newSize / result.originalSize) * 100) : null
  return <div className="compress-tool">
    <div className="toolbar"><button className="tool-button" onClick={() => void pick()}><FolderOpen24Regular />영상 선택</button><span className="toolbar-spacer" /><span className="inline-status">{status}</span><button className="tool-button primary" disabled={!info || status.startsWith('압축 중')} onClick={() => void run()}><ArchiveRegular />압축 시작</button></div>
    <div className="compress-body">
      <section className="compress-card source-card"><div className="large-icon"><VideoClip24Regular /></div><div><span className="eyebrow">SOURCE VIDEO</span><h2>{info?.path.split(/[\\/]/).pop() ?? '압축할 영상을 선택하세요'}</h2><p>{info ? `${fmtSize(info.size)} · ${info.width} × ${info.height} · ${info.duration.toFixed(1)}초` : 'MP4, WebM, MKV, MOV, AVI 형식을 지원합니다.'}</p></div><button className="secondary-button" onClick={() => void pick()}><FolderOpen24Regular />찾아보기</button></section>
      <div className="compress-grid"><section className="compress-card"><h3>압축 설정</h3><label>화질 (CRF)<input type="range" min="18" max="32" value={crf} onChange={(e) => setCrf(Number(e.target.value))} /><span>{crf}</span></label><label>출력 해상도<select value={height} onChange={(e) => setHeight(Number(e.target.value))}><option value="0">원본 유지</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label><label>인코딩 속도<select value={preset} onChange={(e) => setPreset(e.target.value)}><option value="veryfast">빠르게</option><option value="medium">균형</option><option value="slow">용량 우선</option></select></label></section><section className="compress-card result-card"><h3>압축 결과</h3>{result ? <><strong className="saving-rate">{decrease}% 감소</strong><p>{fmtSize(result.originalSize)} → {fmtSize(result.newSize)}</p><small>{result.output}</small></> : <div className="result-empty"><ArchiveRegular /><span>압축 후 결과가 여기에 표시됩니다.</span></div>}</section></div>
    </div>
  </div>
}
