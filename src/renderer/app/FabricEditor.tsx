import { useEffect, useRef, useState } from 'react'
import {
  ArrowReply24Regular,
  ArrowTrending24Regular,
  Circle24Regular,
  Copy24Regular,
  Delete24Regular,
  DrawShape24Regular,
  Image24Regular,
  FolderOpen24Regular,
  Pen24Regular,
  Save24Regular,
  SelectObject24Regular,
  TextFont24Regular
} from '@fluentui/react-icons'
import {
  Canvas as FabricCanvas,
  Ellipse,
  FabricImage,
  Group,
  IText,
  Line,
  PencilBrush,
  Rect,
  Triangle,
  type FabricObject,
  type TPointerEvent,
  type TPointerEventInfo
} from 'fabric'

type Tool = 'select' | 'pen' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'mosaic'

export function FabricEditor({ dataUrl, fileName, onOpen }: { dataUrl: string | null; fileName: string; onOpen: () => void }) {
  const canvasNode = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<FabricCanvas | null>(null)
  const baseImageRef = useRef<HTMLImageElement | null>(null)
  const scaleRef = useRef(1)
  const toolRef = useRef<Tool>('select')
  const colorRef = useRef('#ff4d5f')
  const widthRef = useRef(4)
  const [tool, setToolState] = useState<Tool>('select')
  const [color, setColor] = useState('#ff4d5f')
  const [width, setWidth] = useState(4)
  const [status, setStatus] = useState('')

  const setTool = (next: Tool): void => {
    toolRef.current = next
    setToolState(next)
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.isDrawingMode = next === 'pen'
    if (next === 'pen') {
      const brush = new PencilBrush(canvas)
      brush.color = colorRef.current
      brush.width = widthRef.current
      canvas.freeDrawingBrush = brush
    }
    canvas.selection = next === 'select'
    canvas.forEachObject((object) => {
      object.selectable = next === 'select'
      object.evented = next === 'select'
    })
    canvas.requestRenderAll()
  }

  useEffect(() => {
    colorRef.current = color
    if (canvasRef.current?.freeDrawingBrush) canvasRef.current.freeDrawingBrush.color = color
    const active = canvasRef.current?.getActiveObject()
    if (active) {
      if ('stroke' in active) active.set('stroke', color)
      if (active instanceof IText) active.set('fill', color)
      canvasRef.current?.requestRenderAll()
    }
  }, [color])

  useEffect(() => {
    widthRef.current = width
    if (canvasRef.current?.freeDrawingBrush) canvasRef.current.freeDrawingBrush.width = width
  }, [width])

  useEffect(() => {
    if (!canvasNode.current) return
    const canvas = new FabricCanvas(canvasNode.current, { selection: true, preserveObjectStacking: true, backgroundColor: '#090b0f' })
    canvasRef.current = canvas
    let drawing: FabricObject | null = null
    let origin = { x: 0, y: 0 }
    const point = (opt: TPointerEventInfo<TPointerEvent>): { x: number; y: number } => {
      const p = canvas.getScenePoint(opt.e)
      return { x: p.x, y: p.y }
    }
    const makeArrow = (x1: number, y1: number, x2: number, y2: number): Group => {
      const line = new Line([x1, y1, x2, y2], { stroke: colorRef.current, strokeWidth: widthRef.current, strokeLineCap: 'round' })
      const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
      const head = new Triangle({ left: x2, top: y2, originX: 'center', originY: 'center', width: widthRef.current * 4, height: widthRef.current * 4, fill: colorRef.current, angle: angle + 90 })
      return new Group([line, head])
    }
    const applyMosaic = (rect: Rect): void => {
      const source = baseImageRef.current
      if (!source) return
      const left = rect.left ?? 0
      const top = rect.top ?? 0
      const w = rect.width ?? 0
      const h = rect.height ?? 0
      if (w < 4 || h < 4) return
      const displayScale = scaleRef.current
      const sx = left / displayScale
      const sy = top / displayScale
      const sw = w / displayScale
      const sh = h / displayScale
      const small = document.createElement('canvas')
      small.width = Math.max(1, Math.round(sw / 12))
      small.height = Math.max(1, Math.round(sh / 12))
      small.getContext('2d')!.drawImage(source, sx, sy, sw, sh, 0, 0, small.width, small.height)
      const large = document.createElement('canvas')
      large.width = Math.round(sw)
      large.height = Math.round(sh)
      const context = large.getContext('2d')!
      context.imageSmoothingEnabled = false
      context.drawImage(small, 0, 0, small.width, small.height, 0, 0, large.width, large.height)
      canvas.add(new FabricImage(large, { left, top, scaleX: displayScale, scaleY: displayScale, selectable: toolRef.current === 'select' }))
    }
    canvas.on('mouse:down', (opt) => {
      const current = toolRef.current
      if (current === 'select' || current === 'pen') return
      const p = point(opt)
      origin = p
      if (current === 'text') {
        const text = new IText('텍스트', { left: p.x, top: p.y, fill: colorRef.current, fontSize: Math.max(16, widthRef.current * 5), fontFamily: 'Segoe UI' })
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        text.selectAll()
        setTool('select')
        return
      }
      if (current === 'rect') drawing = new Rect({ left: p.x, top: p.y, width: 1, height: 1, fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current })
      else if (current === 'ellipse') drawing = new Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, fill: 'transparent', stroke: colorRef.current, strokeWidth: widthRef.current })
      else if (current === 'arrow') drawing = makeArrow(p.x, p.y, p.x + 1, p.y + 1)
      else drawing = new Rect({ left: p.x, top: p.y, width: 1, height: 1, fill: 'rgba(48,137,255,.22)', stroke: '#3089ff', strokeWidth: 1 })
      if (drawing) { drawing.selectable = false; canvas.add(drawing) }
    })
    canvas.on('mouse:move', (opt) => {
      if (!drawing) return
      const p = point(opt)
      const left = Math.min(origin.x, p.x)
      const top = Math.min(origin.y, p.y)
      const w = Math.abs(p.x - origin.x)
      const h = Math.abs(p.y - origin.y)
      if (drawing instanceof Rect) drawing.set({ left, top, width: w, height: h })
      else if (drawing instanceof Ellipse) drawing.set({ left, top, rx: w / 2, ry: h / 2 })
      else if (drawing instanceof Group) { canvas.remove(drawing); drawing = makeArrow(origin.x, origin.y, p.x, p.y); drawing.selectable = false; canvas.add(drawing) }
      canvas.requestRenderAll()
    })
    canvas.on('mouse:up', () => {
      if (!drawing) return
      const object = drawing
      drawing = null
      if (toolRef.current === 'mosaic') { applyMosaic(object as Rect); canvas.remove(object) }
      else { object.selectable = true; object.setCoords() }
      canvas.requestRenderAll()
    })
    setTool('select')
    return () => { canvas.dispose(); canvasRef.current = null }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !dataUrl) return
    const image = new Image()
    image.onload = () => {
      baseImageRef.current = image
      const maxWidth = Math.max(320, (stage.current?.clientWidth ?? 900) - 42)
      const maxHeight = Math.max(240, (stage.current?.clientHeight ?? 600) - 54)
      const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
      scaleRef.current = scale
      canvas.clear()
      canvas.setDimensions({ width: Math.round(image.naturalWidth * scale), height: Math.round(image.naturalHeight * scale) })
      void FabricImage.fromURL(dataUrl).then((background) => {
        background.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false })
        canvas.backgroundImage = background
        canvas.requestRenderAll()
      })
    }
    image.src = dataUrl
  }, [dataUrl])

  const exportImage = (): string | null => {
    const canvas = canvasRef.current
    if (!canvas || !dataUrl) return null
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    return canvas.toDataURL({ format: 'png', multiplier: 1 / scaleRef.current })
  }
  const save = async (): Promise<void> => {
    const result = exportImage()
    if (!result) return
    const path = await window.api.editor.save(result)
    setStatus(path ? '저장됨' : '저장 실패')
    setTimeout(() => setStatus(''), 1800)
  }
  const copy = async (): Promise<void> => {
    const result = exportImage()
    if (!result) return
    await window.api.editor.copy(result)
    setStatus('클립보드에 복사됨')
    setTimeout(() => setStatus(''), 1800)
  }
  const removeLast = (): void => {
    const canvas = canvasRef.current
    if (!canvas) return
    const objects = canvas.getObjects()
    if (objects.length) canvas.remove(objects[objects.length - 1])
    canvas.requestRenderAll()
  }
  const clear = (): void => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.remove(...canvas.getObjects())
    canvas.requestRenderAll()
  }
  const tools: [Tool, string, typeof SelectObject24Regular][] = [
    ['select', '선택', SelectObject24Regular], ['pen', '펜', Pen24Regular], ['arrow', '화살표', ArrowTrending24Regular], ['rect', '사각형', DrawShape24Regular], ['ellipse', '원', Circle24Regular], ['text', '텍스트', TextFont24Regular], ['mosaic', '모자이크', Image24Regular]
  ]
  return <div className="image-editor">
    <div className="toolbar editor-toolbar">
      <button className="tool-button" onClick={onOpen}><FolderOpen24Regular />이미지 열기</button>
      <span className="toolbar-divider" />
      <button className="tool-button" onClick={removeLast}><ArrowReply24Regular />실행 취소</button>
      <button className="tool-button danger" onClick={clear}><Delete24Regular />주석 삭제</button>
      <span className="toolbar-divider" />
      <label className="compact-field">색상<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      <label className="compact-field">굵기<input className="width-range" type="range" min="1" max="40" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
      <span className="toolbar-spacer" /><span className="inline-status">{status}</span>
      <button className="tool-button" disabled={!dataUrl} onClick={() => void copy()}><Copy24Regular />복사</button>
      <button className="tool-button primary" disabled={!dataUrl} onClick={() => void save()}><Save24Regular />저장</button>
    </div>
    <div className="edit-layout">
      <aside className="edit-rail">{tools.map(([id, label, Icon]) => <button key={id} className={`icon-button ${tool === id ? 'is-active' : ''}`} title={label} onClick={() => setTool(id)}><Icon /></button>)}</aside>
      <main className="edit-workspace" ref={stage}>
        <div className="document-bar"><strong>{fileName}</strong><span>{dataUrl ? '주석을 추가한 뒤 저장하세요' : '캡처 또는 관리 탭에서 이미지를 여세요'}</span></div>
        <div className={`artboard ${dataUrl ? '' : 'is-empty'}`}>{!dataUrl && <div className="editor-empty"><Image24Regular /><strong>편집할 이미지가 없습니다</strong><span>캡처 결과를 사용하거나 이미지 파일을 직접 여세요.</span><button className="secondary-button" onClick={onOpen}><FolderOpen24Regular />이미지 열기</button></div>}<div className="canvas-wrap" style={{ display: dataUrl ? 'block' : 'none' }}><canvas ref={canvasNode} /></div></div>
      </main>
      <aside className="properties editor-properties"><div className="properties-title">편집 도구</div><div className="editor-help"><strong>{tools.find(([id]) => id === tool)?.[1]}</strong><p>{tool === 'select' ? '개체를 선택해 이동하거나 크기를 조절합니다.' : tool === 'mosaic' ? '가릴 영역을 드래그하면 픽셀 처리됩니다.' : '캔버스 위에서 드래그해 주석을 추가합니다.'}</p></div><div className="layer-section"><span>원본 이미지</span><small>배경 레이어 · 잠김</small></div></aside>
    </div>
  </div>
}
