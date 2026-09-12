import type { Meta, StoryObj } from '@storybook/react-vite'
import { DEFAULT_GAME_MODE, saveGameMode } from '@/client/lib/game-mode-store'
import type { InvestigablePlace } from '@/client/lib/schemas'
import { CaseOverviewScreen } from '@/client/screens/CaseOverviewScreen'
import { SCENARIO } from '@/client/stories/fixtures'

/**
 * 調べられる場所。人物と同じ組みで名簿に並ぶので、字数の幅を人物の紹介文に寄せてある。
 * scenario には未だ載らないので、確かめる分だけここに置く。
 */
const PLACES: InvestigablePlace[] = [
  {
    id: 'choba',
    name: '帳場',
    shortName: '帳場',
    introduction: '青雨堂の一階。レジと帳面',
    situation: '閉店の片づけが、途中で止まっている',
  },
  {
    id: 'oku',
    name: '奥の間',
    shortName: '奥の間',
    introduction: '帳場の裏。倒れていた場所',
    situation: '書架のあいだに、灯りがひとつだけ点いている',
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
 * 難易度に「手がかりを出さない」を選んだ状態。
 *
 * 絵は Default と変わらない。支度は難易度を表に出す場所を一つも持たないからで、
 * モックも `#mode=nohope` と `#mode=normal` が一枚の絵として同じものになる
 * （難易度を選ぶのは事件を選ぶ画面へ移した）。この画面が難易度に触れるのは、
 * 開始時にセッションへ渡す一点だけ——残り件数の出し分けは聞き込みの側の仕事で、
 * まだセッションを持たないここには現れようがない。
 *
 * それでも状態として残すのは、「同じ絵になる」ことを確かめておきたいから。
 * 難易度がうっかり支度の見た目に漏れ出したら、この対で気づける。
 */
export const NoHope: Story = {
  // 既定の自動命名は「No Hope」と割れる。対応表はこの名で引くので、明示しておく。
  name: 'NoHope',
  beforeEach: () => {
    saveGameMode('nohope')

    return () => saveGameMode(DEFAULT_GAME_MODE)
  },
}

/**
 * 聞き込みから戻ってきたところ。進行中のセッションがあるあいだは
 * 新しく立て直さないので、操作の並びが変わる。
 */
export const Resuming: Story = {
  args: { activeSessionId: 'd4f1e620-5a83-4c19-9e07-3b6f8a2d1c54' },
}
