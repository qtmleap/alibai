import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Storybook 専用の vite 設定。
 *
 * アプリ側の vite.config.ts をそのまま読ませない。あちらは cloudflare() で workerd を
 * 立ち上げ、tanstackStart() でルートツリーを生成する——どちらも「画面を一枚だけ描く」
 * のに要らないうえ、Storybook のプレビューでは解決できずに落ちる。
 *
 * 別名（alias）はアプリ側と同じものを写す。ここがずれると、story からは読めるのに
 * 本番ビルドでは読めない import が生まれる。
 */
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '../src'),
      '~/db': resolve(import.meta.dirname, '../db'),
    },
  },
})
