import type { Meta, StoryObj } from '@storybook/react-vite'
import { BriefingScreen } from '@/client/screens/BriefingScreen'
import { SCENARIO } from '@/client/stories/fixtures'

/** ALI_BRF — 事件の記録。せり上がる本文と、読み飛ばし。 */
const meta: Meta<typeof BriefingScreen> = {
  title: 'Screens/BRF 事件の記録',
  component: BriefingScreen,
  args: { scenario: SCENARIO, onRead: () => undefined },
}

export default meta

type Story = StoryObj<typeof BriefingScreen>

export const Default: Story = {}
