import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AlibiPerson, AlibiSegment } from '@/client/components/AlibiChart'
import { ResultScreen } from '@/client/screens/ResultScreen'
import { ACCUSE_CORRECT, ACCUSE_WRONG } from '@/client/stories/fixtures'

/*
 * 事件は「雨の古書店」で揃える。アリバイ表の story と同じ供述を使う——
 * 違う事件を並べると、差の出所が意匠なのかデータなのか分からなくなる。
 */
const MAKINO = ACCUSE_CORRECT.truth.culpritCharacterId

const people: AlibiPerson[] = [
  { key: MAKINO, name: '牧野千尋', role: '店員', hue: 'asagi' },
  { key: 'kuroda', name: '黒田征司', role: '収集家', hue: 'fuji' },
  { key: 'sena', name: '瀬名真琴', role: '喫茶店主', hue: 'suou' },
  { key: 'mizuno', name: '水野英治', role: '被害者', hue: 'karashi' },
]

const segments: AlibiSegment[] = [
  { who: MAKINO, from: '18:20', to: '18:36', kind: 'solid', place: '店内' },
  { who: MAKINO, from: '18:36', to: '19:08', kind: 'claim', place: '郵便局へ、雨のなかを' },
  { who: MAKINO, from: '19:08', to: '19:14', kind: 'solid', place: '郵便窓口', fix: '19:08　受付' },
  { who: 'kuroda', from: '18:23', to: '18:41', kind: 'solid', place: '店内', fix: '18:23　来店' },
  {
    who: 'kuroda',
    from: '18:41',
    to: '18:48',
    kind: 'solid',
    place: '裏の路地',
    fix: '18:41　忘れ傘',
  },
  { who: 'kuroda', from: '18:48', to: '19:20', kind: 'claim', place: '帰宅したと申告' },
  { who: 'sena', from: '18:20', to: '18:39', kind: 'claim', place: '向かいの喫茶店' },
  {
    who: 'sena',
    from: '18:39',
    to: '18:48',
    kind: 'solid',
    place: '青雨堂の軒先',
    fix: '18:39　雨宿り',
  },
  { who: 'sena', from: '18:48', to: '19:12', kind: 'claim', place: '喫茶店に戻る' },
  { who: 'sena', from: '19:12', to: '19:20', kind: 'solid', place: '青雨堂', fix: '19:12　通報' },
  { who: 'mizuno', from: '18:20', to: '18:50', kind: 'solid', place: '店の奥' },
]

const board = {
  title: '雨の古書店、十九時八分のレシート',
  place: '青雨堂',
  people,
  segments,
  span: { from: '18:20', to: '19:20' },
  deadline: { at: '18:50', label: '死亡' },
  truth: [
    { who: MAKINO, from: '18:20', to: '18:50', note: '申告より14分ぶん長い' },
    { who: 'kuroda', from: '18:23', to: '18:48' },
    { who: 'sena', from: '18:39', to: '18:48' },
    { who: 'sena', from: '19:12', to: '19:20' },
    { who: 'mizuno', from: '18:20', to: '18:50' },
  ],
}

/** ALI_RES — 結果。解決したときと、二通りの迷宮入り。 */
const meta: Meta<typeof ResultScreen> = {
  title: 'Screens/RES 結果',
  component: ResultScreen,
  args: { board, onRetry: () => undefined, onRestart: () => undefined },
}

export default meta

type Story = StoryObj<typeof ResultScreen>

/** 犯人も殺害方法も当てた。真相を開き、表に申告と実際を二本引く。 */
export const Solved: Story = {
  args: { accuseResult: ACCUSE_CORRECT },
}

/** 犯人は言い当てたが、筋書きが立たなかった。迷宮入りなので真相は開かない。 */
export const Missed: Story = {
  args: {
    accuseResult: {
      ...ACCUSE_WRONG,
      correct: true,
      result: { ...ACCUSE_WRONG.result, methodCorrect: false },
    },
  },
}

/** 犯人そのものを外した。名前も出さない——返すのは「外した」ことだけ。 */
export const MissedCulprit: Story = {
  args: { accuseResult: ACCUSE_WRONG },
}
