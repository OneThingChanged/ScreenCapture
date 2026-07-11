import type { FramesMeta } from '../../shared/types'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const openBtn = $<HTMLButtonElement>('openBtn')
const infoSize = $<HTMLElement>('infoSize')
const infoCount = $<HTMLElement>('infoCount')
const infoDur = $<HTMLElement>('infoDur')
const rows = $<HTMLDivElement>('rows')
const previewImg = $<HTMLImageElement>('previewImg')
const empty = $<HTMLDivElement>('empty')
const busy = $<HTMLDivElement>('busy')
const selInfo = $<HTMLSpanElement>('selInfo')
const checkAll = $<HTMLButtonElement>('checkAll')
const fpsInput = $<HTMLInputElement>('fps')
const exportGif = $<HTMLButtonElement>('exportGif')
const exportMp4 = $<HTMLButtonElement>('exportMp4')

$<HTMLButtonElement>('home').addEventListener('click', () => {
  window.api.main.home()
})

interface FrameItem {
  idx: number // 원본 프레임 파일 인덱스 (0-based, f_{idx+1}.png)
  time: number
}

let meta: FramesMeta | null = null
let items: FrameItem[] = []
let cur = -1 // 현재 미리보기 중인 items 내 위치
let anchor = -1 // shift 범위 선택 기준 위치
const checked = new Set<number>() // 선택된 원본 idx 집합 (저장/삭제 대상)

function fmtTime(sec: number): string {
  return `${sec.toFixed(2)}s`
}

function setBusy(on: boolean, text = '프레임 추출 중…'): void {
  busy.textContent = text
  busy.classList.toggle('on', on)
}

function updateSelInfo(): void {
  const n = checked.size
  const base = n > 0 ? `${n}개 선택됨` : '선택 없음'
  selInfo.textContent = `${base} · 남은 프레임 ${items.length}개`
  const hasFrames = items.length > 0
  exportGif.disabled = !hasFrames
  exportMp4.disabled = !hasFrames
  checkAll.textContent =
    items.length > 0 && checked.size >= items.length ? '전체 해제' : '전체 선택'
}

/** 행들의 선택/현재 표시 및 체크박스 상태 동기화 */
function refreshRowStates(): void {
  document.querySelectorAll<HTMLElement>('.row').forEach((r) => {
    const pos = Number(r.dataset.pos)
    const idx = items[pos]?.idx
    const isSel = idx !== undefined && checked.has(idx)
    r.classList.toggle('sel', isSel)
    r.classList.toggle('cur', pos === cur)
    const cb = r.querySelector<HTMLInputElement>('input')
    if (cb) cb.checked = isSel
  })
}

