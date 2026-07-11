import { ipcMain, dialog, shell, BrowserWindow, Notification } from 'electron'
import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'
import {
  IPC,
  type CompressInfo,
  type CompressPayload,
  type CompressResult
} from '../shared/types'
import { getSettings } from './settings'

const ffmpegPath = ffmpegStatic
  ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
  : null

/** ffmpeg -i 로 영상 크기/길이 파싱 */
function probe(input: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg 를 찾을 수 없습니다.'))
    const ps = spawn(ffmpegPath, ['-i', input])
    let stderr = ''
    ps.stderr.on('data', (d) => (stderr += d.toString()))
    ps.on('error', reject)
    ps.on('close', () => {
      let width = 0
      let height = 0
      const dim = stderr.match(/Video:.*?\s(\d{2,5})x(\d{2,5})/)
      if (dim) {
        width = parseInt(dim[1], 10)
        height = parseInt(dim[2], 10)
      }
      let duration = 0
      const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (dur) {
        duration =
          parseInt(dur[1], 10) * 3600 + parseInt(dur[2], 10) * 60 + parseFloat(dur[3])
      }
      resolve({ width, height, duration })
    })
  })
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg 를 찾을 수 없습니다.'))
    const ps = spawn(ffmpegPath, args)
    let stderr = ''
    ps.stderr.on('data', (d) => (stderr += d.toString()))
    ps.on('error', reject)
    ps.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg exit ${code}\n${stderr.slice(-500)}`))
    )
  })
}

function uniqueOut(dir: string, base: string, ext: string): string {
  let candidate = join(dir, `${base}.${ext}`)
  let i = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}_${i}.${ext}`)
    i++
  }
  return candidate
}

export function registerCompressIpc(): void {
  ipcMain.handle(IPC.compressPick, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '압축할 영상 선택',
      properties: ['openFile'],
      defaultPath: getSettings().saveDir,
      filters: [
        { name: '동영상', extensions: ['mp4', 'webm', 'mkv', 'mov', 'avi'] },
        { name: '모든 파일', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.compressInfo, async (_e, input: string): Promise<CompressInfo> => {
    const [{ size }, dims] = await Promise.all([stat(input), probe(input)])
    return { path: input, size, ...dims }
  })

  ipcMain.handle(
    IPC.compressRun,
    async (_e, payload: CompressPayload): Promise<CompressResult> => {
      const { input, crf, scaleHeight, preset } = payload
      const originalSize = (await stat(input)).size

      const dir = dirname(input)
      const name = basename(input, extname(input))
      const output = uniqueOut(dir, `${name}_compressed`, 'mp4')

      const args = ['-y', '-i', input, '-c:v', 'libx264', '-crf', String(crf), '-preset', preset, '-pix_fmt', 'yuv420p']
      if (scaleHeight > 0) {
        // 가로는 짝수로 자동(-2), 세로만 지정
        args.push('-vf', `scale=-2:${scaleHeight}`)
      }
      // 오디오가 있으면 AAC 로, 없으면 무시됨
      args.push('-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output)

      await runFfmpeg(args)
      const newSize = (await stat(output)).size

      shell.showItemInFolder(output)
      const pct = originalSize > 0 ? Math.round((1 - newSize / originalSize) * 100) : 0
      new Notification({
        title: '압축 완료',
        body: `${pct}% 감소 · ${output}`
      }).show()

      return { output, originalSize, newSize }
    }
  )
}
