import {
  Canvas,
  Rect,
  Ellipse,
  IText,
  PencilBrush,
  FabricImage,
  Line,
  Triangle,
  Group,
  type TPointerEventInfo,
  type TPointerEvent,
  type FabricObject
} from 'fabric'

type Tool = 'select' | 'pen' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'mosaic'

const canvasEl = document.getElementById('c') as HTMLCanvasElement
const colorInput = document.getElementById('color') as HTMLInputElement
const widthInput = document.getElementById('width') as HTMLInputElement
const status = document.getElementById('status') as HTMLSpanElement

const canvas = new Canvas(canvasEl, {
  selection: true,
  preserveObjectStacking: true,
  backgroundColor: '#000'
})

let tool: Tool = 'select'
let color = colorInput.value
let strokeWidth = Number(widthInput.value)

let displayScale = 1
let baseImageEl: HTMLImageElement | null = null

/** 현재 도구 설정 */
function setTool(t: Tool): void {
  tool = t
  canvas.isDrawingMode = t === 'pen'
  if (t === 'pen') {
    const brush = new PencilBrush(canvas)
    brush.color = color
    brush.width = strokeWidth
    canvas.freeDrawingBrush = brush
  }
  canvas.selection = t === 'select'
  canvas.forEachObject((o) => {
    o.selectable = t === 'select'
    o.evented = t === 'select'
  })
  document.querySelectorAll<HTMLButtonElement>('.tool').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === t)
  })
  canvas.requestRenderAll()
}

document.querySelectorAll<HTMLButtonElement>('.tool').forEach((b) => {
  b.addEventListener('click', () => setTool(b.dataset.tool as Tool))
})

colorInput.addEventListener('input', () => {
  color = colorInput.value
  if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.color = color
  const active = canvas.getActiveObject()
  if (active) {
    if ('stroke' in active) active.set('stroke', color)
    if (active instanceof IText) active.set('fill', color)
    canvas.requestRenderAll()
  }
})
widthInput.addEventListener('input', () => {
  strokeWidth = Number(widthInput.value)
  if (canvas.freeDrawingBrush) canvas.freeDrawingBrush.width = strokeWidth
})

// ── 이미지 로드 ───────────────────────────────────────────
window.api.editor.onLoad(async (dataUrl: string) => {
  const img = new Image()
  img.onload = async () => {
    baseImageEl = img
    const maxW = window.innerWidth - 40
    const maxH = window.innerHeight - 90
    displayScale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
    const w = Math.round(img.naturalWidth * displayScale)
    const h = Math.round(img.naturalHeight * displayScale)
    canvas.setDimensions({ width: w, height: h })

    const bg = await FabricImage.fromURL(dataUrl)
    bg.set({ scaleX: displayScale, scaleY: displayScale, selectable: false })
    canvas.backgroundImage = bg
    canvas.requestRenderAll()
  }
  img.src = dataUrl
})

// ── 도형 그리기 ───────────────────────────────────────────
let drawing: FabricObject | null = null
let origin = { x: 0, y: 0 }

function point(opt: TPointerEventInfo<TPointerEvent>): { x: number; y: number } {
  const p = canvas.getScenePoint(opt.e)
  return { x: p.x, y: p.y }
}

function makeArrow(x1: number, y1: number, x2: number, y2: number): Group {
  const line = new Line([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth,
    strokeLineCap: 'round'
  })
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  const head = new Triangle({
    left: x2,
    top: y2,
    originX: 'center',
    originY: 'center',
    width: strokeWidth * 4,
    height: strokeWidth * 4,
    fill: color,
    angle: angle + 90
  })
  return new Group([line, head])
}

canvas.on('mouse:down', (opt) => {
  if (tool === 'select' || tool === 'pen') return
  const p = point(opt)
  origin = p

  if (tool === 'text') {
    const text = new IText('텍스트', {
      left: p.x,
      top: p.y,
      fill: color,
      fontSize: Math.max(16, strokeWidth * 5),
      fontFamily: 'Segoe UI, sans-serif'
    })
    canvas.add(text)
    canvas.setActiveObject(text)
    text.enterEditing()
    text.selectAll()
    setTool('select')
    return
  }

  if (tool === 'rect') {
    drawing = new Rect({
      left: p.x, top: p.y, width: 1, height: 1,
      fill: 'transparent', stroke: color, strokeWidth
    })
  } else if (tool === 'ellipse') {
    drawing = new Ellipse({
      left: p.x, top: p.y, rx: 1, ry: 1,
      fill: 'transparent', stroke: color, strokeWidth
    })
  } else if (tool === 'arrow') {
    drawing = makeArrow(p.x, p.y, p.x + 1, p.y + 1)
  } else if (tool === 'mosaic') {
    drawing = new Rect({
      left: p.x, top: p.y, width: 1, height: 1,
      fill: 'rgba(37,99,235,0.25)', stroke: '#2563eb', strokeWidth: 1
    })
  }
  if (drawing) {
    drawing.selectable = false
    canvas.add(drawing)
  }
})

