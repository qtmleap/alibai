import type { Meta, StoryObj } from '@storybook/react-vite'
import { CaseOverviewScreen } from '@/client/screens/CaseOverviewScreen'
import { SCENARIO } from '@/client/stories/fixtures'

/** ALI_OVW — 支度。まだ一本も線の立っていない時刻軸と、誰から聞くかの選択。 */
const meta: Meta<typeof CaseOverviewScreen> = {
  title: 'Screens/OVW 支度',
  component: CaseOverviewScreen,
  args: {
    scenario: SCENARIO,
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
