import type { Deadline } from '@/client/components/AlibiChart'
import type { ChatTurn } from '@/client/hooks/useInterrogation'
import type { ScenarioDetail } from '@/client/lib/schemas'
import { VICTIM_ID } from '~/db/scenario-definition'

/**
 * 遺体を検分したか。往復が一度でもあれば、探偵は所見を手にしている。
 *
 * 本来の開示は証拠の側に「刻限のどちらの端を、どこまで動かすか」の印を持たせて、
 * 医師への聞き込みからも辿り着けるようにする（docs/design/deadline-window.md
 * 「何が窓を締めるか」）。その印が入るまでの当座の判定なので、いま窓を締める道は
 * 検分の一本だけになっている。
 */
export const examinedBody = (conversations: Record<string, ChatTurn[]>): boolean => {
  const turns = conversations[VICTIM_ID]

  return turns !== undefined && turns.length > 0
}

/**
 * 盤面に出す刻限。
 *
 * 遺体発見時刻は事件の記録に書いてある公開情報なので、一手も打っていなくても実線で出す。
 * 死亡推定は検分して初めて手に入るものなので、それまでは「不明」のまま点線で囲う——
 * ここを無条件に引くと、誰も遺体を見ていないのに盤面だけが死亡時刻を知ることになる。
 *
 * 発見時刻を持たない事件では、その線を出さない。記録が語っていないものを、
 * 盤面が先に語るわけにいかない。
 */
export const deadlineOf = (
  victim: ScenarioDetail['victim'],
  examined: boolean,
): Deadline | undefined =>
  victim === null
    ? undefined
    : {
        foundAt: victim.foundAt === null ? undefined : victim.foundAt,
        label: '死亡推定',
        death:
          examined && victim.estimatedDeathAt !== null
            ? { kind: 'fixed', at: victim.estimatedDeathAt }
            : { kind: 'unknown' },
      }
