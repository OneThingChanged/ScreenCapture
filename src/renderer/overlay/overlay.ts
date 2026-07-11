import type { OverlaySource, OverlayResult } from '../../shared/types'

const freeze = document.getElementById('freeze') as HTMLImageElement
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const hint = document.getElementById('hint') as HTMLDivElement
const sizeLabel = document.getElementById('size') as HTMLDivElement
const ctx = canvas.getContext('2d')!

let scaleFactor = 1
let dragging = false
let start = { x: 0, y: 0 }
let cur = { x: 0, y: 0 }
let submitted = false

function setupCanvas(): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function rectOf(): { x: number; y: number; w: number; h: number } {
  const x = Math.min(start.x, cur.x)
  const y = Math.min(start.y, cur.y)
  const w = Math.abs(cur.x - start.x)
  const h = Math.abs(cur.y - start.y)
  return { x, y, w, h }
}

function draw(): void {
  const W = window.innerWidth
  const H = window.innerHeight
  ctx.clearRect(0, 0, W, H)
  // 전체 디밍
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, H)

  if (!dragging) return
  const r = rectOf()
  // 선택 영역은 디밍 제거 → 뒤의 freeze 이미지가 밝게 보임
  ctx.clearRect(r.x, r.y, r.w, r.h)
  // 테두리
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 1.5
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h)

  // 물리 픽셀 크기 라벨
  const pw = Math.round(r.w * scaleFactor)
  const ph = Math.round(r.h * scaleFactor)
  sizeLabel.textContent = `${pw} × ${ph}`
  sizeLabel.style.display = 'block'
  let ly = r.y - 24
  if (ly < 4) ly = r.y + 6
  sizeLabel.style.left = `${r.x}px`
  sizeLabel.style.top = `${ly}px`
}

function submit(result: OverlayResult): void {
  if (submitted) return
  submitted = true
  window.api.overlay.submit(result)
}

window.api.overlay.onInit((source: OverlaySource) => {
  scaleFactor = source.scaleFactor
  freeze.src = source.thumbnailDataUrl
  setupCanvas()
  draw()
  // 자동 테스트: 지정된 영역 즉시 제출
  if (source.testRect) {
    const t = source.testRect
    submit({ cancelled: false, rect: t })
  }
})

window.addEventListener('resize', () => {
  setupCanvas()
  draw()
})

canvas.addEventListener('mousedown', (e) => {
  dragging = true
  start = { x: e.clientX, y: e.clientY }
  cur = { ...start }
  hint.style.display = 'none'
  draw()
})

window.addEventListener('mousemove', (e) => {
  if (!dragging) return
  cur = { x: e.clientX, y: e.clientY }
  draw()
})

window.addEventListener('mouseup', () => {
  if (!dragging) return
  dragging = false
  const r = rectOf()
  if (r.w < 3 || r.h < 3) {
    // 너무 작으면 무시하고 다시 선택 가능
    sizeLabel.style.display = 'none'
    hint.style.display = 'block'
    draw()
    return
  }
  submit({ cancelled: false, rect: { x: r.x, y: r.y, width: r.w, height: r.h } })
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') submit({ cancelled: true })
})
