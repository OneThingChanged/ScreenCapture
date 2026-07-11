import { screen, type DesktopCapturerSource, type Display } from 'electron'

/**
 * desktopCapturer의 display_id가 비어 있는 Windows 환경까지 고려해
 * 지정한 Electron Display에 대응하는 screen source를 찾는다.
 */
export function sourceForDisplay(
  sources: DesktopCapturerSource[],
  display: Display
): DesktopCapturerSource | null {
  const exact = sources.find((source) => source.display_id === String(display.id))
  if (exact) return exact

  const displays = screen.getAllDisplays()
  const displayIndex = displays.findIndex((candidate) => candidate.id === display.id)
  if (displayIndex < 0) return sources[0] ?? null

  // Windows source id는 일반적으로 screen:<index>:<device> 형태다.
  const indexed = sources.find((source) => {
    const match = /^screen:(\d+):/.exec(source.id)
    return match ? Number(match[1]) === displayIndex : false
  })

  return indexed ?? sources[displayIndex] ?? sources[0] ?? null
}
