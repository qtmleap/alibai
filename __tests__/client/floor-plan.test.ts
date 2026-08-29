import { describe, expect, test } from 'bun:test'
import { noteFontSize, roomFontSize } from '@/client/components/FloorPlan'

/**
 * 見取り図のラベルは、狭い部屋に長い部屋名が入ると簡単に矩形からはみ出す。
 * 実際のシードデータ（月見荘）に出てくる比率を境界値として押さえておく。
 */
describe('roomFontSize', () => {
  test('文字数が増えるほど小さくなる', () => {
    const short = roomFontSize({ label: '書斎', w: 30, h: 22 })
    const long = roomFontSize({ label: '裏庭の薬草園', w: 30, h: 22 })

    expect(long).toBeLessThan(short)
  })

  test('狭い部屋に長い名前を入れても、文字は矩形の幅に収まる', () => {
    const room = { label: '電話ボックス', w: 20, h: 15 }
    const size = roomFontSize(room)

    // 全角1文字あたり約1文字分の幅を食う前提なので、文字数 × サイズが幅を超えないこと。
    expect(size * room.label.length).toBeLessThanOrEqual(room.w)
  })

  test('平たい部屋では高さ側が上限になる', () => {
    // 幅は十分あるが高さが無い廊下。幅基準で決めると縦にはみ出す。
    const size = roomFontSize({ label: '廊下', w: 100, h: 10 })

    expect(size).toBeLessThanOrEqual(10 * 0.3)
  })

  test('ラベルが空でもゼロ除算にならない', () => {
    const size = roomFontSize({ label: '', w: 20, h: 15 })

    expect(Number.isFinite(size)).toBe(true)
    expect(size).toBeGreaterThan(0)
  })

  test('シードの全部屋で正の有限値になる', () => {
    const rooms = [
      { label: '客室（東）', w: 25, h: 22 },
      { label: '書斎', w: 30, h: 22 },
      { label: '厨房', w: 20, h: 22 },
      { label: '廊下', w: 100, h: 10 },
      { label: '玄関', w: 22, h: 23 },
      { label: '食堂', w: 38, h: 23 },
      { label: '広間', w: 40, h: 23 },
      { label: '電話ボックス', w: 20, h: 15 },
      { label: '裏庭の薬草園', w: 80, h: 15 },
    ]

    for (const room of rooms) {
      const size = roomFontSize(room)

      expect(size).toBeGreaterThan(0)
      expect(Number.isFinite(size)).toBe(true)
      expect(size * room.label.length).toBeLessThanOrEqual(room.w)
    }
  })
})

describe('noteFontSize', () => {
  test('部屋名より小さい', () => {
    expect(noteFontSize('短い注記', 100, 4)).toBeLessThan(4)
  })

  test('長い注記は部屋の幅に収まるまで縮む', () => {
    // 実データ: 幅30の書斎に15文字の注記。部屋名の比率だけで決めるとはみ出す。
    const note = '涼子が倒れているのが見つかった'
    const size = noteFontSize(note, 30, 6.6)

    expect(size * note.length).toBeLessThanOrEqual(30)
  })

  test('部屋名が極端に小さくても、注記は読める下限を割らない', () => {
    expect(noteFontSize('注記', 100, 0.5)).toBe(1.2)
  })

  test('シードの注記がすべて部屋の幅に収まる', () => {
    const noted = [
      { note: '涼子が倒れているのが見つかった', w: 30, label: '書斎', h: 22 },
      { note: '書斎の前を通る', w: 100, label: '廊下', h: 10 },
      { note: '夕食会が開かれた', w: 38, label: '食堂', h: 23 },
      { note: '建物の外', w: 20, label: '電話ボックス', h: 15 },
      { note: '旅館の裏手', w: 80, label: '裏庭の薬草園', h: 15 },
    ]

    for (const room of noted) {
      const size = noteFontSize(room.note, room.w, roomFontSize(room))

      expect(size * room.note.length).toBeLessThanOrEqual(room.w)
    }
  })
})
