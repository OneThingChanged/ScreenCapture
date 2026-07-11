// 의존성 없이 PNG 트레이/앱 아이콘을 생성한다 (256x256 RGBA).
// 디자인: 둥근 모서리의 파란 사각형 + 흐릿한 흰 렌즈 원 (카메라 느낌)
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SIZE = 256

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

// 픽셀 생성
const px = Buffer.alloc(SIZE * SIZE * 4)
const cx = SIZE / 2
const cy = SIZE / 2
const radius = SIZE * 0.28 // 렌즈 반경
const corner = SIZE * 0.18 // 라운드 모서리 반경
const margin = SIZE * 0.08

function roundedAlpha(x, y) {
  // 라운드 사각형 내부 판정
  const left = margin
  const right = SIZE - margin
  const top = margin
  const bottom = SIZE - margin
  if (x < left || x > right || y < top || y > bottom) return 0
  const dx = Math.max(left + corner - x, 0, x - (right - corner))
  const dy = Math.max(top + corner - y, 0, y - (bottom - corner))
  const d = Math.hypot(dx, dy)
  return d <= corner ? 1 : 0
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    const inRect = roundedAlpha(x, y)
    const distLens = Math.hypot(x - cx, y - cy)
    if (!inRect) {
      px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0
    } else if (distLens <= radius) {
      // 렌즈: 흰색 → 옅은 파랑 그라데이션
      const t = distLens / radius
      px[i] = Math.round(255 - t * 40)
      px[i + 1] = Math.round(255 - t * 30)
      px[i + 2] = 255
      px[i + 3] = 255
    } else {
      // 본체: 파랑
      px[i] = 37
      px[i + 1] = 99
      px[i + 2] = 235
      px[i + 3] = 255
    }
  }
}

// 스캔라인마다 필터바이트(0) 삽입
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0
const idat = deflateSync(raw)

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
])

mkdirSync(__dirname, { recursive: true })
const out = join(__dirname, 'icon.png')
writeFileSync(out, png)
console.log('아이콘 생성 완료:', out)
