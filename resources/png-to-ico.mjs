// icon.png(256x256) 을 단일 PNG 임베드 방식의 icon.ico 로 변환 (의존성 없음).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const png = readFileSync(join(__dirname, 'icon.png'))

// ICONDIR (6) + ICONDIRENTRY (16) + PNG
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // count

const entry = Buffer.alloc(16)
entry[0] = 0 // width 256 → 0
entry[1] = 0 // height 256 → 0
entry[2] = 0 // color palette
entry[3] = 0 // reserved
entry.writeUInt16LE(1, 4) // color planes
entry.writeUInt16LE(32, 6) // bits per pixel
entry.writeUInt32LE(png.length, 8) // size of image data
entry.writeUInt32LE(6 + 16, 12) // offset of image data

const ico = Buffer.concat([header, entry, png])
const out = join(__dirname, 'icon.ico')
writeFileSync(out, ico)
console.log('ico 생성 완료:', out, ico.length, 'bytes')
