/*
 * 聞き込みのモックと実装を、同じ切り取りで上下に並べて撮る。
 * 三枚並びでは字が潰れて読めないので、細部を見るときだけ使う。
 *
 * 使い方: bun scripts/compare-int-crop.mjs <desktop|mobile> <storyId> <hash> [x,y,w,h]
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const dir = join(root, 'storybook-static/intstate')
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
const { server, url } = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0])
    const f = join(dir, p === '/' ? '/index.html' : p)
    if (!f.startsWith(dir) || !existsSync(f)) return res.writeHead(404).end('x')
    res.writeHead(200, { 'content-type': mime[extname(f)] ?? 'application/octet-stream' })
    res.end(readFileSync(f))
  })
  s.listen(0, '127.0.0.1', () => resolve({ server: s, url: `http://127.0.0.1:${s.address().port}` }))
})

const viewName = process.argv[2] ?? 'desktop'
const storyId = process.argv[3]
const hash = process.argv[4] ?? ''
const clipArg = process.argv[5] ?? ''
const out2 = process.argv[6] ?? 'crop.png'
const view =
  viewName === 'mobile'
    ? { w: 390, h: 844, dir: 'mocks/mobile' }
    : { w: 1440, h: 900, dir: 'mocks/desktop' }
const clip = clipArg
  ? (([x, y, w, h]) => ({ x, y, width: w, height: h }))(clipArg.split(',').map(Number))
  : undefined

const browser = await chromium.launch()
const out = join(root, 'screenshots/match')
mkdirSync(out, { recursive: true })

const page = await browser.newPage({
  viewport: { width: view.w, height: view.h },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
})
await page.goto(`file://${join(root, view.dir, 'interrogation.html')}${hash ? `#${hash}` : ''}`, {
  waitUntil: 'networkidle',
})
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(400)
const a = (await page.screenshot({ clip })).toString('base64')

await page.goto(`${url}/iframe.html?id=${storyId}&viewMode=story`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForFunction(() => document.querySelector('#storybook-root')?.childElementCount > 0)
await page.waitForTimeout(700)
const b = (await page.screenshot({ clip })).toString('base64')

const sheet = await browser.newPage({ viewport: { width: 3400, height: 3400 }, deviceScaleFactor: 1 })
await sheet.setContent(`<style>body{margin:0;background:#0b0a0d;color:#8e8896;font:14px monospace;padding:10px}
.row{display:flex;flex-direction:column;gap:10px;align-items:flex-start}img{display:block;border:1px solid #302c39}</style>
<div class="row"><div><div>MOCK</div><img src="data:image/png;base64,${a}"></div><div><div>IMPL</div><img src="data:image/png;base64,${b}"></div></div>`)
await sheet.waitForTimeout(200)
await sheet.locator('.row').screenshot({ path: join(out, out2) })
await browser.close()
server.close()
console.log(join(out, out2))
