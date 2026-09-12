import { describe, expect, test } from 'bun:test'
import { buildCharacterSheet } from '@/server/cache/scenario'

const row = (overrides: Partial<Parameters<typeof buildCharacterSheet>[0]> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  scenarioId: '00000000-0000-4000-8000-000000000002',
  name: '証人A',
  shortName: '証人',
  ageGroup: 'unknown' as const,
  gender: 'unknown' as const,
  publicIntroduction: '受付担当。',
  personality: '落ち着いている。',
  knowledge: '公開された範囲のことを知る。',
  secrets: '秘密は話さない。',
  goals: '仕事を続ける。',
  lies: 'なし',
  lieRefs: [],
  memories: '事件前の記憶。',
  ...overrides,
})

const BRIEFING = 'この施設では毎年、関係者だけの催しが開かれていた。'

describe('buildCharacterSheet', () => {
  test('NPC はキャラクター固有情報に加えて事件の公開記録も共有する', () => {
    const sheet = buildCharacterSheet(row(), BRIEFING)

    expect(sheet).toContain('## 事件の公開記録')
    expect(sheet).toContain(BRIEFING)
    expect(sheet).toContain('## 人物像')
    expect(sheet).toContain('落ち着いている。')
  })

  test('年ごろと性別は人物像の一行目に入る', () => {
    const sheet = buildCharacterSheet(row({ ageGroup: 'teen', gender: 'female' }), BRIEFING)

    expect(sheet).toContain(
      '## 人物像\n年ごろは十代（13〜19歳ごろ）。性別は女性。\n落ち着いている。',
    )
  })

  test('unknown の側は落ちる', () => {
    const sheet = buildCharacterSheet(row({ ageGroup: 'elder' }), BRIEFING)

    expect(sheet).toContain('## 人物像\n年ごろは老齢（70代以上）。\n落ち着いている。')
    expect(sheet).not.toContain('性別')
  })

  test('どちらも書かれていなければ人物像は文章だけ', () => {
    const sheet = buildCharacterSheet(row(), BRIEFING)

    expect(sheet).toContain('## 人物像\n落ち着いている。')
  })
})
