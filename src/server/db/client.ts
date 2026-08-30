import { drizzle } from 'drizzle-orm/d1'
import * as schema from '~/db/schema'

/**
 * D1 バインディングに drizzle を被せる。
 *
 * Hyperdrive の頃と違い、ここでは接続を張らない。D1 のバインディングは
 * ランタイムが用意した RPC のハンドルなので、プールも起動時の型カタログ取得も
 * 存在しない。リクエストごとに呼んでも実費はかからず、使い回す理由も無い。
 *
 * それでも関数の形を残しているのは、read / cache / retention といった層が
 * バインディングを知らないまま Db だけを引数で受け取れるようにするため。
 * あの分離は cloudflare:workers への依存を src/server/fn/scenarios.ts の
 * 一箇所へ閉じ込めておくための構造で、D1 になっても理由は変わらない。
 */
export const createDb = (d1: D1Database) => drizzle(d1, { schema })

export type Db = ReturnType<typeof createDb>
