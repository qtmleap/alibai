import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption } from 'vite'

const MOCKS = resolve(import.meta.dirname, './mocks')

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

/** mocks/ 以下の画面。一覧は mocks/index.html が index.json 経由で読む。 */
const listMocks = (dir: string, prefix: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      if (entry.isDirectory()) {
        return listMocks(join(dir, entry.name), `${prefix}${entry.name}/`)
      }

      // index.html は一覧そのものなので、一覧には並べない。
      return entry.name.endsWith('.html') && entry.name !== 'index.html'
        ? [`${prefix}${entry.name}`]
        : []
    })

/**
 * デザインモックを dev サーバから見えるようにする。
 *
 * mocks/ を public/ に置くと本番の成果物にも混ざるので、dev のときだけ差し込む
 * （apply: 'serve'）。この中継が無いと、TanStack のルータが /mocks/... を
 * アプリのSPAとして解決してしまい、モックそのものは永久に出てこない。
 */
const mockPreview = (): PluginOption => ({
  name: 'alibai:mock-preview',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/mocks', (req, res, next) => {
      const url = req.url === undefined ? '/' : req.url
      const pathname = decodeURIComponent(url.split('?')[0])
      const requested = pathname.endsWith('/') ? `${pathname}index.html` : pathname

      if (requested === '/index.json') {
        res.setHeader('Content-Type', CONTENT_TYPES['.json'])
        res.end(JSON.stringify(listMocks(MOCKS, '')))
        return
      }

      // mocks/ の外へ抜ける相対パスは辿らない。
      const target = resolve(MOCKS, `.${requested}`)

      if (!target.startsWith(MOCKS) || !existsSync(target)) {
        next()
        return
      }

      const type = CONTENT_TYPES[extname(target)]
      res.setHeader('Content-Type', type === undefined ? 'application/octet-stream' : type)
      // モックは頻繁に描き直す。キャッシュが残ると直したはずの画面が出ない。
      res.setHeader('Cache-Control', 'no-store')
      res.end(readFileSync(target))
    })
  },
})

export default defineConfig({
  server: {
    port: 15075,
    // Dev Container の外（ホストのブラウザ）から到達できるようにする
    host: true,
  },
  plugins: [
    // ミドルウェアは plugins の順に登録される。TanStack のルータより先に置かないと、
    // /mocks/... がアプリのSPAとして解決されてモックが出てこない。
    mockPreview(),
    // Worker を workerd の上で動かす。dev でも DO・Hyperdrive・KV が本番と同じ顔で解決される。
    // エントリ（main）とバインディングは wrangler.jsonc をそのまま読むので、設定の二重管理は無し。
    // viteEnvironment の名前を ssr に合わせるのは、TanStack Start の SSR ビルドを
    // Node ではなく workerd 環境として扱わせるため。
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    // ルートは src/routes 以下のディレクトリ構造から生成する（src/routeTree.gen.ts）。
    tanstackStart(),
    react(),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '~/db': resolve(import.meta.dirname, './db'),
    },
  },
})
