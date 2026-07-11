import type { CompressInfo } from '../../shared/types'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const pick = $<HTMLButtonElement>('pick')
const fileName = $<HTMLSpanElement>('fileName')
const meta = $<HTMLDivElement>('meta')
const mSize = $<HTMLElement>('mSize')
const mDim = $<HTMLElement>('mDim')
const mDur = $<HTMLElement>('mDur')
const quality = $<HTMLSelectElement>('quality')
const scale = $<HTMLSelectElement>('scale')
const preset = $<HTMLSelectElement>('preset')
const run = $<HTMLButtonElement>('run')
const status = $<HTMLDivElement>('status')
const result = $<HTMLDivElement>('result')
const rPct = $<HTMLDivElement>('rPct')
const rSizes = $<HTMLDivElement>('rSizes')

$<HTMLButtonElement>('home').addEventListener('click', () => {
  window.api.main.home()
})

let current: CompressInfo | null = null

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

async function loadFile(path: string): Promise<void> {
  status.textContent = '정보 읽는 중…'
  result.classList.remove('on')
  try {
    current = await window.api.compress.info(path)
    fileName.textContent = path
    mSize.textContent = fmtSize(current.size)
    mDim.textContent = `${current.width}×${current.height}`
    mDur.textContent = fmtDur(current.duration)
    meta.style.display = 'flex'
    run.disabled = false
    status.textContent = ''
  } catch (err) {
    status.textContent = `오류: ${String(err)}`
  }
}

pick.addEventListener('click', async () => {
  const path = await window.api.compress.pick()
  if (path) void loadFile(path)
})

run.addEventListener('click', async () => {
  if (!current) return
  run.disabled = true
  pick.disabled = true
  result.classList.remove('on')
  status.textContent = '압축 중… (영상 길이에 따라 시간이 걸릴 수 있어요)'
  try {
    const res = await window.api.compress.run({
      input: current.path,
      crf: Number(quality.value),
      scaleHeight: Number(scale.value),
      preset: preset.value
    })
    const pct = res.originalSize > 0
      ? Math.round((1 - res.newSize / res.originalSize) * 100)
      : 0
    rPct.textContent = pct >= 0 ? `${pct}% 감소 🎉` : `${-pct}% 증가`
    rSizes.textContent = `${fmtSize(res.originalSize)} → ${fmtSize(res.newSize)}`
    result.classList.add('on')
    status.textContent = `저장됨: ${res.output}`
  } catch (err) {
    status.textContent = `오류: ${String(err)}`
  } finally {
    run.disabled = false
    pick.disabled = false
  }
})
