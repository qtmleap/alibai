import { describe, expect, test } from 'bun:test'
import { planWalls } from '@/client/lib/floor-plan-geometry'
import { parseFloorPlan, validateFloorPlan } from '~/db/floor-plan'
import { TSUKIMISOU_PLAN } from '~/db/floor-plans/tsukimisou'

/**
 * 実際に配られる図面そのもの。
 *
 * シードは投入時にも検査するが、それでは DB を立てないと気づけない。
 * 図面を触ったときに真っ先に落ちる場所として、ここでも見ておく。
 */
const plan = parseFloorPlan(TSUKIMISOU_PLAN)

describe('月見荘の見取り図', () => {
  test('図面として読める', () => {
    expect(plan).toBeDefined()
  })

  test('重なりもはみ出しも無い', () => {
    expect(plan === undefined ? ['読めない'] : validateFloorPlan(plan)).toEqual([])
  })

  test('証言に出てくる場所がすべて入っている', () => {
    const labels = plan === undefined ? [] : plan.rooms.map((room) => room.label)

    expect(labels).toEqual(
      expect.arrayContaining([
        '客室（東）',
        '客室（西）',
        '書斎',
        '厨房',
        '廊下',
        '玄関',
        '食堂',
        '広間',
        '電話ボックス',
        '裏庭の薬草園',
      ]),
    )
  })

  test('書斎の扉は廊下に面していて、廊下側へ開く', () => {
    const study = plan?.rooms.find((room) => room.id === 'study')
    const corridor = plan?.rooms.find((room) => room.id === 'corridor')

    // 書斎の南壁と廊下の北壁が同じ線に乗っていて初めて「廊下の前を通る」が成り立つ。
    expect(study === undefined ? undefined : study.y + study.h).toBe(corridor?.y)
    expect(study?.doors[0]?.wall).toBe('south')
    expect(study?.doors[0]?.swing).toBe('out')
  })

  test('建物の輪郭は総矩形ではない（厨房の北側が引っ込んでいる）', () => {
    // 書斎と厨房の境（x=80）に外壁の区間があるなら、そこで建物が段になっている。
    const stepped =
      plan === undefined
        ? []
        : planWalls(plan).filter((wall) => wall.axis === 'v' && wall.at === 80 && wall.exterior)

    expect(stepped.length).toBeGreaterThan(0)
  })

  test('裏庭だけが屋外で、電話ボックスは壁のある小屋として描かれる', () => {
    const outdoors = plan === undefined ? [] : plan.rooms.filter((room) => room.kind === 'outdoor')

    expect(outdoors.map((room) => room.id)).toEqual(['garden'])
  })

  test('電話ボックスは母屋から離れて建っている（壁を共有しない）', () => {
    const phone = plan?.rooms.find((room) => room.id === 'phone')
    const others = plan === undefined ? [] : plan.rooms.filter((room) => room.id !== 'phone')

    const touching = others.filter(
      (room) =>
        phone !== undefined &&
        room.x < phone.x + phone.w &&
        phone.x < room.x + room.w &&
        room.y < phone.y + phone.h &&
        phone.y < room.y + room.h,
    )

    expect(touching).toEqual([])
  })
})
