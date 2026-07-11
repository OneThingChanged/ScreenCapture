import type { Rect } from '../../shared/types'

const BAR_H = 36
const sizeEl = document.getElementById('size') as HTMLSpanElement
const recBtn = document.getElementById('recBtn') as HTMLButtonElement
const recLabel = document.getElementById('recLabel') as HTMLSpanElement
const closeBtn = document.getElementById('closeBtn') as HTMLButtonElement
const inner = document.getElementById('inner') as HTMLElement

let recording = false

/** 실제 녹화될 영역(테두리 안쪽)의 화면 절대 좌표(DIP) */
function captureRect(): Rect {
  const r = inner.getBoundingClientRect()
  return {
    x: Math.round(window.screenX + r.left),
    y: Math.round(window.screenY + r.top),
    width: Math.round(r.width),
    height: Math.round(r.height)
  }
}

function updateSize(): void {
  const r = inner.getBoundingClientRect()
  sizeEl.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`
}
new ResizeObserver(updateSize).observe(document.body)
updateSize()

// --- 리사이즈 핸들 ---
interface DragState {
  dir: string
  startX: number
  startY: number
  x: number
  y: number
  w: number
  h: number
}
let drag: DragState | null = null
const MIN_W = 160
const MIN_H = BAR_H + 80

document.querySelectorAll<HTMLElement>('.h').forEach((handle) => {
  handle.addEventListener('pointerdown', (e) => {
    if (recording) return
    e.preventDefault()
    handle.setPointerCapture(e.pointerId)
    drag = {
      dir: handle.dataset.dir!,
      startX: e.screenX,
      startY: e.screenY,
      x: window.screenX,
      y: window.screenY,
      w: window.innerWidth,
      h: window.innerHeight
    }
  })
})

window.addEventListener('pointermove', (e) => {
  if (!drag) return
  const dx = e.screenX - drag.startX
  const dy = e.screenY - drag.startY
  let { x, y, w, h } = drag

  if (drag.dir.includes('e')) w = drag.w + dx
  if (drag.dir.includes('s')) h = drag.h + dy
  if (drag.dir.includes('w')) {
    w = drag.w - dx
    x = drag.x + dx
  }
  if (drag.dir.includes('n')) {
    h = drag.h - dy
    y = drag.y + dy
  }

  // 최소 크기 보장 (왼/위로 줄일 때 위치 보정)
  if (w < MIN_W) {
    if (drag.dir.includes('w')) x -= MIN_W - w
    w = MIN_W
  }
  if (h < MIN_H) {
    if (drag.dir.includes('n')) y -= MIN_H - h
    h = MIN_H
  }

  window.api.frame.setBounds({ x, y, width: w, height: h })
})

window.addEventListener('pointerup', () => {
  drag = null
})

// --- 녹화 시작/정지 ---
recBtn.addEventListener('click', () => {
  if (recording) {
    window.api.frame.stop()
  } else {
    window.api.frame.start(captureRect())
  }
})

closeBtn.addEventListener('click', () => {
  window.api.frame.close()
})

// --- 녹화 중 클릭 통과: 컨트롤 바 위에서만 클릭 가능, 영역 안은 아래 앱으로 통과 ---
// (setIgnoreMouseEvents forward 모드라 ignore 중에도 mousemove 는 전달됨)
let overBar = false
window.addEventListener('mousemove', (e) => {
  if (!recording) return
  const onBar = e.clientY <= BAR_H
  if (onBar !== overBar) {
    overBar = onBar
    window.api.frame.setIgnoreMouse(!onBar)
  }
})

window.api.frame.onRecordState((isRec) => {
  recording = isRec
  document.body.classList.toggle('recording', isRec)
  recLabel.textContent = isRec ? '정지' : '녹화'
  overBar = false
  // 녹화 중에는 기본적으로 클릭 통과(true), 정지 후엔 다시 조작 가능(false)
  window.api.frame.setIgnoreMouse(isRec)
})
