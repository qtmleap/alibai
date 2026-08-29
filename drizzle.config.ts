import { defineConfig } from 'drizzle-kit'
import { z } from 'zod'

// drizzle-kit は独立プロセスで動くので、ここでも最小限だけ検証する。
const databaseUrl = z.url().parse(process.env.DATABASE_URL)

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
})
