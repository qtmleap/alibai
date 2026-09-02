import type { Deadline } from '@/client/components/AlibiChart'
import type { ScenarioDetail } from '@/client/lib/schemas'

/**
 * 盤面に出す刻限。
 *
 * 遺体発見時刻は事件の記録に書いてある公開情報なので、一手も打っていなくても実線で出す。
 * 死亡推定は手に入れて初めて分かるものなので、それまでは「不明」のまま点線で囲う——
 * ここを無条件に引くと、誰も検分していないのに盤面だけが死亡時刻を知ることになる。
 *
 * 開示済みかどうかを決めるのはここではない。どの証拠が刻限を明かすのかという対応表は
 * サーバに置いてあり（`db/scenario-definition.ts` の `revealsDeathTime`）、
 * こちらへ届くのは判断の結果だけ——掴んでいれば時刻、まだなら null。だから探偵の検死でも、
 * 医師の証言に紐づく証拠でも、道の違いはこの関数から見えない
 * （docs/design/deadline-window.md「何が窓を締めるか」）。
 *
 * 発見時刻を持たない事件では、その線を出さない。記録が語っていないものを、
 * 盤面が先に語るわけにいかない。
 */
export const deadlineOf = (
  victim: ScenarioDetail['victim'],
  /** 開示済みの死亡推定時刻。セッションの状態が運んでくる値をそのまま渡す。 */
  estimatedDeathAt: string | null,
): Deadline | undefined =>
  victim === null
    ? undefined
    : {
        foundAt: victim.foundAt === null ? undefined : victim.foundAt,
        label: '死亡推定',
        /*
         * そもそも死亡推定時刻を持たない事件では、印そのものを出さない。
         * 「まだ見つけていない」と「最初から無い」に同じ点線を出すと、
         * 後者では存在しないものを探せと言うことになる。
         */
        death: !victim.hasEstimatedDeathAt
          ? undefined
          : estimatedDeathAt === null
            ? { kind: 'unknown' }
            : { kind: 'fixed', at: estimatedDeathAt },
      }
