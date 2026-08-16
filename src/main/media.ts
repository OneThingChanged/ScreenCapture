import { BrowserWindow, ipcMain, Menu, nativeImage, net, protocol, shell } from 'electron'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readdir, rename, rm, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { basename, extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ffmpegStatic from 'ffmpeg-static'
import { IPC, type MediaFile, type VideoPreviewInfo } from '../shared/types'
import { getSettings } from './settings'
import { imageToDataUrl } from './storage'

const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
const videoExt = new Set(['.mp4', '.webm', '.mkv', '.mov', '.avi'])
const ffmpegPath = ffmpegStatic
  ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
  : null

const videoMime: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo'
}

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'sc-media',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ])
}

export function registerMediaProtocol(): void {
  protocol.handle('sc-media', async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'file') return new Response('Not found', { status: 404 })
      const target = safePath(decodeURIComponent(url.pathname.slice(1)))
      const extension = extname(target).toLowerCase()
      if (!imageExt.has(extension) && !videoExt.has(extension)) {
        return new Response('Unsupported media', { status: 415 })
      }
      if (videoExt.has(extension)) return videoResponse(request, target, extension)
      return net.fetch(pathToFileURL(target).toString(), {
        headers: request.headers
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/** HTML video 탐색이 요구하는 단일 byte range 응답을 제공한다. */
async function videoResponse(
  request: Request,
  target: string,
  extension: string
): Promise<Response> {
  const info = await stat(target)
  const size = info.size
  const range = request.headers.get('range')
  let start = 0
  let end = Math.max(0, size - 1)
  let status = 200

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
    if (!match || (!match[1] && !match[2])) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` }
      })
    }
    if (match[1]) {
      start = Number(match[1])
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
    } else {
      const suffixLength = Math.min(Number(match[2]), size)
      start = size - suffixLength
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` }
      })
    }
    status = 206
  }

  const length = end - start + 1
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Length': String(length),
    'Content-Type': videoMime[extension] ?? 'application/octet-stream',
    'Cache-Control': 'no-store'
  })
  if (status === 206) headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  const body = request.method === 'HEAD'
    ? null
    : Readable.toWeb(createReadStream(target, { start, end }))
  return new Response(body as never, { status, headers })
}

export function readVideoInfo(path: string): Promise<VideoPreviewInfo> {
  return new Promise((resolveInfo, rejectInfo) => {
    if (!ffmpegPath) return rejectInfo(new Error('ffmpeg를 찾을 수 없습니다.'))
    const process = spawn(ffmpegPath, [
      '-hide_banner',
      '-i', path,
      '-map', '0:v:0',
      '-frames:v', '1',
      '-f', 'null',
      '-'
    ])
    let stderr = ''
    process.stderr.on('data', (data) => { stderr += data.toString() })
    process.on('error', rejectInfo)
    process.on('close', () => {
      const fpsMatch = stderr.match(/Video:.*?\s(\d+(?:\.\d+)?)\s+fps/)
        ?? stderr.match(/Video:.*?\s(\d+(?:\.\d+)?)\s+tbr/)
      const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      const fps = fpsMatch ? Number(fpsMatch[1]) : 30
      const duration = durationMatch
        ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
        : 0
      resolveInfo({ fps: Number.isFinite(fps) && fps > 0 ? fps : 30, duration })
    })
  })
}

function safePath(path: string): string {
  const selftestRoot = process.env.MEDIA_RANGE_SELFTEST_ROOT
  const root = resolve(
    process.env.MEDIA_RANGE_SELFTEST && selftestRoot
      ? selftestRoot
      : getSettings().saveDir
  )
  const target = resolve(path)
  const rel = relative(root, target)
  if (rel.startsWith('..') || rel.includes(':') || rel === '') {
    throw new Error('저장 폴더 밖의 파일은 처리할 수 없습니다.')
  }
  return target
}

async function toMediaFile(path: string): Promise<MediaFile> {
  const info = await stat(path)
  const extension = extname(path).toLowerCase()
  return {
    path,
    name: basename(path),
    kind: imageExt.has(extension) ? 'image' : 'video',
    extension: extension.slice(1),
    size: info.size,
    modifiedAt: info.mtimeMs
  }
}

export function registerMediaIpc(): void {
  ipcMain.handle(IPC.mediaList, async (): Promise<MediaFile[]> => {
    const root = getSettings().saveDir
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(root, entry.name))
      .filter((path) => {
        const extension = extname(path).toLowerCase()
        return imageExt.has(extension) || videoExt.has(extension)
      })
    const result = await Promise.all(files.map(toMediaFile))
    return result.sort((a, b) => b.modifiedAt - a.modifiedAt)
  })

  ipcMain.handle(IPC.mediaPreview, async (_e, path: string): Promise<string | null> => {
    const target = safePath(path)
    if (!imageExt.has(extname(target).toLowerCase())) return null
    const image = nativeImage.createFromPath(target)
    if (image.isEmpty()) return null
    const size = image.getSize()
    const preview = size.width > 1800 ? image.resize({ width: 1800 }) : image
    return imageToDataUrl(preview)
  })

  ipcMain.handle(IPC.mediaVideoInfo, async (_e, path: string): Promise<VideoPreviewInfo> => {
    const target = safePath(path)
    if (!videoExt.has(extname(target).toLowerCase())) throw new Error('영상 파일이 아닙니다.')
    return readVideoInfo(target)
  })

  ipcMain.handle(IPC.mediaOpenFolder, async (_e, path?: string): Promise<void> => {
    if (path) shell.showItemInFolder(safePath(path))
    else await shell.openPath(getSettings().saveDir)
  })

  ipcMain.on(IPC.mediaContextMenu, (event, path: string) => {
    const target = safePath(path)
    const menu = Menu.buildFromTemplate([
      {
        label: '파일 탐색기에서 보기',
        click: () => shell.showItemInFolder(target)
      }
    ])
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) ?? undefined })
  })

  ipcMain.handle(
    IPC.mediaRename,
    async (_e, payload: { path: string; name: string }): Promise<MediaFile> => {
      const source = safePath(payload.path)
      const cleanName = basename(payload.name.trim())
      if (!cleanName || cleanName === '.' || cleanName === '..') throw new Error('올바른 파일명을 입력하세요.')
      const target = safePath(join(getSettings().saveDir, cleanName))
      await rename(source, target)
      return toMediaFile(target)
    }
  )

  ipcMain.handle(IPC.mediaDelete, async (_e, path: string): Promise<void> => {
    await rm(safePath(path), { force: true })
  })
}
