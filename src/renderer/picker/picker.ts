import type { WindowSource } from '../../shared/types'

const grid = document.getElementById('grid') as HTMLDivElement
let submitted = false

function submit(id?: string): void {
  if (submitted) return
  submitted = true
  window.api.picker.submit(id ? { cancelled: false, id } : { cancelled: true })
}

window.api.picker.onInit((sources: WindowSource[]) => {
  grid.innerHTML = ''
  for (const s of sources) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'card'

    const img = document.createElement('img')
    img.className = 'thumb'
    img.src = s.thumbnailDataUrl

    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = s.name
    title.title = s.name

    card.appendChild(img)
    card.appendChild(title)
    card.addEventListener('click', () => submit(s.id))
    grid.appendChild(card)
  }
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') submit()
})
