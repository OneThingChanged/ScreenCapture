import type { MainAction } from '../../shared/types'

const recordGrid = document.getElementById('recordGrid') as HTMLElement
const stopBar = document.getElementById('stopBar') as HTMLButtonElement

// 캡쳐/녹화/설정 카드 클릭 → 메인 프로세스로 액션 전달
document.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
  el.addEventListener('click', () => {
    window.api.main.action(el.dataset.action as MainAction)
  })
})

// 녹화 중 정지 바 클릭 (모드 무관 — 진행 중이면 정지된다)
stopBar.addEventListener('click', () => {
  window.api.main.action('record-fullscreen')
})

// 녹화 상태에 따라 UI 토글
window.api.main.onRecordState((recording) => {
  recordGrid.style.display = recording ? 'none' : 'grid'
  stopBar.style.display = recording ? 'flex' : 'none'
})
