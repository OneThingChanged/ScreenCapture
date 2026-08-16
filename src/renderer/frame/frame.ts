import type { Rect } from '../../shared/types'

const BAR_H = 36
const sizeEl = document.getElementById('size') as HTMLSpanElement
const captureBtn = document.getElementById('captureBtn') as HTMLButtonElement
const captureLabel = document.getElementById('captureLabel') as HTMLSpanElement
const recBtn = document.getElementById('recBtn') as HTMLButtonElement
const recLabel = document.getElementById('recLabel') as HTMLSpanElement
const closeBtn = document.getElementById('closeBtn') as HTMLButtonElement
const inner = document.getElementById('inner') as HTMLElement

let recording = false
let capturing = false

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
    if (recording || capturing) return
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

window.addEventListener('pointerup', (e) => {
  drag = null
  updateMouseMode(e.clientX, e.clientY)
})

// --- 캡처 및 녹화 시작/정지 ---
captureBtn.addEventListener('click', async () => {
  if (recording || capturing) return
  capturing = true
  captureBtn.disabled = true
  recBtn.disabled = true
  document.body.classList.add('capturing')
  captureLabel.textContent = '캡처 중…'
  try {
    const captured = await window.api.frame.capture(captureRect())
    document.body.dataset.lastCapture = captured ? 'success' : 'failed'
    captureLabel.textContent = captured ? '완료' : '실패'
  } catch {
    document.body.dataset.lastCapture = 'failed'
    captureLabel.textContent = '실패'
  } finally {
    window.setTimeout(() => {
      capturing = false
      captureBtn.disabled = recording
      recBtn.disabled = false
      document.body.classList.remove('capturing')
      captureLabel.textContent = '캡처'
    }, 600)
  }
})

recBtn.addEventListener('click', () => {
  if (capturing) return
  if (recording) {
    window.api.frame.stop()
  } else {
    window.api.frame.start(captureRect())
  }
})

closeBtn.addEventListener('click', () => {
  window.api.frame.close()
})

// --- 클릭 통과: 안쪽은 아래 창을 조작하고 바/리사이즈 핸들만 프레임이 받는다 ---
// setIgnoreMouseEvents({ forward: true })라 클릭 통과 중에도 mousemove는 전달된다.
let mouseIgnored: boolean | null = null
let lastMousePoint: { x: number; y: number } | null = null

function setMouseIgnored(ignore: boolean): void {
  if (mouseIgnored === ignore) return
  mouseIgnored = ignore
  document.body.dataset.mouseMode = ignore ? 'passthrough' : 'interactive'
  window.api.frame.setIgnoreMouse(ignore)
}

function updateMouseMode(x: number, y: number): void {
  lastMousePoint = { x, y }
  const target = document.elementFromPoint(x, y)
  const overControls = Boolean(target?.closest('#bar, .h'))
  setMouseIgnored(!drag && !overControls)
}

window.addEventListener('mousemove', (e) => {
  updateMouseMode(e.clientX, e.clientY)
})

// 창이 커서 아래에 생성된 직후 클릭해도 안쪽 입력을 가로채지 않는다.
setMouseIgnored(true)

window.api.frame.onRecordState((isRec) => {
  recording = isRec
  captureBtn.disabled = isRec || capturing
  document.body.classList.toggle('recording', isRec)
  recLabel.textContent = isRec ? '정지' : '녹화'
  if (lastMousePoint) updateMouseMode(lastMousePoint.x, lastMousePoint.y)
  else setMouseIgnored(true)
})
