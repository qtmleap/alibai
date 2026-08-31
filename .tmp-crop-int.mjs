import sharp from 'sharp'
import { join } from 'node:path'

const root = '/home/vscode/app'
const out = join(root, 'screenshots/match/crops')

const jobs = ['int-mid-desktop.png', 'int-last-desktop.png']
const colW = 2880
const gap = 24
const padTop = 60
const padLeft = 28

for (const f of jobs) {
  const base = f.replace('.png','')
  await sharp(join(root,'screenshots/match',f))
    .extract({ left: padLeft, top: padTop, width: colW, height: 1800 - padTop })
    .toFile(join(out, base + '-mock-full.png'))
  await sharp(join(root,'screenshots/match',f))
    .extract({ left: padLeft + colW + gap, top: padTop, width: colW, height: 1800 - padTop })
    .toFile(join(out, base + '-impl-full.png'))
}
console.log('done')
