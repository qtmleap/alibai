/* 使い捨て。モックと story を同寸で撮り、指定の区画だけ上下に並べて見る。 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const [id, view, ...rects] = process.argv.slice(2)
const w = view === 'desktop' ? 1440 : 390
const h = view === 'desktop' ? 900 : 844
const dir = view === 'desktop' ? 'desktop' : 'mobile'

const browser = await chromium.launch()
const shoot = async (url) => {
  const p = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.evaluate(() => document.fonts.ready)
  if (url.includes('iframe.html')) {
    await p.waitForFunction(() => document.querySelector('#storybook-root')?.childElementCount > 0)
  }
  await p.waitForTimeout(900)
  const s = (await p.screenshot()).toString('base64')
  await p.close()
  return s
}
const mock = await shoot(`file:///home/vscode/app/mocks/${dir}/case-overview.html#mode=nohope`)
const impl = await shoot(`http://127.0.0.1:6099/iframe.html?id=${id}&viewMode=story`)

mkdirSync('screenshots/crop', { recursive: true })
for (const rect of rects) {
  const [x, y, cw, ch] = rect.split(',').map(Number)
  const page = await browser.newPage({ viewport: { width: cw + 20, height: ch * 2 + 60 }, deviceScaleFactor: 2 })
  await page.setContent(`
    <style>body{margin:0;background:#111;padding:10px;font:11px monospace;color:#888}
    .b{width:${cw}px;height:${ch}px;overflow:hidden;position:relative;margin-bottom:8px}
    .b img{position:absolute;left:${-x}px;top:${-y}px}</style>
    <div>mock</div><div class="b"><img src="data:image/png;base64,${mock}"></div>
    <div>impl</div><div class="b"><img src="data:image/png;base64,${impl}"></div>`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `screenshots/crop/${view}-${rect.replace(/,/g, '_')}.png` })
  await page.close()
}
await browser.close()
