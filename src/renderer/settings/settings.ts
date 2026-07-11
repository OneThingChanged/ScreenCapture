import type { AppSettings } from '../../shared/types'

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T

const saveDir = $<HTMLInputElement>('saveDir')
const browse = $<HTMLButtonElement>('browse')
const imageFormat = $<HTMLSelectElement>('imageFormat')
const jpgQuality = $<HTMLInputElement>('jpgQuality')
const jpgQualityField = $<HTMLDivElement>('jpgQualityField')
const afterCapture = $<HTMLSelectElement>('afterCapture')
const copyToClipboard = $<HTMLInputElement>('copyToClipboard')
const exportMp4 = $<HTMLInputElement>('exportMp4')
const exportGif = $<HTMLInputElement>('exportGif')
const keepWebm = $<HTMLInputElement>('keepWebm')
const recordFps = $<HTMLInputElement>('recordFps')
const saveBtn = $<HTMLButtonElement>('save')
const status = $<HTMLSpanElement>('status')

$<HTMLButtonElement>('home').addEventListener('click', () => {
  window.api.main.home()
})

const scInputs = {
  region: $<HTMLInputElement>('sc-region'),
  window: $<HTMLInputElement>('sc-window'),
  fullscreen: $<HTMLInputElement>('sc-fullscreen'),
  record: $<HTMLInputElement>('sc-record')
}

function toggleJpgField(): void {
  jpgQualityField.style.display = imageFormat.value === 'jpg' ? '' : 'none'
}
imageFormat.addEventListener('change', toggleJpgField)

/** KeyboardEvent → Electron accelerator 문자열 */
function toAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = e.key
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null

  let main = ''
  if (/^[a-zA-Z]$/.test(key)) main = key.toUpperCase()
  else if (/^[0-9]$/.test(key)) main = key
  else if (/^F[0-9]{1,2}$/.test(key)) main = key
  else {
    const map: Record<string, string> = {
      ' ': 'Space',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Escape: 'Esc',
      Enter: 'Return',
      '`': '`'
    }
    main = map[key] ?? (key.length === 1 ? key.toUpperCase() : '')
  }
  if (!main) return null
  parts.push(main)
  return parts.join('+')
}

for (const input of Object.values(scInputs)) {
  input.addEventListener('focus', () => input.classList.add('recording'))
  input.addEventListener('blur', () => input.classList.remove('recording'))
  input.addEventListener('keydown', (e) => {
    e.preventDefault()
    const accel = toAccelerator(e)
    if (accel) input.value = accel
  })
}

async function load(): Promise<void> {
  const s = await window.api.settings.get()
  saveDir.value = s.saveDir
  imageFormat.value = s.imageFormat
  jpgQuality.value = String(s.jpgQuality)
  afterCapture.value = s.afterCapture
  copyToClipboard.checked = s.copyToClipboard
  exportMp4.checked = s.exportMp4
  exportGif.checked = s.exportGif
  keepWebm.checked = s.keepWebm
  recordFps.value = String(s.recordFps)
  scInputs.region.value = s.shortcuts.region
  scInputs.window.value = s.shortcuts.window
  scInputs.fullscreen.value = s.shortcuts.fullscreen
  scInputs.record.value = s.shortcuts.record
  toggleJpgField()
}

browse.addEventListener('click', async () => {
  const dir = await window.api.dialog.pickFolder()
  if (dir) saveDir.value = dir
})

saveBtn.addEventListener('click', async () => {
  const patch: Partial<AppSettings> = {
    saveDir: saveDir.value,
    imageFormat: imageFormat.value as AppSettings['imageFormat'],
    jpgQuality: Math.min(100, Math.max(1, Number(jpgQuality.value) || 90)),
    afterCapture: afterCapture.value as AppSettings['afterCapture'],
    copyToClipboard: copyToClipboard.checked,
    exportMp4: exportMp4.checked,
    exportGif: exportGif.checked,
    keepWebm: keepWebm.checked,
    recordFps: Math.min(60, Math.max(5, Number(recordFps.value) || 30)),
    shortcuts: {
      region: scInputs.region.value,
      window: scInputs.window.value,
      fullscreen: scInputs.fullscreen.value,
      record: scInputs.record.value
    }
  }
  await window.api.settings.set(patch)
  status.textContent = '저장됨 ✓'
  setTimeout(() => (status.textContent = ''), 1500)
})

load()
