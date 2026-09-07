import sharp from 'sharp'
import { join } from 'node:path'

const root = '/home/vscode/app'
const files = [
  'screenshots/match/crops/int-mid-desktop-mock-full.png',
  'screenshots/match/crops/int-mid-desktop-impl-full.png',
]

for (const f of files) {
  const img = sharp(join(root, f))
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  // scan a row at y=200 (within header/table area) for bright vertical line (divider)
  const y = 900
  const row = []
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * channels
    const r = data[idx], g = data[idx+1], b = data[idx+2]
    row.push(r+g+b)
  }
  // find local maxima brighter than neighbors avg (divider line is brighter than bg)
  let candidates = []
  for (let x = 1; x < width - 1; x++) {
    if (row[x] > 60 && row[x] > row[x-20] + 20) candidates.push(x)
  }
  console.log(f, 'width', width, 'bright edges at y='+y, candidates.slice(0,30))
}
