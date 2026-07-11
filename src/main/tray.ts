import { app, Menu, Tray, nativeImage } from 'electron'
import trayIconPath from '../../resources/icon.png?asset'
import { startCapture } from './capture'
import { openSettingsWindow, openMainWindow } from './windows'
import { toggleRecording, isRecording, setRecorderStateListener } from './recorder'

let tray: Tray | null = null
let recorderListenerRegistered = false

function createTrayIcon(): Electron.NativeImage {
  const source = nativeImage.createFromPath(trayIconPath)
  if (source.isEmpty()) {
    throw new Error(`[tray] 아이콘을 불러올 수 없습니다: ${trayIconPath}`)
  }

  // Windows 알림 영역이 100~200% 배율에서도 선명한 이미지를 선택하도록
  // 1x/2x 표현을 함께 제공한다.
  const icon = nativeImage.createEmpty()
  icon.addRepresentation({
    scaleFactor: 1,
    buffer: source.resize({ width: 16, height: 16, quality: 'best' }).toPNG()
  })
  icon.addRepresentation({
    scaleFactor: 2,
    buffer: source.resize({ width: 32, height: 32, quality: 'best' }).toPNG()
  })
  return icon
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: '창 열기', click: () => openMainWindow() },
    { type: 'separator' },
    { label: '영역 캡쳐', click: () => startCapture('region') },
    { label: '창 캡쳐', click: () => startCapture('window') },
    { label: '전체 화면 캡쳐', click: () => startCapture('fullscreen') },
    { type: 'separator' },
    {
      label: isRecording() ? '■ 녹화 정지' : '● 녹화 시작',
      click: () => toggleRecording()
    },
    { type: 'separator' },
    { label: '설정', click: () => openSettingsWindow() },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ])
}

export function createTray(): Tray {
  if (tray && !tray.isDestroyed()) return tray

  tray = new Tray(createTrayIcon())
  tray.setToolTip('ScreenCapture')
  tray.setContextMenu(buildMenu())

  // 좌클릭 시 메인 창 열기
  tray.on('click', () => openMainWindow())

  // 녹화 상태 변경 시 메뉴/툴팁 갱신
  if (!recorderListenerRegistered) {
    recorderListenerRegistered = true
    setRecorderStateListener((recording) => {
      tray?.setContextMenu(buildMenu())
      tray?.setToolTip(recording ? 'ScreenCapture · 녹화 중…' : 'ScreenCapture')
    })
  }

  return tray
}

/** Windows 알림 영역에서 아이콘이 유실된 경우 새 Tray 객체로 다시 등록한다. */
export function recreateTray(): Tray {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
  return createTray()
}

export function getTray(): Tray | null {
  return tray
}
