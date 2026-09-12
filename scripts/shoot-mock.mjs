import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto('file://' + process.cwd() + '/mocks/desktop/scenario-select.html')
await page.waitForTimeout(500)
await page.screenshot({ path: 'screenshots/match/tmp-mock-raw.png', fullPage: true })
await browser.close()
