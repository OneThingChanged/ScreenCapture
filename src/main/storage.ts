import { clipboard, nativeImage, type NativeImage } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { getSettings } from './settings'
import type { ImageFormat } from '../shared/types'

/** YYYY-MM-DD_HH-mm-ss 형식 타임스탬프 */
function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  )
}

/** 충돌하지 않는 파일 경로 생성 (Capture_타임스탬프.ext, 중복 시 _1, _2 ...) */
function uniquePath(dir: string, base: string, ext: string): string {
  let candidate = join(dir, `${base}.${ext}`)
  let i = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}_${i}.${ext}`)
    i++
  }
  return candidate
}

/** NativeImage 를 설정된 포맷/폴더에 저장. 저장 경로 반환 */
export async function saveImage(image: NativeImage): Promise<string> {
  const settings = getSettings()
  await mkdir(settings.saveDir, { recursive: true })

  const format: ImageFormat = settings.imageFormat
  const ext = format === 'jpg' ? 'jpg' : 'png'
  const buffer =
    format === 'jpg' ? image.toJPEG(settings.jpgQuality) : image.toPNG()

  const path = uniquePath(settings.saveDir, `Capture_${timestamp()}`, ext)
  await writeFile(path, buffer)
  return path
}

/** 클립보드에 이미지 복사 */
export function copyImageToClipboard(image: NativeImage): void {
  clipboard.writeImage(image)
}

/** dataURL 을 NativeImage 로 변환 */
export function imageFromDataUrl(dataUrl: string): NativeImage {
  return nativeImage.createFromDataURL(dataUrl)
}

/** 편집 이미지를 사용자가 선택한 경로/확장자로 저장한다. */
export async function saveImageToPath(image: NativeImage, path: string): Promise<string> {
  await mkdir(dirname(path), { recursive: true })
  const extension = extname(path).toLowerCase()
  const buffer = extension === '.jpg' || extension === '.jpeg'
    ? image.toJPEG(getSettings().jpgQuality)
    : image.toPNG()
  await writeFile(path, buffer)
  return path
}

/** 임의 버퍼(녹화 등)를 파일로 저장. 저장 경로 반환 */
export async function saveBuffer(
  buffer: Buffer,
  base: string,
  ext: string
): Promise<string> {
  const settings = getSettings()
  await mkdir(settings.saveDir, { recursive: true })
  const path = uniquePath(settings.saveDir, `${base}_${timestamp()}`, ext)
  await writeFile(path, buffer)
  return path
}
