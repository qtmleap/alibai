import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LlmSettingsResponse } from '@/client/lib/schemas'
import { DEFAULT_SETTINGS } from '@/client/lib/settings-store'
import { SettingsScreen } from '@/client/screens/SettingsScreen'
import { LLM_SETTINGS } from '@/client/stories/fixtures'

/**
 * ALI_SET — 設定。
 * load と readSettings を差し替えられるように作られているので、
 * 通信も localStorage も使わずに全状態を出せる。
 */
const meta: Meta<typeof SettingsScreen> = {
  title: 'Screens/SET 設定',
  component: SettingsScreen,
  args: {
    onBack: () => undefined,
    readSettings: () => DEFAULT_SETTINGS,
    // 保管庫を読ませない。story ごとに前の操作が残ると、同じ絵が二度出ない。
    readBriefing: () => 'typewriter',
    readSound: () => 'on',
  },
}

export default meta

type Story = StoryObj<typeof SettingsScreen>

/** 会話だけ選び終えている。選んだ値と「既定のまま」が並んで見える状態。 */
export const Default: Story = {
  args: {
    load: () => Promise.resolve(LLM_SETTINGS),
    readSettings: () => ({
      ...DEFAULT_SETTINGS,
      llm: { actor: { provider: 'anthropic', model: 'claude-sonnet-5' } },
    }),
  },
}

/**
 * まだ何も選んでいない。既定のまま遊ぶ状態で、モデルはどの役割でも触れない。
 * 名前が NoKeys なのは、鍵を入れていない人がここに辿り着くため。
 */
export const NoKeys: Story = {
  name: 'NoKeys',
  args: { load: () => Promise.resolve(LLM_SETTINGS) },
}

/**
 * せり上がるを選んでいる状態。音は打鍵のときしか鳴らないので、
 * 打鍵音の行が沈んで押せなくなっているところを見る。
 */
export const Crawl: Story = {
  args: {
    load: () => Promise.resolve(LLM_SETTINGS),
    readBriefing: () => 'crawl',
  },
}

/** 読み込みが返ってこないあいだ。 */
export const Loading: Story = {
  args: { load: () => new Promise<LlmSettingsResponse>(() => undefined) },
}

/** 取得に失敗したとき。 */
export const Failed: Story = {
  args: { load: () => Promise.reject(new Error('設定を読み込めませんでした')) },
}
