import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '~/db/schema'

/**
 * Hyperdrive 経由で Neon につなぐ。
 *
 * Workers は世界中のエッジでリクエストごとに起動するので、素で Postgres に繋ぐと
 * max_connections を一瞬で使い切る。Hyperdrive が手前でプールを持ち、
 * Worker からは 1本のバインディングだけを見る形にしている。
 *
 * fetch_types: false は省略不可。postgres.js は既定で起動時に型カタログを
 * 引きにいくが、その往復が Workers 上では失敗する。
 * prepare: false は Hyperdrive のプーリングを経由するため。
 */
export const createDb = (hyperdrive: Hyperdrive) => {
  const sql = postgres(hyperdrive.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: false,
  })

  return drizzle(sql, { schema })
}

export type Db = ReturnType<typeof createDb>
