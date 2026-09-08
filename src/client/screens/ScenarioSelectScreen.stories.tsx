import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { ScenarioSummary } from '@/client/lib/schemas'
import { ScenarioSelectScreen } from '@/client/screens/ScenarioSelectScreen'

/**
 * ALI_SEL — 事件を選ぶ。
 * ページ送りは画面の外（ルート）が持つ状態なので、story 側で受け皿を用意する。
 */
const meta: Meta<typeof ScenarioSelectScreen> = {
  title: 'Screens/SEL 事件を選ぶ',
  component: ScenarioSelectScreen,
}

export default meta

type Story = StoryObj<typeof ScenarioSelectScreen>

/**
 * 分類・題字・人数・難易度・所要分。
 *
 * 一覧の見え方は件数で決まる。机の上は全43件を三列に流して三画面弱、端末は
 * 10件ずつで5ページ——どちらも「何件あるか」が骨格そのものなので、数件だけの
 * 作り物では確かめられない。mocks/_case.js と同じ43件を、同じ並びで持つ。
 */
const CASES: readonly (readonly [string, string, number, number, number])[] = [
  ['SFクローズドサークル', '2312年、世代船アステリア', 3, 5, 15],
  ['SFクローズドサークル', '火星、エリュシオン観測基地', 3, 5, 15],
  ['クローズドサークル', '冠水する湾岸データセンター', 4, 5, 15],
  ['クローズドサークル', '台風圏の洋上風力基地', 4, 5, 18],
  ['クローズドサークル', '四人だけの研修ロッジ', 4, 4, 15],
  ['クローズドサークル', '崖の上から帰れない', 3, 5, 15],
  ['クローズドサークル', '山道が崩れた時計博物館', 4, 5, 18],
  ['クローズドサークル', '救助隊が来るまで', 4, 5, 18],
  ['クローズドサークル', '星見ヶ丘、ロープウェイ停止', 3, 5, 15],
  ['クローズドサークル', '梢庵から出られない', 3, 5, 15],
  ['クローズドサークル', '船の来ない青凪荘', 4, 5, 18],
  ['クローズドサークル', '道路封鎖、山中研究会館', 3, 5, 18],
  ['クローズドサークル', '閉館後の海浜水族館', 4, 5, 15],
  ['クローズドサークル', '補給船の来ない夕凪灯台', 3, 5, 15],
  ['クローズドサークル', '退避航行中の「みなも」', 3, 4, 15],
  ['クローズドサークル', '白夜第六観測基地', 3, 5, 15],
  ['クローズドサークル', '河川氾濫、旧南央裁判所', 3, 5, 15],
  ['クローズドサークル', '海底居住区アビス3', 4, 5, 18],
  ['クローズドサークル', '封鎖された白嶺診療所', 3, 5, 15],
  ['クローズドサークル', '北岳観測所、吹雪の午後十時', 3, 3, 10],
  ['クローズドサークル', '雪は白庭彫刻館を閉ざした', 3, 4, 15],
  ['クローズドサークル', '白燕座、雪の終演後', 4, 4, 15],
  ['クローズドサークル', '山上の修道院から誰も帰れない', 3, 5, 15],
  ['クローズドサークル', '白樺峰に雪崩が落ちた夜', 3, 5, 15],
  ['クローズドサークル', 'ノース・レイクの深夜録音', 4, 5, 18],
  ['クローズドサークル', '朝七時、高原農園', 3, 5, 15],
  ['クローズドサークル', '落雷停止、霧岳山頂駅', 4, 4, 15],
  ['クローズドサークル', '高潮警報、文書館閉鎖', 4, 5, 18],
  ['不可能犯罪', '増水する山中発電所', 3, 5, 18],
  ['不可能犯罪', '白環館、雪の作品保存庫', 3, 5, 18],
  ['出版社ミステリ', '締切後の青燈社', 3, 3, 10],
  ['放送局ミステリ', '午前零時十二分、第二収録ブース', 3, 3, 10],
  ['日常系本格', '青雨堂、閉店後の商談', 3, 2, 10],
  ['未解決事件再調査', '四十七年目の白樺館', 3, 5, 20],
  ['植物園ミステリ', '開園前、標本庫にて', 3, 2, 10],
  ['歴史クローズドサークル', '1928年、上海河岸', 3, 5, 15],
  ['歴史クローズドサークル', '1796年、検疫島ラッザレット', 3, 5, 15],
  ['歴史クローズドサークル', '1863年、地下鉄工事区画', 3, 5, 15],
  ['祭りの夜', '祭りが暗くなった八分間', 3, 3, 10],
  ['美術館ミステリ', '内覧会は終わっていた', 3, 3, 10],
  ['船上ミステリ', '霧の中を進む「しおかぜ」', 3, 3, 10],
  ['館もの', '十七回忌、月見荘にて', 3, 2, 10],
  ['駅ミステリ', '終電が八分遅れた夜', 3, 3, 10],
]

/**
 * id はこの画面では表示に使わないが、型が uuid を求める。
 * 手で43個並べても読む人の助けにならないので、通し番号から作る。
 */
const SCENARIOS: ScenarioSummary[] = CASES.map(
  ([category, title, characterCount, difficulty, estimatedMinutes], index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    title,
    category,
    characterCount,
    difficulty,
    estimatedMinutes,
  }),
)

const Paged = ({
  scenarios,
  initialPage = 1,
}: {
  scenarios: ScenarioSummary[]
  initialPage?: number
}) => {
  const [page, setPage] = useState(initialPage)

  return (
    <ScenarioSelectScreen
      scenarios={scenarios}
      page={page}
      onPageChange={setPage}
      onSelect={() => undefined}
      onSettings={() => undefined}
    />
  )
}

export const Default: Story = {
  render: () => <Paged scenarios={SCENARIOS} />,
}

/**
 * 途中のページ。
 *
 * 前へも次へも押せる唯一の形なので、端のページだけを見ても確かめられない。
 * ページの先頭では分類を必ず出す（前の行は別のページにあり、繰り返しにならない）ことも
 * ここでしか見えない——1ページ目の先頭は、繰り返しかどうかに関わらず先頭行だから。
 */
export const Page2: Story = {
  // Storybook は export 名を「Page 2」と割ってしまう。対応表がこの綴りで引くので明示する。
  name: 'Page2',
  render: () => <Paged scenarios={SCENARIOS} initialPage={2} />,
}

/**
 * 最後のページ。43件を10件ずつで割ると3件しか残らないので、
 * 一覧が短くなってもページ送りの行が上がってこないことを確かめる。
 * 「次へ」は消さずに薄くする。
 */
export const LastPage: Story = {
  name: 'LastPage',
  render: () => <Paged scenarios={SCENARIOS} initialPage={5} />,
}

/** 1件も無いとき。ページ送りが出ないことと、空の見え方を確かめる。 */
export const Empty: Story = {
  render: () => <Paged scenarios={[]} />,
}