canvas.on('mouse:move', (opt) => {
  if (!drawing) return
  const p = point(opt)
  const left = Math.min(origin.x, p.x)
  const top = Math.min(origin.y, p.y)
  const w = Math.abs(p.x - origin.x)
  const h = Math.abs(p.y - origin.y)

  if (drawing instanceof Rect) {
    drawing.set({ left, top, width: w, height: h })
  } else if (drawing instanceof Ellipse) {
    drawing.set({ left, top, rx: w / 2, ry: h / 2 })
  } else if (drawing instanceof Group) {
    // arrow: 그룹 제거 후 재생성
    canvas.remove(drawing)
    drawing = makeArrow(origin.x, origin.y, p.x, p.y)
    drawing.selectable = false
    canvas.add(drawing)
  }
  canvas.requestRenderAll()
})

canvas.on('mouse:up', () => {
  if (!drawing) return
  const obj = drawing
  drawing = null

  // 너무 작으면 취소
  const w = obj.width ?? 0
  const h = obj.height ?? 0
  if (tool !== 'arrow' && w < 4 && h < 4) {
    canvas.remove(obj)
    canvas.requestRenderAll()
    return
  }

  if (tool === 'mosaic') {
    applyMosaic(obj as Rect)
    canvas.remove(obj)
  } else {
    obj.selectable = true
    obj.setCoords()
  }
  canvas.requestRenderAll()
})

/** 선택 영역을 모자이크 처리한 이미지로 덮는다 */
function applyMosaic(rect: Rect): void {
  if (!baseImageEl) return
  const left = rect.left ?? 0
  const top = rect.top ?? 0
  const w = rect.width ?? 0
  const h = rect.height ?? 0
  if (w < 4 || h < 4) return

  // 캔버스 좌표 → 원본 이미지 픽셀 좌표
  const sx = left / displayScale
  const sy = top / displayScale
  const sw = w / displayScale
  const sh = h / displayScale

  const block = 12 // 모자이크 블록 크기(원본 px 기준)
  const smallW = Math.max(1, Math.round(sw / block))
  const smallH = Math.max(1, Math.round(sh / block))

  const small = document.createElement('canvas')
  small.width = smallW
  small.height = smallH
  const sctx = small.getContext('2d')!
  sctx.drawImage(baseImageEl, sx, sy, sw, sh, 0, 0, smallW, smallH)

  const big = document.createElement('canvas')
  big.width = Math.round(sw)
  big.height = Math.round(sh)
  const bctx = big.getContext('2d')!
  bctx.imageSmoothingEnabled = false
  bctx.drawImage(small, 0, 0, smallW, smallH, 0, 0, big.width, big.height)

  const mosaicImg = new FabricImage(big, {
    left,
    top,
    scaleX: displayScale,
    scaleY: displayScale,
    selectable: tool === 'select'
  })
  canvas.add(mosaicImg)
}

// ── 액션 ─────────────────────────────────────────────────
document.getElementById('home')!.addEventListener('click', () => {
  window.api.main.home()
})

document.getElementById('undo')!.addEventListener('click', () => {
  const objs = canvas.getObjects()
  if (objs.length) {
    canvas.remove(objs[objs.length - 1])
    canvas.requestRenderAll()
  }
})

document.getElementById('clear')!.addEventListener('click', () => {
  canvas.remove(...canvas.getObjects())
  canvas.requestRenderAll()
})

function exportDataUrl(): string {
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  return canvas.toDataURL({
    format: 'png',
    multiplier: 1 / displayScale
  })
}

document.getElementById('save')!.addEventListener('click', async () => {
  const path = await window.api.editor.save(exportDataUrl())
  status.textContent = path ? '저장됨 ✓' : '저장 실패'
  setTimeout(() => (status.textContent = ''), 2000)
})

document.getElementById('copy')!.addEventListener('click', async () => {
  await window.api.editor.copy(exportDataUrl())
  status.textContent = '복사됨 ✓'
  setTimeout(() => (status.textContent = ''), 2000)
})

// 단축키: Ctrl+S 저장, Ctrl+Z 취소, Esc 닫기
window.addEventListener('keydown', (e) => {
  const editing = canvas.getActiveObject() instanceof IText &&
    (canvas.getActiveObject() as IText).isEditing
  if (editing) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    ;(document.getElementById('save') as HTMLButtonElement).click()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    ;(document.getElementById('undo') as HTMLButtonElement).click()
  } else if (e.key === 'Escape') {
    window.api.editor.close()
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && tool === 'select') {
    const active = canvas.getActiveObjects()
    if (active.length) {
      canvas.remove(...active)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
    }
  }
})

// 자동 테스트: 도형 몇 개 추가 후 저장
window.api.editor.onSelftest(async () => {
  canvas.add(
    new Rect({ left: 40, top: 40, width: 120, height: 80, fill: 'transparent', stroke: color, strokeWidth })
  )
  canvas.add(makeArrow(60, 200, 220, 260))
  const t = new IText('테스트', { left: 60, top: 120, fill: color, fontSize: 28 })
  canvas.add(t)
  canvas.requestRenderAll()
  await window.api.editor.save(exportDataUrl())
})

setTool('select')
