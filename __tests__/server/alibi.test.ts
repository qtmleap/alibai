import { describe, expect, test } from 'bun:test'
import {
  alibiSegmentsOf,
  clashOf,
  deathEstimateOf,
  type LieRef,
  type RevealedClues,
} from '@/server/game/alibi'
import type { TimelineEvent } from '~/db/timeline-event'

const event = (
  id: string,
  at: string,
  participants: string[],
  facts: string[],
  kind: TimelineEvent['kind'] = 'solid',
  record = '',
): TimelineEvent => ({ id, at, place: '', room: '', record, participants, facts, kind })

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

  test('記録の名前があれば、時刻に添えて札になる', () => {
    const segments = alibiSegmentsOf({
      events: [event('receipt', '19:08', [MAKINO], ['receipt-fact'], 'solid', '受付')],
      end: END,
      clues: clues({ evidenceSupports: ['receipt-fact'] }),
    })

    expect(segments[0]?.fix).toBe('19:08　受付')
  })

  test('記録の名前が無ければ、札は時刻だけ', () => {
    const [solid] = segmentsOf({ evidenceSupports: ['store-open'] })

    expect(solid?.fix).toBe('18:20')
  })

  test('申告だけの線には、記録の名前があっても札を付けない', () => {
    const segments = alibiSegmentsOf({
      events: [event('hearsay', '18:20', [MAKINO], ['said-so'], 'claim', '本人談')],
      end: END,
      clues: clues({ evidenceSupports: ['said-so'] }),
    })

    expect(segments[0]?.fix).toBeUndefined()
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

/*
  食い違いの印。証拠が嘘を突き崩したとき、その嘘が言い張っていた時刻に立つ。
*/
describe('clashOf', () => {
  const SENA = 'sena-uuid'

  const LIES: LieRef[] = [
    { id: 'makino-left-early', about: 'store-open', who: MAKINO },
    { id: 'kuroda-went-home', about: 'kuroda-visited', who: KURODA },
  ]

  /** 瀬名から得た証拠。人物の出所があるので、印のもう片方の端になれる。 */
  const fromSena = (contradicts: string[]) => [
    { contradicts, sources: [{ type: 'character', id: SENA }] },
  ]

  const clashWith = (contradicts: string[]) =>
    clashOf({ events: EVENTS, lies: LIES, evidences: fromSena(contradicts) })

  test('崩された嘘が無ければ、印は立たない', () => {
    expect(clashWith([])).toBeUndefined()
  })

  test('証拠が嘘を突き崩すと、その嘘が言い張っていた時刻に立つ', () => {
    expect(clashWith(['lie:kuroda-went-home'])).toEqual({
      at: '18:41',
      label: '食い違い',
      between: [KURODA, SENA],
    })
  })

  test('複数崩れても、印はいちばん早い時刻の一つだけ', () => {
    expect(clashWith(['lie:kuroda-went-home', 'lie:makino-left-early'])).toEqual({
      at: '18:20',
      label: '食い違い',
      between: [MAKINO, SENA],
    })
  })

  test('存在しない嘘を指していても、印は立たない', () => {
    expect(clashWith(['lie:no-such-lie'])).toBeUndefined()
  })

  /* contradicts は `lie:` の形だけを見る。将来ほかの接頭辞が増えても取り違えない。 */
  test('lie: 以外の書き方は読まない', () => {
    expect(clashWith(['kuroda-went-home'])).toBeUndefined()
  })

  test('嘘が指す事実がどの出来事にも無ければ、時刻が決まらないので立たない', () => {
    const orphan: LieRef[] = [{ id: 'orphan', about: 'fact-without-event', who: MAKINO }]

    expect(
      clashOf({ events: EVENTS, lies: orphan, evidences: fromSena(['lie:orphan']) }),
    ).toBeUndefined()
  })

  /*
    崩した側が誰か分からなければ、線を架ける先が無い。場所や遺体から出た証拠は
    表に列を持たないので、ここでは端になれない。
  */
  test('人物の出所を持たない証拠だけでは、印は立たない', () => {
    expect(
      clashOf({
        events: EVENTS,
        lies: LIES,
        evidences: [
          { contradicts: ['lie:kuroda-went-home'], sources: [{ type: 'location', id: 'store' }] },
        ],
      }),
    ).toBeUndefined()
  })

  /* 自分の嘘を自分で崩す証拠は端にならない。線の幅が消えて、印が一本の柱に潰れる。 */
  test('崩した出所が嘘の主と同じなら、二人にならないので立たない', () => {
    expect(
      clashOf({
        events: EVENTS,
        lies: LIES,
        evidences: [
          { contradicts: ['lie:kuroda-went-home'], sources: [{ type: 'character', id: KURODA }] },
        ],
      }),
    ).toBeUndefined()
  })

  /*
    時刻と二人は同じ嘘から取る。別々に選ぶと、牧野の嘘が言い張る時刻に
    黒田と瀬名の線が架かる——誰も言っていないことを盤面が言い出す。
  */
  test('印の時刻と二人は、同じ嘘から出る', () => {
    const clash = clashOf({
      events: EVENTS,
      lies: LIES,
      evidences: [
        { contradicts: ['lie:makino-left-early'], sources: [{ type: 'character', id: SENA }] },
        { contradicts: ['lie:kuroda-went-home'], sources: [{ type: 'character', id: MAKINO }] },
      ],
    })

    expect(clash).toEqual({ at: '18:20', label: '食い違い', between: [MAKINO, SENA] })
  })
})

describe('deathEstimateOf', () => {
  /* 事件の記録が語っているのは発見時刻だけ。死亡推定は手に入れるまで盤面に出さない。 */
  test('印の付いた証拠を掴むまでは開かない', () => {
    expect(
      deathEstimateOf({
        estimatedDeathAt: '18:50',
        evidences: [{ revealsDeathTime: false }, { revealsDeathTime: false }],
      }),
    ).toBeNull()
  })

  test('何も掴んでいなければ、当然まだ開かない', () => {
    expect(deathEstimateOf({ estimatedDeathAt: '18:50', evidences: [] })).toBeNull()
  })

  test('印の付いた証拠が一つでもあれば時刻が出る', () => {
    expect(
      deathEstimateOf({
        estimatedDeathAt: '18:50',
        evidences: [{ revealsDeathTime: false }, { revealsDeathTime: true }],
      }),
    ).toBe('18:50')
  })

  /* 検死からでも医師の見立てからでも、辿り着く先は同じ一つの時刻。 */
  test('道が二つ開いていても、返るのは一つの時刻', () => {
    expect(
      deathEstimateOf({
        estimatedDeathAt: '18:50',
        evidences: [{ revealsDeathTime: true }, { revealsDeathTime: true }],
      }),
    ).toBe('18:50')
  })

  /* 死亡推定時刻を書いていない事件では、印があっても出す時刻が無い。 */
  test('時刻を持たない事件では、印があっても null', () => {
    expect(
      deathEstimateOf({ estimatedDeathAt: null, evidences: [{ revealsDeathTime: true }] }),
    ).toBeNull()
  })
})
