import { app, Menu, Tray, nativeImage } from 'electron'
import trayIconPath from '../../resources/icon.png?asset'
import { startCapture } from './capture'
import { openSettingsWindow, openMainWindow } from './windows'
import { toggleRecording, isRecording, setRecorderStateListener } from './recorder'

let tray: Tray | null = null

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
  const icon = nativeImage.createFromPath(trayIconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('화면 캡쳐')
  tray.setContextMenu(buildMenu())

  // 좌클릭 시 메인 창 열기
  tray.on('click', () => openMainWindow())

  // 녹화 상태 변경 시 메뉴/툴팁 갱신
  setRecorderStateListener((recording) => {
    tray?.setContextMenu(buildMenu())
    tray?.setToolTip(recording ? '화면 캡쳐 · 녹화 중…' : '화면 캡쳐')
  })

  return tray
}

export function getTray(): Tray | null {
  return tray
}
