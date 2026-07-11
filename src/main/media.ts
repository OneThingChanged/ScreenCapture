import { BrowserWindow, ipcMain, Menu, nativeImage, net, protocol, shell } from 'electron'
import { readdir, rename, rm, stat } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC, type MediaFile } from '../shared/types'
import { getSettings } from './settings'

const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
const videoExt = new Set(['.mp4', '.webm', '.mkv', '.mov', '.avi'])

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
      return net.fetch(pathToFileURL(target).toString(), {
        headers: request.headers
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function safePath(path: string): string {
  const root = resolve(getSettings().saveDir)
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
    return preview.toDataURL()
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
