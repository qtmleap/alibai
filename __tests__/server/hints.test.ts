import { describe, expect, test } from 'bun:test'
import { type HintItem, remainingHints } from '@/server/game/hints'
import { gameModeOf } from '~/db/game-mode'

/**
 * 月見荘を想定した並び。
 * `alibi` は深川と桐生の両方から取れる＝ source を2つ持つ項目。
 */
const items: HintItem[] = [
  { id: 'phone-log', sources: [{ type: 'character', id: 'fukagawa' }] },
  {
    id: 'alibi',
    sources: [
      { type: 'character', id: 'fukagawa' },
      { type: 'character', id: 'kiryu' },
    ],
  },
  { id: 'herbs', sources: [{ type: 'location', id: 'garden' }] },
  {
    id: 'brandy',
    sources: [
      { type: 'location', id: 'study' },
      { type: 'character', id: 'mizuki' },
    ],
  },
  // どこからも取れない項目。総数には入るが、部屋にも人物にも出ない。
  { id: 'orphan', sources: [] },
]

const roomIds = ['study', 'garden', 'kitchen']
const characterIds = ['fukagawa', 'mizuki', 'kiryu']

const hintOf = (mode: 'easy' | 'normal' | 'hard' | 'nohope', discoveredIds: string[] = []) =>
  remainingHints({ mode, items, discoveredIds, roomIds, characterIds })

describe('remainingHints: easy', () => {
  test('部屋ごと・人物ごとの残り件数を出す', () => {
    const hint = hintOf('easy')

    expect(hint).toEqual({
      mode: 'easy',
      rooms: [
        { id: 'study', remaining: 1 },
        { id: 'garden', remaining: 1 },
        { id: 'kitchen', remaining: 0 },
      ],
      characters: [
        { id: 'fukagawa', remaining: 2 },
        { id: 'mizuki', remaining: 1 },
        { id: 'kiryu', remaining: 1 },
      ],
    })
  })

  test('1件も無い部屋も残り0として並べる（並びから落とすと「何も無い」が漏れる）', () => {
    const hint = hintOf('easy')
    const rooms = hint.mode === 'easy' ? hint.rooms : []

    expect(rooms.map((room) => room.id)).toEqual(roomIds)
  })

  test('取り切った場所も並びから消さない（消すと「もう終わった」が漏れる）', () => {
    const hint = hintOf('easy', ['herbs'])
    const garden =
      hint.mode === 'easy' ? hint.rooms.find((room) => room.id === 'garden') : undefined

    expect(garden).toEqual({ id: 'garden', remaining: 0 })
  })

  test('発見すると、その項目を取れた場所と人物の両方から減る', () => {
    const hint = hintOf('easy', ['brandy'])
    const rooms = hint.mode === 'easy' ? hint.rooms : []
    const characters = hint.mode === 'easy' ? hint.characters : []

    expect(rooms.find((room) => room.id === 'study')?.remaining).toBe(0)
    expect(characters.find((character) => character.id === 'mizuki')?.remaining).toBe(0)
  })
})

describe('remainingHints: normal', () => {
  test('場所から取れるもの・人物から取れるものの合計を出す', () => {
    // 場所: herbs, brandy。人物: phone-log, alibi, brandy。
    expect(hintOf('normal')).toEqual({ mode: 'normal', places: 2, people: 3 })
  })

  test('複数の source を持つ項目も、場所・人物それぞれでは1件として数える', () => {
    // alibi は深川と桐生の2人から取れるが、人物側の合計では1件。
    const hint = hintOf('normal', ['phone-log', 'brandy'])

    expect(hint).toEqual({ mode: 'normal', places: 1, people: 1 })
  })

  test('部屋ごとの内訳は含まれない', () => {
    expect(hintOf('normal')).not.toHaveProperty('rooms')
  })
})

describe('remainingHints: hard', () => {
  test('残りの総数だけを出す（重複を除いた実数）', () => {
    expect(hintOf('hard')).toEqual({ mode: 'hard', total: 5 })
  })

  test('どこからも取れない項目も総数には含める', () => {
    // orphan 以外を全部発見しても、総数は1残る。
    const hint = hintOf('hard', ['phone-log', 'alibi', 'herbs', 'brandy'])

    expect(hint).toEqual({ mode: 'hard', total: 1 })
  })

  test('場所や人物の内訳は含まれない', () => {
    const hint = hintOf('hard')

    expect(hint).not.toHaveProperty('rooms')
    expect(hint).not.toHaveProperty('places')
  })
})

describe('remainingHints: nohope', () => {
  test('モード以外は何も入らない', () => {
    expect(hintOf('nohope')).toEqual({ mode: 'nohope' })
  })
})

