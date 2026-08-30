import { defineConfig } from 'drizzle-kit'

/*
  マイグレーションの生成専用。適用は wrangler が行う（`wrangler d1 migrations apply`）。

  drizzle-kit から D1 へ直接繋ぐ設定（driver: 'd1-http'）も選べるが、そうすると
  Cloudflare の API トークンをこのファイルの経路に持ち込むことになる。生成と適用を
  分けておけば、ここは資格情報を一切知らずに済む。ローカルの D1 は wrangler が
  .wrangler/state に持つので、接続先という概念自体がここには要らない。
*/
export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './db/migrations',
})
