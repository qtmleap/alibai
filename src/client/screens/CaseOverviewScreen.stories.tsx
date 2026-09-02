import type { Meta, StoryObj } from '@storybook/react-vite'
import type { InvestigablePlace } from '@/client/lib/schemas'
import { CaseOverviewScreen } from '@/client/screens/CaseOverviewScreen'
import { SCENARIO } from '@/client/stories/fixtures'

/**
 * 調べられる場所。人物と同じ組みで名簿に並ぶので、字数の幅を人物の紹介文に寄せてある。
 * scenario には未だ載らないので、確かめる分だけここに置く。
 */
const PLACES: InvestigablePlace[] = [
  {
    id: 'e9b41c07-2d58-4a36-9f10-6c3b7a5d8e21',
    name: '帳場',
    introduction: '青雨堂の一階。レジと帳面',
  },
  {
    id: 'a2f70d13-8c64-4e59-b7a1-05d9e6f34c82',
    name: '奥の間',
    introduction: '帳場の裏。倒れていた場所',
  },
]

/** ALI_OVW — 支度。まだ一本も線の立っていない時刻軸と、誰から聞くかの選択。 */
const meta: Meta<typeof CaseOverviewScreen> = {
  title: 'Screens/OVW 支度',
  component: CaseOverviewScreen,
  args: {
    scenario: SCENARIO,
    places: PLACES,
    onStart: () => undefined,
    onResume: () => undefined,
    onGiveUp: () => undefined,
    onBack: () => undefined,
  },
}

export default meta

type Story = StoryObj<typeof CaseOverviewScreen>

export const Default: Story = {}

/**
 * 聞き込みから戻ってきたところ。進行中のセッションがあるあいだは
 * 新しく立て直さないので、操作の並びが変わる。
 */
export const Resuming: Story = {
  args: { activeSessionId: 'd4f1e620-5a83-4c19-9e07-3b6f8a2d1c54' },
}
