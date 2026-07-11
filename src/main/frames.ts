import { app, ipcMain, dialog, shell, BrowserWindow, Notification } from 'electron'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'
import {
  IPC,
  type FramesMeta,
  type FramesExportPayload
} from '../shared/types'
import { getSettings } from './settings'

const ffmpegPath = ffmpegStatic
  ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
  : null

/** 5자리 0패딩 (ffmpeg %05d 와 동일) */
function pad5(n: number): string {
  return String(n).padStart(5, '0')
}

function framePath(tempDir: string, oneBasedIndex: number): string {
  return join(tempDir, `f_${pad5(oneBasedIndex)}.png`)
}

/** 현재 추출된 프레임의 임시 폴더 (새 추출 시 이전 것 정리) */
let currentTempDir: string | null = null

/**
 * 영상을 프레임 단위 PNG 로 추출하고 메타데이터(크기/길이/프레임별 시각)를 반환.
 * showinfo 필터로 각 프레임의 정확한 pts_time 을 파싱한다.
 */
function extractFrames(videoPath: string): Promise<FramesMeta> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg 를 찾을 수 없습니다.'))

    const tempDir = join(app.getPath('temp'), `sc-frames-${Date.now()}`)
    mkdir(tempDir, { recursive: true })
      .then(() => {
        const args = [
          '-y',
          '-i', videoPath,
          '-vsync', '0',
          '-vf', 'showinfo',
          join(tempDir, 'f_%05d.png')
        ]
        const ps = spawn(ffmpegPath as string, args)
        let stderr = ''
        ps.stderr.on('data', (d) => (stderr += d.toString()))
        ps.on('error', reject)
        ps.on('close', (code) => {
          if (code !== 0) {
            return reject(new Error(`ffmpeg 추출 실패 (code ${code})`))
          }
          // 프레임별 pts_time (재생 시각) 파싱
          const times: number[] = []
          const re = /pts_time:\s*([0-9]+(?:\.[0-9]+)?)/g
          let m: RegExpExecArray | null
          while ((m = re.exec(stderr)) !== null) times.push(parseFloat(m[1]))

          // 영상 크기
          let width = 0
          let height = 0
          const dim = stderr.match(/Video:.*?\s(\d{2,5})x(\d{2,5})/)
          if (dim) {
            width = parseInt(dim[1], 10)
            height = parseInt(dim[2], 10)
          }

          // 길이
          let duration = 0
          const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
          if (dur) {
            duration =
              parseInt(dur[1], 10) * 3600 +
              parseInt(dur[2], 10) * 60 +
              parseFloat(dur[3])
          }

          // 실제 생성된 PNG 개수로 count 확정 (times 와 어긋날 경우 대비)
          let count = 0
          while (existsSync(framePath(tempDir, count + 1))) count++

          if (count === 0) {
            return reject(new Error('추출된 프레임이 없습니다.'))
          }
          if (times.length < count) {
            // showinfo 파싱 실패분은 균등 시각으로 보정
            for (let i = times.length; i < count; i++) {
              times.push(duration > 0 ? (duration * i) / count : i / 30)
            }
          }
          times.length = count

          currentTempDir = tempDir
          resolve({ tempDir, count, width, height, duration, times })
        })
      })
      .catch(reject)
  })
}

/** YYYY-MM-DD_HH-mm-ss */
function timestamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  )
}

export function registerFramesIpc(): void {
  // 영상 파일 선택
  ipcMain.handle(IPC.framesPick, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '영상 선택',
      properties: ['openFile'],
      defaultPath: getSettings().saveDir,
      filters: [
        { name: '동영상', extensions: ['mp4', 'webm', 'gif', 'mkv', 'mov', 'avi'] },
        { name: '모든 파일', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // 프레임 추출
  ipcMain.handle(IPC.framesExtract, async (_e, videoPath: string) => {
    // 이전 임시 폴더 정리
    if (currentTempDir) {
      await rm(currentTempDir, { recursive: true, force: true }).catch(() => {})
      currentTempDir = null
    }
    return extractFrames(videoPath)
  })

  // 단일 프레임 미리보기 (dataURL)
  ipcMain.handle(
    IPC.framesGetImage,
    async (_e, payload: { tempDir: string; index: number }) => {
      const file = framePath(payload.tempDir, payload.index + 1)
      const buf = await readFile(file)
      return `data:image/png;base64,${buf.toString('base64')}`
    }
  )

  // 편집된 프레임들을 영상(MP4) 또는 GIF 로 내보내기
  ipcMain.handle(IPC.framesExport, async (_e, payload: FramesExportPayload) => {
    return exportFrames(payload)
  })
}

/** 충돌하지 않는 출력 경로 */
function uniqueOut(dir: string, base: string, ext: string): string {
  let candidate = join(dir, `${base}.${ext}`)
  let i = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}_${i}.${ext}`)
    i++
  }
  return candidate
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg 를 찾을 수 없습니다.'))
    const ps = spawn(ffmpegPath, args)
    let stderr = ''
    ps.stderr.on('data', (d) => (stderr += d.toString()))
    ps.on('error', reject)
    ps.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}\n${stderr.slice(-500)}`))
    )
  })
}

/**
 * 선택된 프레임들을 순서대로 이어붙여 MP4/GIF 로 인코딩.
 * concat demuxer 로 PNG 시퀀스를 각 1/fps 길이로 합친다.
 */
async function exportFrames(payload: FramesExportPayload): Promise<string> {
  const { tempDir, indices, format, fps } = payload
  if (!ffmpegPath) throw new Error('ffmpeg 를 찾을 수 없습니다.')
  if (indices.length === 0) throw new Error('내보낼 프레임이 없습니다.')

  const safeFps = Math.min(60, Math.max(1, Math.round(fps) || 30))
  const dur = (1 / safeFps).toFixed(5)

  // concat 목록 파일 작성 (절대 경로 + forward slash)
  const toUnix = (p: string): string => p.replace(/\\/g, '/')
  const lines = ['ffconcat version 1.0']
  for (const idx of indices) {
    lines.push(`file '${toUnix(framePath(tempDir, idx + 1))}'`)
    lines.push(`duration ${dur}`)
  }
  // 마지막 프레임이 잘리지 않도록 한 번 더 명시
  lines.push(`file '${toUnix(framePath(tempDir, indices[indices.length - 1] + 1))}'`)
  const listPath = join(tempDir, 'concat.txt')
  await writeFile(listPath, lines.join('\n'), 'utf8')

  const saveDir = getSettings().saveDir
  await mkdir(saveDir, { recursive: true })
  const out = uniqueOut(saveDir, `Edited_${timestamp()}`, format)

  if (format === 'mp4') {
    await runFfmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
      '-vf', `fps=${safeFps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-movflags', '+faststart',
      out
    ])
  } else {
    // GIF: 팔레트 2패스로 품질 확보 (최대 폭 800)
    const palette = join(tempDir, 'palette.png')
    const vf = `fps=${safeFps},scale=w=min(800\\,iw):h=-2:flags=lanczos`
    await runFfmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
      '-vf', `${vf},palettegen=stats_mode=diff`, palette
    ])
    await runFfmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-i', palette,
      '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer`,
      out
    ])
  }

  shell.showItemInFolder(out)
  new Notification({ title: '내보내기 완료', body: `저장됨: ${out}` }).show()
  return out
}
