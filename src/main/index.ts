import { app, nativeImage, net } from 'electron'
import { writeFile } from 'node:fs/promises'
import { createTray, recreateTray } from './tray'
import { registerIpc, notifyFrameRecordState } from './ipc'
import { registerFramesIpc } from './frames'
import { registerCompressIpc } from './compress'
import { registerUpdaterIpc } from './updater'
import {
  registerMediaIpc,
  registerMediaProtocol,
  registerMediaScheme,
  readVideoInfo
} from './media'
import {
  registerShortcuts,
  resumeShortcutsIfSuspended,
  unregisterShortcuts
} from './shortcuts'
import { captureFullScreen, captureRegion, captureWindow } from './capture'
import { imageToDataUrl, saveImage } from './storage'
import {
  openEditorWindow,
  openRegionFrameWindow,
  getFrameWindow,
  openMainWindow,
  getMainWindow,
  notifyCaptureCompleted,
  setTrayRecreateHandler
} from './windows'
import {
  registerRecorderIpc,
  toggleRecording,
  setRecorderStateListener
} from './recorder'
import { IPC } from '../shared/types'

registerMediaScheme()

// 단일 인스턴스 보장
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// 두 번째 실행 시도 시 기존 메인 창을 띄워준다
app.on('second-instance', () => {
  openMainWindow()
})

// 설정의 단축키 입력 도중 다른 프로그램으로 전환해도 전역 단축키가 해제된 채 남지 않게 한다.
app.on('browser-window-blur', () => {
  resumeShortcutsIfSuspended()
})

