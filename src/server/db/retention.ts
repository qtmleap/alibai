import { inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/client'
import { playSessions } from '~/db/schema'

/**
 * 保持期間を過ぎたプレイセッションを消す。
 *
 * messages / discoveries / results は外部キーの cascade で付いてくるので、
 * ここで消すのは play_sessions だけでよい。
 * llm_usages は意図的に外部キーを張っていないため残る。「会話ログは捨てても
 * いくら使ったかの記録は残す」ことが、あのテーブルを分けた理由そのものなので、
 * ここに llm_usages への delete を足さないこと。
 */

/**
 * 1回のDELETEで消す行数。
 * cascade は子テーブルまで巻き込むので、刻まずに流すと親を掴んだままの
 * 長いトランザクションになり、その間ふつうのプレイが書き込みを待たされる。
 */
const BATCH_SIZE = 500

/**
 * 1回の起動で回すバッチ数の上限。
 * 溜まった分を一度に消し切ろうとせず、残りは次のCronに回す。
 * Workers の実行時間には上限があり、消し切るまで回す実装は
 * 「溜まっているときほど途中で落ちる」という一番困る壊れ方をする。
 */
const MAX_BATCHES = 20

/**
 * 期限切れを BATCH_SIZE 件まで削除し、実際に消えた件数を返す。
 *
 * 期限の計算は SQL 側に置く。Worker の now と DB の now がずれても
 * 境界がぶれないようにするため。
 */
const deleteBatch = async (db: Db, retentionDays: number): Promise<number> => {
  const deleted = await db
    .delete(playSessions)
    .where(
      inArray(
        playSessions.id,
        db
          .select({ id: playSessions.id })
          .from(playSessions)
          .where(lt(playSessions.startedAt, sql`now() - make_interval(days => ${retentionDays})`))
          .limit(BATCH_SIZE),
      ),
    )
    .returning({ id: playSessions.id })

  return deleted.length
}

/**
 * BATCH_SIZE 未満しか消えなくなったら、消すものが尽きたということ。
 * while を使わず再帰にしているのは、上限を引数で持ち回れば
 * 「無限に回らない」ことが型と引数の形だけで読み取れるため。
 */
const drain = async (
  db: Db,
  retentionDays: number,
  remainingBatches: number,
  purged: number,
): Promise<number> => {
  if (remainingBatches === 0) {
    return purged
  }

  const deleted = await deleteBatch(db, retentionDays)

  return deleted < BATCH_SIZE
    ? purged + deleted
    : drain(db, retentionDays, remainingBatches - 1, purged + deleted)
}

/** 消したセッション数を返す。子テーブルの削除件数は cascade 任せなので数えない。 */
export const purgeExpiredSessions = (db: Db, retentionDays: number): Promise<number> =>
  drain(db, retentionDays, MAX_BATCHES, 0)