describe('remainingHints: 端の場合', () => {
  test('全部発見済みならどこも0', () => {
    const discovered = items.map((item) => item.id)
    const hint = remainingHints({
      mode: 'easy',
      items,
      discoveredIds: discovered,
      roomIds,
      characterIds,
    })

    expect(hint.mode === 'easy' && hint.rooms.every((room) => room.remaining === 0)).toBe(true)
    expect(
      remainingHints({ mode: 'hard', items, discoveredIds: discovered, roomIds, characterIds }),
    ).toEqual({ mode: 'hard', total: 0 })
  })

  test('項目が1つも無くても、部屋と人物は並ぶ', () => {
    const hint = remainingHints({
      mode: 'easy',
      items: [],
      discoveredIds: [],
      roomIds,
      characterIds,
    })

    expect(hint).toEqual({
      mode: 'easy',
      rooms: roomIds.map((id) => ({ id, remaining: 0 })),
      characters: characterIds.map((id) => ({ id, remaining: 0 })),
    })
  })

  test('身に覚えのない発見済みIDが混ざっても負にならない', () => {
    // シナリオを差し替えた後の古いセッションなど。引き算で出していると負が出る。
    const hint = remainingHints({
      mode: 'hard',
      items,
      discoveredIds: ['no-such-item', 'another-ghost', 'herbs'],
      roomIds,
      characterIds,
    })

    expect(hint).toEqual({ mode: 'hard', total: 4 })
  })
})

describe('gameModeOf', () => {
  test('保存済みの値をそのまま読む', () => {
    expect(gameModeOf('easy')).toBe('easy')
    expect(gameModeOf('nohope')).toBe('nohope')
  })

  test('この機能より前に作られたセッション（NULL）はヒント無しとして扱う', () => {
    expect(gameModeOf(null)).toBe('nohope')
  })

  test('知らない値もヒント無しへ倒す', () => {
    expect(gameModeOf('impossible')).toBe('nohope')
  })
})

/*
 * 遺体由来の手掛かり。
 *
 * 出どころの type は解禁の判定では victim だが、数える側では人物へ畳んである
 * （src/server/cache/scenario.ts の asHintSource）。画面でも聴く相手の並びに
 * 一人分として出るので、そこだけ別枠にすると内訳と実際の出方が食い違う。
 */
describe('remainingHints: 遺体を数える相手に含めたとき', () => {
  const withVictim: HintItem[] = [
    ...items,
    { id: 'nail-fiber', sources: [{ type: 'character', id: 'victim' }] },
    {
      id: 'will-draft',
      sources: [
        { type: 'character', id: 'victim' },
        { type: 'character', id: 'mizuki' },
      ],
    },
  ]

  test('内訳に遺体の行が出る', () => {
    const hint = remainingHints({
      mode: 'easy',
      items: withVictim,
      discoveredIds: [],
      roomIds,
      characterIds: [...characterIds, 'victim'],
    })
    const victim = hint.mode === 'easy' ? hint.characters.find((c) => c.id === 'victim') : undefined

    expect(victim).toEqual({ id: 'victim', remaining: 2 })
  })

  test('調べられない事件では並びに出さない（数える相手に入れない）', () => {
    // 聞き込みの相手に出てこない相手へ「あと0件」と添えるのは、無いものを数えて見せることになる。
    const hint = remainingHints({
      mode: 'easy',
      items: withVictim,
      discoveredIds: [],
      roomIds,
      characterIds,
    })
    const ids = hint.mode === 'easy' ? hint.characters.map((c) => c.id) : []

    expect(ids).not.toContain('victim')
  })

  test('遺体から掴んだ分は、遺体の行からも人物の行からも減る', () => {
    const hint = remainingHints({
      mode: 'easy',
      items: withVictim,
      discoveredIds: ['will-draft'],
      roomIds,
      characterIds: [...characterIds, 'victim'],
    })
    const characters = hint.mode === 'easy' ? hint.characters : []

    // 美月は brandy も残しているので、減るのは will-draft のぶんだけ。
    expect(characters.find((c) => c.id === 'victim')?.remaining).toBe(1)
    expect(characters.find((c) => c.id === 'mizuki')?.remaining).toBe(1)
  })

  test('normal の人数にも数えられている（畳んであるので type は character）', () => {
    const hint = remainingHints({
      mode: 'normal',
      items: withVictim,
      discoveredIds: [],
      roomIds,
      characterIds: [...characterIds, 'victim'],
    })

    expect(hint).toEqual({ mode: 'normal', places: 2, people: 5 })
  })
})
