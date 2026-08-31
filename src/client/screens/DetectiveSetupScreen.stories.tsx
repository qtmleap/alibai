import type { Meta, StoryObj } from '@storybook/react-vite'
import { EMPTY_STORE } from '@/client/lib/detective-store'
import { DetectiveSetupScreen, type Draft, emptyDraft } from '@/client/screens/DetectiveSetupScreen'
import { DETECTIVES, SCENARIO } from '@/client/stories/fixtures'

/**
 * ALI_DET — 探偵を決める。
 * readStore と initialDraft を差し替えられるように作られているので、
 * localStorage を仕込まずに名簿・つくる・編集する・空の4状態を出せる。
 */
const meta: Meta<typeof DetectiveSetupScreen> = {
  title: 'Screens/DET 探偵を決める',
  component: DetectiveSetupScreen,
  args: {
    scenario: SCENARIO,
    onDecided: () => undefined,
    onBack: () => undefined,
    readStore: () => DETECTIVES,
  },
}

export default meta

type Story = StoryObj<typeof DetectiveSetupScreen>

/** 名簿に3人。先頭が選択済みで、机の上では右に姿見が出る。 */
export const Default: Story = {}

/** 探偵をつくる。名前は空、年ごろは「年齢不詳」、性別は「明かさない」から始まる。 */
export const New: Story = {
  args: { initialDraft: emptyDraft() },
}

const EDIT_DRAFT: Draft = {
  id: 'akari',
  name: '日下部 灯',
  ageGroup: 'adult',
  gender: 'female',
  appearance: '背の低い痩身。読みかけの文庫をいつも外套の右に入れている。',
}

/** 探偵を編集する。1人目の値が入っていて、保存が押せる。 */
export const Edit: Story = {
  args: { initialDraft: EDIT_DRAFT },
}

/** 名簿が空。「まだ探偵がいません」と出て、事件に向かうは押せない。 */
export const Empty: Story = {
  args: { readStore: () => EMPTY_STORE },
}
