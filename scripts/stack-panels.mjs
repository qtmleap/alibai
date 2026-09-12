/**
 * 三枚並びの絵から、モック側と実装側の同じ矩形を切り出して上下に積む。
 * 横に並んだままだと同じ場所を見比べにくいので、縦へ積み替えるためだけの使い捨て。
 *
 *   bun scripts/stack-panels.mjs <src> <out> <panelW> <gap> <top> <x> <y> <w> <h> [zoom]
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [, , src, out, panelW, gap, top, x, y, w, h, zoom] = process.argv
const n = (v) => Number(v)
const z = zoom === undefined ? 1 : n(zoom)
const b64 = readFileSync(src).toString('base64')
const cell = (index) => `
  <div style="position:relative;width:${n(w) * z}px;height:${n(h) * z}px;overflow:hidden">
    <img style="position:absolute;image-rendering:pixelated;transform-origin:0 0;transform:scale(${z});left:${-(n(x) + index * (n(panelW) + n(gap))) * z}px;top:${-(n(y) + n(top)) * z}px"
         src="data:image/png;base64,${b64}">
  </div>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: n(w) * z, height: n(h) * z * 2 + 8 } })
await page.setContent(
  `<body style="margin:0;background:#000;display:flex;flex-direction:column;gap:8px">${cell(0)}${cell(1)}</body>`,
)
await page.screenshot({ path: out })
await browser.close()
