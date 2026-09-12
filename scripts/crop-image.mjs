import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const [, , src, out, x, y, w, h] = process.argv
const b64 = readFileSync(src).toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } })
await page.setContent(
  `<body style="margin:0;background:#000"><img style="position:absolute;left:${-x}px;top:${-y}px" src="data:image/png;base64,${b64}"></body>`
)
await page.screenshot({ path: out })
await browser.close()
