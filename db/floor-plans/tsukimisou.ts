import type { FloorPlanInput } from '../floor-plan'

/**
 * 事件現場の見取り図。証言に出てくる場所は必ず図に入れる。
 * 「廊下ですれ違った」という証言は、その廊下が図にあって初めて検証できる。
 *
 * 座標は 100 × 70 の論理座標。矩形は互いに重ならないよう並べてある
 * （重なると図として破綻するので、変更するときは必ず確認すること）。
 *
 * 建物の輪郭はわざと総矩形にしていない。厨房は北側が引っ込み、玄関は食堂より浅い。
 * 部屋を隙間なく敷き詰めて外周をきれいな長方形にすると、間取り図ではなく
 * 表組みに見える。旅館は継ぎ足して建つものなので、角が欠けているほうが本当らしい。
 */
export const TSUKIMISOU_PLAN: FloorPlanInput = {
  width: 100,
  height: 70,
  // 二階も階段も無い平屋なので、階を書かない。書けば読み手は二階を探す。
  title: '月見荘',
  north: 'up',
  rooms: [
    {
      id: 'guest-a',
      label: '客室（東）',
      x: 6,
      y: 6,
      w: 24,
      h: 22,
      doors: [{ wall: 'south', offset: 10, width: 4, swing: 'out' }],
      windows: [{ wall: 'north', offset: 7, width: 10 }],
    },
    {
      id: 'guest-b',
      label: '客室（西）',
      x: 30,
      y: 6,
      w: 24,
      h: 22,
      doors: [{ wall: 'south', offset: 10, width: 4, swing: 'out' }],
      windows: [{ wall: 'north', offset: 7, width: 10 }],
    },
    {
      id: 'study',
      label: '書斎',
      x: 54,
      y: 6,
      w: 26,
      h: 22,
      note: '涼子が倒れているのが見つかった',
      // 書斎の扉は廊下側へ開く。廊下を通った人物の証言と突き合わせる場所なので、
      // 開く向きまで図に出しておく。
      doors: [{ wall: 'south', offset: 12, width: 4, swing: 'out', hinge: 'end' }],
      windows: [{ wall: 'north', offset: 8, width: 10 }],
    },
    {
      // 北側が引っ込んでいて、書斎の東壁の上半分は外壁になる。
      id: 'kitchen',
      label: '厨房',
      x: 80,
      y: 14,
      w: 16,
      h: 14,
      doors: [{ wall: 'south', offset: 5, width: 4 }],
      windows: [{ wall: 'east', offset: 3, width: 8 }],
    },
    { id: 'corridor', label: '廊下', x: 6, y: 28, w: 90, h: 10, note: '書斎の前を通る' },
    {
      id: 'entrance',
      label: '玄関',
      x: 6,
      y: 38,
      w: 24,
      h: 16,
      // 北が廊下へ、南が表へ。どちらの扉も内側に開く。
      doors: [
        { wall: 'north', offset: 8, width: 4 },
        { wall: 'south', offset: 8, width: 4 },
      ],
    },
    {
      id: 'dining',
      label: '食堂',
      x: 30,
      y: 38,
      w: 26,
      h: 20,
      note: '夕食会が開かれた',
      doors: [{ wall: 'north', offset: 10, width: 4.5 }],
      windows: [{ wall: 'south', offset: 8, width: 10 }],
    },
    {
      // 食堂と広間のあいだ、廊下から入る。席を立った人物がどこへ行けたかの
      // 選択肢になるので、図に無いと「手を洗いに行っていた」という証言が検証できない。
      id: 'washroom',
      label: '厠',
      x: 56,
      y: 38,
      w: 12,
      h: 20,
      doors: [{ wall: 'north', offset: 3, width: 4 }],
    },
    {
      id: 'hall',
      label: '広間',
      x: 68,
      y: 38,
      w: 28,
      h: 20,
      doors: [
        { wall: 'north', offset: 10, width: 4.5 },
        { wall: 'south', offset: 4, width: 4.5, swing: 'out' },
      ],
      windows: [{ wall: 'east', offset: 6, width: 8 }],
    },
    {
      // 母屋から離れて建つ小屋。屋外の範囲ではなく壁のある構造物として描く。
      // 玄関の正面には置かない。人目に付く所にあると、深川が電話のために
      // 抜け出したことを誰も見ていない、という筋が通らなくなる。
      id: 'phone',
      label: '電話ボックス',
      x: 84,
      y: 59,
      w: 12,
      h: 10,
      note: '建物の外',
      doors: [{ wall: 'west', offset: 3, width: 4, swing: 'out' }],
    },
    {
      id: 'garden',
      label: '裏庭の薬草園',
      x: 26,
      y: 59,
      w: 52,
      h: 10,
      note: '旅館の裏手',
      kind: 'outdoor',
    },
  ],
}
