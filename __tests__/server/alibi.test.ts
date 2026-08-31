import { describe, expect, test } from 'bun:test'
import { alibiSegmentsOf, type RevealedClues } from '@/server/game/alibi'
import type { TimelineEvent } from '~/db/timeline-event'

const event = (
  id: string,
  at: string,
  participants: string[],
  facts: string[],
  kind: TimelineEvent['kind'] = 'solid',
): TimelineEvent => ({ id, at, place: '', participants, facts, kind })

const MAKINO = 'makino-uuid'
const KURODA = 'kuroda-uuid'

/** 三つの出来事。牧野は最初と最後、黒田は真ん中と最後に居合わせる。 */
const EVENTS: TimelineEvent[] = [
  event('opens', '18:20', [MAKINO], ['store-open']),
  event('visit', '18:41', [KURODA], ['kuroda-visited']),
  event('found', '19:12', [MAKINO, KURODA], ['body-found']),
]

const END = '19:30'

const clues = (partial: Partial<RevealedClues>): RevealedClues => ({
  revelations: [],
  evidenceSupports: [],
  ...partial,
})

const segmentsOf = (given: Partial<RevealedClues>) =>
  alibiSegmentsOf({ events: EVENTS, end: END, clues: clues(given) })

describe('alibiSegmentsOf', () => {
  test('何も掴んでいなければ、線は一本も引かれない', () => {
    expect(segmentsOf({})).toEqual([])
  })

  test('掴んだ手掛かりが触れている事実から、その出来事が開く', () => {
    const segments = segmentsOf({
      revelations: [{ subjectType: 'character', subjectId: MAKINO, relatedFacts: ['store-open'] }],
    })

    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ who: MAKINO, from: '18:20', to: END })
  })

  test('出来事を名指しした revelation は、その出来事を直に開く', () => {
    const segments = segmentsOf({
      revelations: [{ subjectType: 'event', subjectId: 'visit', relatedFacts: [] }],
    })

    expect(segments.map((s) => s.who)).toEqual([KURODA])
  })

  test('証拠が裏付ける事実でも開く', () => {
    const segments = segmentsOf({ evidenceSupports: ['body-found'] })

    expect(segments.map((s) => s.who).toSorted()).toEqual([KURODA, MAKINO].toSorted())
  })

  /*
    未発見の出来事を線の終わりに使うと、まだ知らないはずの時刻が
    線の長さとして漏れる。牧野の 18:20 の線は、牧野について次に分かっている
    19:12 まで伸びるのが正しい。
  */
  test('線の終わりは、その人について次に分かっている出来事まで', () => {
    const segments = segmentsOf({ evidenceSupports: ['store-open', 'body-found'] })
    const makino = segments.filter((s) => s.who === MAKINO)

    expect(makino).toHaveLength(2)
    expect(makino[0]).toMatchObject({ from: '18:20', to: '19:12' })
    expect(makino[1]).toMatchObject({ from: '19:12', to: END })
  })

  test('知る前の線は、知らない区間をまたいで伸びている', () => {
    const before = segmentsOf({ evidenceSupports: ['store-open'] })

    expect(before[0]).toMatchObject({ from: '18:20', to: END })
  })

  test('裏付けのある線にだけ時刻の印が付く', () => {
    const [solid] = segmentsOf({ evidenceSupports: ['store-open'] })
    const [claim] = alibiSegmentsOf({
      events: [event('hearsay', '18:20', [MAKINO], ['said-so'], 'claim')],
      end: END,
      clues: clues({ evidenceSupports: ['said-so'] }),
    })

    expect(solid).toMatchObject({ kind: 'solid', fix: '18:20' })
    expect(claim?.kind).toBe('claim')
    expect(claim?.fix).toBeUndefined()
  })

  test('幕切れに重なる出来事は線にならない', () => {
    const segments = alibiSegmentsOf({
      events: [event('late', END, [MAKINO], ['late-fact'])],
      end: END,
      clues: clues({ evidenceSupports: ['late-fact'] }),
    })

    expect(segments).toEqual([])
  })
})
