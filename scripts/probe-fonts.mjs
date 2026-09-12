import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const dir = join(root, 'storybook-static/set')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
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
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`file://${join(root, 'mocks/desktop/settings.html')}`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
console.log('mock loaded fonts:', await page.evaluate(() => [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status).join(' | ')))
console.log('mock h2 rect:', await page.evaluate(() => { const r = document.querySelector('h2').getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }))

await page.goto(`${url}/iframe.html?id=screens-set-設定--default&viewMode=story`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForFunction(() => document.querySelector('#storybook-root')?.childElementCount > 0)
await page.waitForTimeout(500)
console.log('impl loaded fonts:', await page.evaluate(() => [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status).join(' | ')))
console.log('impl h1:', await page.evaluate(() => { const e = document.querySelector('#storybook-root h1'); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return [r.x, r.y, r.width, r.height, cs.fontSize, cs.lineHeight, cs.fontFamily] }))
await browser.close()
server.close()
