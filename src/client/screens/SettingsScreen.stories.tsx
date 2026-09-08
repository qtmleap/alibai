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
      llm: { actor: { model: 'claude-sonnet-5' } },
    }),
  },
}

/**
 * モデルの一覧が空。鍵が未設定か、モデルサーバに繋がらないときの姿で、
 * どの役割の欄も触れず、断り書きだけが出る。取得そのものは成功しているので、
 * Failed（応答が返らない）とは別の絵になる。
 */
export const NoKeys: Story = {
  name: 'NoKeys',
  args: { load: () => Promise.resolve({ ...LLM_SETTINGS, models: [] }) },
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
