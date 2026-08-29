import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 15075,
    // Dev Container の外（ホストのブラウザ）から到達できるようにする
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    // Worker を workerd の上で動かす。dev でも DO・Hyperdrive・KV が本番と同じ顔で解決される。
    // エントリ（main）とバインディングは wrangler.jsonc をそのまま読むので、設定の二重管理は無し。
    cloudflare(),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '~/db': resolve(import.meta.dirname, './db'),
    },
  },
})