async function previewPos(pos: number, scrollIntoView = false): Promise<void> {
  if (!meta || pos < 0 || pos >= items.length) return
  cur = pos
  refreshRowStates()
  if (scrollIntoView) {
    document
      .querySelector<HTMLElement>(`.row[data-pos="${pos}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }
  const dataUrl = await window.api.frames.getImage(meta.tempDir, items[pos].idx)
  previewImg.src = dataUrl
  previewImg.style.display = ''
  empty.style.display = 'none'
}

/** 단일 선택 (다른 선택 해제) */
function selectSingle(pos: number): void {
  checked.clear()
  if (items[pos]) checked.add(items[pos].idx)
  anchor = pos
  void previewPos(pos)
  updateSelInfo()
}

/** anchor~pos 범위 선택 (Shift) */
function selectRange(pos: number): void {
  if (anchor < 0) anchor = pos
  const a = Math.min(anchor, pos)
  const b = Math.max(anchor, pos)
  checked.clear()
  for (let p = a; p <= b; p++) if (items[p]) checked.add(items[p].idx)
  void previewPos(pos)
  updateSelInfo()
}

/** 토글 선택 (Ctrl) */
function toggle(pos: number): void {
  const idx = items[pos]?.idx
  if (idx === undefined) return
  if (checked.has(idx)) checked.delete(idx)
  else checked.add(idx)
  anchor = pos
  void previewPos(pos)
  updateSelInfo()
}

function buildList(): void {
  const frag = document.createDocumentFragment()
  items.forEach((it, pos) => {
    const row = document.createElement('div')
    row.className = 'row'
    row.dataset.pos = String(pos)
    row.dataset.idx = String(it.idx)

    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = checked.has(it.idx)
    cb.addEventListener('click', (e) => {
      e.stopPropagation()
      toggle(Number(row.dataset.pos))
    })

    const num = document.createElement('span')
    num.className = 'num'
    num.textContent = String(it.idx + 1)

    const t = document.createElement('span')
    t.className = 't'
    t.textContent = fmtTime(it.time)

    row.append(cb, num, t)
    row.addEventListener('click', (e) => {
      const p = Number(row.dataset.pos)
      if (e.shiftKey) selectRange(p)
      else if (e.ctrlKey || e.metaKey) toggle(p)
      else selectSingle(p)
    })
    frag.appendChild(row)
  })
  rows.innerHTML = ''
  rows.appendChild(frag)
}

/** 선택(또는 현재) 프레임을 목록에서 삭제 */
function deleteSelected(): void {
  if (items.length === 0) return
  const removeIdx =
    checked.size > 0
      ? new Set(checked)
      : cur >= 0 && items[cur]
        ? new Set([items[cur].idx])
        : new Set<number>()
  if (removeIdx.size === 0) return

  const prevPos = cur
  items = items.filter((it) => !removeIdx.has(it.idx))
  checked.clear()
  anchor = -1

  infoCount.textContent = `${items.length}`
  buildList()

  if (items.length === 0) {
    cur = -1
    previewImg.style.display = 'none'
    empty.style.display = ''
    empty.textContent = '프레임이 모두 삭제되었습니다.'
    updateSelInfo()
    return
  }
  // 삭제 후 가까운 위치를 미리보기
  const nextPos = Math.max(0, Math.min(items.length - 1, prevPos))
  void previewPos(nextPos, true)
  updateSelInfo()
}

async function loadVideo(path: string): Promise<void> {
  setBusy(true)
  previewImg.style.display = 'none'
  empty.style.display = ''
  rows.innerHTML = ''
  checked.clear()
  cur = -1
  anchor = -1
  try {
    meta = await window.api.frames.extract(path)
    items = meta.times.map((time, idx) => ({ idx, time }))
    infoSize.textContent = `${meta.width}×${meta.height}`
    infoCount.textContent = `${items.length}`
    infoDur.textContent = fmtTime(meta.duration)
    // 영상에서 추정한 평균 FPS 를 기본값으로
    if (meta.duration > 0 && items.length > 1) {
      fpsInput.value = String(Math.max(1, Math.min(60, Math.round(items.length / meta.duration))))
    }
    buildList()
    updateSelInfo()
    if (items.length > 0) selectSingle(0)
  } catch (err) {
    setBusy(true, `오류: ${String(err)}`)
    setTimeout(() => setBusy(false), 2500)
    return
  }
  setBusy(false)
}

openBtn.addEventListener('click', async () => {
  const path = await window.api.frames.pick()
  if (path) void loadVideo(path)
})

checkAll.addEventListener('click', () => {
  const selectAll = checked.size < items.length
  checked.clear()
  if (selectAll) for (const it of items) checked.add(it.idx)
  refreshRowStates()
  updateSelInfo()
})

async function doExport(format: 'mp4' | 'gif'): Promise<void> {
  if (!meta || items.length === 0) return
  const fps = Math.max(1, Math.min(60, Number(fpsInput.value) || 30))
  const indices = items.map((it) => it.idx) // 남아있는 프레임 전체를 순서대로
  setBusy(true, `${format.toUpperCase()} 내보내는 중… (${indices.length}프레임)`)
  try {
    const out = await window.api.frames.export({ tempDir: meta.tempDir, indices, format, fps })
    setBusy(true, `저장됨: ${out}`)
    setTimeout(() => setBusy(false), 2200)
  } catch (err) {
    setBusy(true, `오류: ${String(err)}`)
    setTimeout(() => setBusy(false), 3000)
  }
}

exportMp4.addEventListener('click', () => void doExport('mp4'))
exportGif.addEventListener('click', () => void doExport('gif'))

// 키보드: 방향키 이동 / Shift 범위 / Delete 삭제
window.addEventListener('keydown', (e) => {
  // FPS 입력칸에서는 키 입력을 가로채지 않는다
  if (e.target === fpsInput) return
  if (items.length === 0) return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    deleteSelected()
    return
  }

  let next = cur
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = cur + 1
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = cur - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = items.length - 1
  else if (e.key === 'PageDown') next = cur + 10
  else if (e.key === 'PageUp') next = cur - 10
  else return

  e.preventDefault()
  next = Math.max(0, Math.min(items.length - 1, next))
  if (next === cur && cur >= 0) return

  if (e.shiftKey) {
    if (anchor < 0) anchor = cur
    cur = next
    selectRange(next)
    document
      .querySelector<HTMLElement>(`.row[data-pos="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  } else {
    selectSingle(next)
    document
      .querySelector<HTMLElement>(`.row[data-pos="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }
})

// 녹화 직후 자동 로드
window.api.frames.onInit((videoPath) => {
  void loadVideo(videoPath)
})