app.whenReady().then(async () => {
  registerMediaProtocol()
  registerIpc()
  registerRecorderIpc()
  registerFramesIpc()
  registerCompressIpc()
  registerUpdaterIpc()
  registerMediaIpc()
  createTray()
  setTrayRecreateHandler(recreateTray)
  registerShortcuts()

  // 녹화 상태를 메인 대시보드 + 녹화 프레임에 반영
  setRecorderStateListener((recording) => {
    getMainWindow()?.webContents.send(IPC.mainRecordState, recording)
    notifyFrameRecordState(recording)
  })

  const isSelftest =
    process.env.RECORD_SELFTEST ||
    process.env.MEDIA_RANGE_SELFTEST ||
    process.env.FRAME_CAPTURE_SELFTEST ||
    process.env.EDITOR_SELFTEST ||
    process.env.EDITOR_RENDER_SELFTEST ||
    process.env.CAPTURE_SELFTEST
  if (!isSelftest) {
    openMainWindow()
  }

  // 관리 탭 영상 탐색 자가 테스트: byte range 응답과 FPS 메타데이터 확인
  if (process.env.MEDIA_RANGE_SELFTEST) {
    try {
      const target = process.env.MEDIA_RANGE_SELFTEST
      const response = await net.fetch(
        `sc-media://file/${encodeURIComponent(target)}`,
        { headers: { Range: 'bytes=100-1099' } }
      )
      const bytes = Buffer.from(await response.arrayBuffer())
      const contentRange = response.headers.get('content-range') ?? ''
      const info = await readVideoInfo(target)
      console.log(
        `[media-range-selftest] status=${response.status} bytes=${bytes.length} ` +
        `range=${contentRange} fps=${info.fps} duration=${info.duration}`
      )
      if (
        response.status !== 206 ||
        bytes.length !== 1000 ||
        !contentRange.startsWith('bytes 100-1099/') ||
        info.fps <= 0
      ) {
        process.exitCode = 1
      }
    } catch (error) {
      console.error('[media-range-selftest] error:', error)
      process.exitCode = 1
    }
    app.quit()
    return
  }

  // 유지형 영역 캡처 프레임 자가 테스트: UI → 실제 캡처 → 프레임 생존 확인
  if (process.env.FRAME_CAPTURE_SELFTEST) {
    const frame = openRegionFrameWindow()
    frame.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const uiOutput = process.env.FRAME_CAPTURE_SELFTEST_UI
          if (uiOutput) {
            const rendered = await frame.webContents.capturePage()
            await writeFile(uiOutput, rendered.toPNG())
          }
          const mouseModes = await frame.webContents.executeJavaScript(`(() => {
            const inside = document.getElementById('inner').getBoundingClientRect()
            window.dispatchEvent(new MouseEvent('mousemove', {
              clientX: inside.left + inside.width / 2,
              clientY: inside.top + inside.height / 2
            }))
            const interior = document.body.dataset.mouseMode
            const button = document.getElementById('captureBtn').getBoundingClientRect()
            window.dispatchEvent(new MouseEvent('mousemove', {
              clientX: button.left + button.width / 2,
              clientY: button.top + button.height / 2
            }))
            return { interior, controls: document.body.dataset.mouseMode }
          })()`)
          await frame.webContents.executeJavaScript(
            "document.getElementById('captureBtn')?.click()"
          )
          let status = ''
          for (let attempt = 0; attempt < 30 && !status; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100))
            status = await frame.webContents.executeJavaScript(
              "document.body.dataset.lastCapture ?? ''"
            )
          }
          const alive = getFrameWindow() === frame && !frame.isDestroyed()
          console.log(
            `[frame-selftest] capture=${status} frameAlive=${alive} ` +
            `interior=${mouseModes.interior} controls=${mouseModes.controls}`
          )
          if (
            status !== 'success' ||
            !alive ||
            mouseModes.interior !== 'passthrough' ||
            mouseModes.controls !== 'interactive'
          ) {
            process.exitCode = 1
          }
        } catch (error) {
          console.error('[frame-selftest] error:', error)
          process.exitCode = 1
        }
        app.quit()
      }, 500)
    })
    return
  }

  // 녹화 자가 테스트: 시작 → 2초 후 정지 → 저장/변환 확인
  if (process.env.RECORD_SELFTEST) {
    toggleRecording(process.env.RECORD_SELFTEST === 'region' ? 'region' : 'fullscreen')
    setTimeout(() => toggleRecording(), 2500)
  }

  // 이미지 편집기 렌더링 자가 테스트: 지정 이미지를 열고 창 전체를 PNG로 캡처한다.
  if (process.env.EDITOR_RENDER_SELFTEST) {
    const sourcePath = process.env.EDITOR_RENDER_SELFTEST
    const outputPath = process.env.EDITOR_RENDER_SELFTEST_OUTPUT
    const image = nativeImage.createFromPath(sourcePath)
    if (image.isEmpty() || !outputPath) {
      console.error('[editor-render-selftest] invalid input or output path')
      app.quit()
      return
    }
    notifyCaptureCompleted({
      dataUrl: imageToDataUrl(image),
      savedPath: sourcePath,
      mode: 'fullscreen',
      openEditor: true,
      createdAt: Date.now()
    })
    setTimeout(async () => {
      const webContents = getMainWindow()?.webContents
      const rendered = await webContents?.capturePage()
      if (rendered) await writeFile(outputPath, rendered.toPNG())
      app.quit()
    }, 1800)
    return
  }

  // 편집기 자가 테스트: 캡쳐 → 편집기 → 도형 추가 → 저장 → 종료
  if (process.env.EDITOR_SELFTEST && !process.env.CAPTURE_SELFTEST) {
    const image = await captureFullScreen()
    if (image) openEditorWindow(imageToDataUrl(image))
    return
  }

  // 자가 테스트 (CAPTURE_SELFTEST=fullscreen|region)
  const selftest = process.env.CAPTURE_SELFTEST
  if (selftest) {
    try {
      const image =
        selftest === 'region'
          ? await captureRegion()
          : selftest === 'window'
            ? await captureWindow()
            : await captureFullScreen()
      if (image) {
        const path = await saveImage(image)
        console.log('[selftest] saved:', path, image.getSize())
      } else {
        console.log('[selftest] no image (cancelled?)')
      }
    } catch (err) {
      console.error('[selftest] error:', err)
    }
    app.quit()
  }
})

// 트레이 상주형: 모든 창이 닫혀도 종료하지 않는다 (app.quit 호출 안 함)
app.on('window-all-closed', () => {
  // intentionally empty
})

app.on('will-quit', () => {
  unregisterShortcuts()
})

// macOS Dock 아이콘 숨김 (트레이 전용). Windows 영향 없음
if (process.platform === 'darwin') {
  app.dock?.hide()
}
