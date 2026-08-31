import { describe, expect, test } from 'bun:test'
import { buildCharacterSheet } from '@/server/cache/scenario'

describe('buildCharacterSheet', () => {
  test('NPC はキャラクター固有情報に加えて事件の公開記録も共有する', () => {
    const sheet = buildCharacterSheet(
      {
        id: '00000000-0000-4000-8000-000000000001',
        scenarioId: '00000000-0000-4000-8000-000000000002',
        name: '証人A',
        publicIntroduction: '受付担当。',
        personality: '落ち着いている。',
        knowledge: '公開された範囲のことを知る。',
        secrets: '秘密は話さない。',
        goals: '仕事を続ける。',
        lies: 'なし',
        memories: '事件前の記憶。',
      },
      'この施設では毎年、関係者だけの催しが開かれていた。',
    )

    expect(sheet).toContain('## 事件の公開記録')
    expect(sheet).toContain('この施設では毎年、関係者だけの催しが開かれていた。')
    expect(sheet).toContain('## 人物像')
    expect(sheet).toContain('落ち着いている。')
  })
})
