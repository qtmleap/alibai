import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlibiChart } from './AlibiChart'

/*
 * 突き合わせの相手は mocks/desktop/*.html の左半分。
 * 事件は「雨の古書店」で揃えてある——違う事件を並べると、差の出所が
 * 意匠なのかデータなのか分からなくなる。
 */
const people = [
  { key: 'makino', name: '牧野千尋', role: '店員', hue: 'asagi' as const },
  { key: 'kuroda', name: '黒田征司', role: '収集家', hue: 'fuji' as const },
  { key: 'sena', name: '瀬名真琴', role: '喫茶店主', hue: 'suou' as const },
  { key: 'mizuno', name: '水野英治', role: '被害者', hue: 'karashi' as const },
]

const span = { from: '18:20', to: '19:20' }
const deadline = { at: '18:50', label: '死亡推定' }

const filled = [
  { who: 'makino', from: '18:20', to: '18:36', kind: 'solid' as const, place: '店内' },
  {
    who: 'makino',
    from: '18:36',
    to: '19:08',
    kind: 'claim' as const,
    place: '郵便局へ、雨のなかを',
  },
  {
    who: 'makino',
    from: '19:08',
    to: '19:14',
    kind: 'solid' as const,
    place: '郵便窓口',
    fix: '19:08　受付',
  },
  {
    who: 'kuroda',
    from: '18:23',
    to: '18:41',
    kind: 'solid' as const,
    place: '店内',
    fix: '18:23　来店',
  },
  {
    who: 'kuroda',
    from: '18:41',
    to: '18:48',
    kind: 'solid' as const,
    place: '裏の路地',
    fix: '18:41　忘れ傘',
  },
  { who: 'kuroda', from: '18:48', to: '19:20', kind: 'claim' as const, place: '帰宅したと申告' },
  { who: 'sena', from: '18:20', to: '18:39', kind: 'claim' as const, place: '向かいの喫茶店' },
  {
    who: 'sena',
    from: '18:39',
    to: '18:48',
    kind: 'solid' as const,
    place: '青雨堂の軒先',
    fix: '18:39　雨宿り',
  },
  { who: 'sena', from: '18:48', to: '19:12', kind: 'claim' as const, place: '喫茶店に戻る' },
  {
    who: 'sena',
    from: '19:12',
    to: '19:20',
    kind: 'solid' as const,
    place: '青雨堂',
    fix: '19:12　通報',
  },
  { who: 'mizuno', from: '18:20', to: '18:50', kind: 'solid' as const, place: '店の奥' },
]

const meta = {
  title: 'Parts/アリバイ表',
  component: AlibiChart,
  // 机の左半分と同じ幅に置く。幅が違うと列幅が変わり、註の折り返しが別物になる。
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="w-[524px] px-[22px] pt-[14px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AlibiChart>

export default meta
type Story = StoryObj<typeof meta>

/** 支度の画面。まだ一本も引かれていない。 */
export const Empty: Story = {
  args: { people, segments: [], span, deadline },
}

/** 打ち止めまで聞いたところ。告発の画面がこれを見る。 */
export const Filled: Story = {
  args: { people, segments: filled, span, deadline },
}

/** 結果。同じ列に二本——破線が聞き取った申告、実線が実際。ずれた区間にだけ言葉を足す。 */
export const Compared: Story = {
  args: {
    people: people.map((p) => (p.key === 'makino' ? { ...p, role: '犯人', roleSolved: true } : p)),
    segments: filled,
    span,
    deadline: { at: '18:50', label: '死亡' },
    truth: [
      { who: 'makino', from: '18:20', to: '18:50', note: '申告より14分ぶん長い' },
      { who: 'kuroda', from: '18:23', to: '18:48' },
      { who: 'sena', from: '18:39', to: '18:48' },
      { who: 'sena', from: '19:12', to: '19:20' },
      { who: 'mizuno', from: '18:20', to: '18:50' },
    ],
  },
}

/** 聞き込みの最中。相手の列だけ地が起き、食い違いが一本立つ。 */
export const Interrogating: Story = {
  args: {
    people,
    segments: filled,
    span,
    deadline,
    activeKey: 'sena',
    clash: { at: '18:36', label: '食い違い' },
    litFix: '19:08　受付',
    onPick: () => {},
  },
}
