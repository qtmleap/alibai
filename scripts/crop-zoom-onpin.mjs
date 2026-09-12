import sharp from 'sharp'
import { join } from 'node:path'
const root = '/home/vscode/app'
const out = join(root, 'screenshots/match/crops')
const files = [
  ['int-mid-desktop-mock-full.png','mock'],
  ['int-mid-desktop-impl-full.png','impl'],
]
for (const [f,tag] of files) {
  await sharp(join(out,f))
    .extract({ left: 60, top: 780, width: 400, height: 220 })
    .toFile(join(out, `zoom-${tag}-onpin.png`))
}
