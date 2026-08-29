import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 15075,
    // Dev Container の外（ホストのブラウザ）から到達できるようにする
    host: true,
  },
  plugins: [
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
