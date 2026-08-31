import type { ChatTurn, InterrogationSeed } from '@/client/hooks/useInterrogation'
import type {
  AccuseResult,
  LlmSettingsResponse,
  ScenarioDetail,
  ScenarioSummary,
} from '@/client/lib/schemas'

/**
 * story のための作り物。
 *
 * 事件は mocks/ の HTML モックと同じ「雨の古書店」で揃えてある。
 * 突き合わせるときに別の事件が出てくると、どこまでが実装の差でどこからが
 * データの差なのか分からなくなる。
 */

const MAKINO = '3f1c8a20-6d4b-4f8e-9a11-2c7e5b0d4a91'
const KURODA = '7b2e4d13-8c05-4a6f-b3d2-91e6c4f70a35'
const SENA = 'c5a9f108-2e73-4b91-8d64-0af31c9e2b47'

export const SCENARIO: ScenarioDetail = {
  id: 'a1d7e930-4c62-4b18-9f05-6e83d2a4c710',
  title: '雨の古書店、十九時八分のレシート',
  category: '日常系本格',
  difficulty: 2,
  estimatedMinutes: 10,
  synopsis: '閉店後の一時間。この六十分を、誰かひとりだけが説明しきれずにいます。',
  briefing: [
    '——事件の記録を読み上げます。',
    '午後七時十五分、商店街の古書店「青雨堂」で、店主の水野英治が店の奥で死亡しているのが見つかりました。外は夕方から激しい雨。閉店時刻は午後六時半でしたが、店内には高価な初版本の商談があり、何人かが遅くまで出入りしていました。',
    '事件に関わるのは三人です。店員の牧野千尋、常連の収集家・黒田征司、向かいの喫茶店主・瀬名真琴。',
    '雨の日の商店街では、誰がどこにいたかが意外によく見えます。時刻の入った記録と三人の証言を照らし合わせ、嘘の理由と事件の真相を分けて考えてください。',
  ].join('\n\n'),
  floorPlan: null,
  timeWindow: { start: '18:20', end: '19:20' },
  victim: { name: '水野英治', introduction: '青雨堂店主。初版本の商談を抱えていた' },
  characters: [
    { id: MAKINO, name: '牧野千尋', publicIntroduction: '店員。書誌と発送手順には強い' },
    { id: KURODA, name: '黒田征司', publicIntroduction: '収集家。初版本の商談に来ていた' },
    { id: SENA, name: '瀬名真琴', publicIntroduction: '向かいの喫茶店主。雨脚を見ていた' },
  ],
}

/** 一覧の見え方を確かめるための並び。分類の偏りと文字数の幅を実物に寄せてある。 */
export const SCENARIOS: ScenarioSummary[] = [
  {
    id: '0f6b1c44-9d21-4e07-8a53-b7c2e9d10456',
    title: '世代船、三つの夜明け',
    category: 'SFクローズドサークル',
    characterCount: 3,
    difficulty: 5,
    estimatedMinutes: 15,
  },
  {
    id: '1a7c2d55-0e32-4f18-9b64-c8d3f0e21567',
    title: '火星基地、遅れて届いた返事',
    category: 'SFクローズドサークル',
    characterCount: 3,
    difficulty: 5,
    estimatedMinutes: 15,
  },
  {
    id: '2b8d3e66-1f43-4029-ac75-d9e401f32678',
    title: '台風のデータセンター、無人の保守窓',
    category: 'クローズドサークル',
    characterCount: 4,
    difficulty: 5,
    estimatedMinutes: 15,
  },
  {
    id: '3c9e4f77-2054-413a-bd86-ea0512043789',
    title: '崩落の時計博物館、十一分早い八時半',
    category: 'クローズドサークル',
    characterCount: 4,
    difficulty: 5,
    estimatedMinutes: 18,
  },
  {
    id: '4da05088-3165-424b-ce97-fb162315489a',
    title: '暴風の灯台、濡れた外套と当直板',
    category: 'クローズドサークル',
    characterCount: 3,
    difficulty: 5,
    estimatedMinutes: 15,
  },
  {
    id: '5eb16199-4276-435c-dfa8-0c27342659ab',
    title: '雪の天文台、最後の連続写真',
    category: 'クローズドサークル',
    characterCount: 3,
    difficulty: 3,
    estimatedMinutes: 10,
  },
  {
    id: '6fc272aa-5387-446d-e0b9-1d38453760bc',
    title: '豪雨の発電所、水位線の密室',
    category: '不可能犯罪',
    characterCount: 3,
    difficulty: 5,
    estimatedMinutes: 18,
  },
  {
    id: '70d383bb-6498-4570-f1ca-2e49564871cd',
    title: '二十時四十七分の契約書',
    category: '出版社ミステリ',
    characterCount: 3,
    difficulty: 3,
    estimatedMinutes: 10,
  },
  {
    id: SCENARIO.id,
    title: SCENARIO.title,
    category: SCENARIO.category,
    characterCount: SCENARIO.characters.length,
    difficulty: SCENARIO.difficulty,
    estimatedMinutes: SCENARIO.estimatedMinutes,
  },
  {
    id: '92f5a5dd-86ba-4792-13ec-406b786093ef',
    title: '1979年、雪山荘の借り物の記憶',
    category: '未解決事件再調査',
    characterCount: 3,
    difficulty: 5,
    estimatedMinutes: 20,
  },
  {
    id: 'a306b6ee-97cb-48a3-24fd-517c89719400',
    title: '月見荘、十七回忌の夜',
    category: '館もの',
    characterCount: 3,
    difficulty: 2,
    estimatedMinutes: 10,
  },
  {
    id: 'b417c7ff-a8dc-49b4-350e-628d9a820511',
    title: '終電後、遅延証明書はまだ白紙だった',
    category: '駅ミステリ',
    characterCount: 3,
    difficulty: 3,
    estimatedMinutes: 10,
  },
]

const ASKED_AT = 1_756_000_000_000

const exchange = (n: number, topic: string, question: string, answer: string): ChatTurn[] => [
  { id: `t${n}`, role: 'topic', text: topic, askedAt: ASKED_AT + n * 60_000 },
  { id: `u${n}`, role: 'user', text: question, askedAt: ASKED_AT + n * 60_000 },
  { id: `a${n}`, role: 'assistant', text: answer, askedAt: ASKED_AT + n * 60_000 },
]

/** 聞き込みが中盤まで進んだところ。表に線が何本か立っている状態を見るための種。 */
export const INTERROGATION_SEED: InterrogationSeed = {
  conversations: {
    [MAKINO]: [
      ...exchange(
        1,
        '閉店後に誰が残っていたか',
        '閉店したあと、店に残っていたのは誰ですか。',
        'わたしと、店長と、黒田さんです。黒田さんは初版本の話で六時二十三分ごろに見えました。わたしは奥の帳場にいましたから、そのあたりはよく覚えています。',
      ),
      ...exchange(
        2,
        '郵便局へ向かった時刻',
        '店を出たあと、まっすぐ郵便局へ向かったんですね。',
        'はい。発送があったので、午後六時三十六分には店を出ています。窓口の受付は午後七時八分でした。レシートも残っています。……三十分以上かかる道のりでしたけど。雨でしたから。',
      ),
    ],
    [KURODA]: [
      ...exchange(
        3,
        '来店した時刻',
        '何時ごろ、店へ来られましたか。',
        '六時二十三分です。約束の時間より少し早く着きました。初版本は水野さんが奥から出してくださる手筈でしたので、待っていました。',
      ),
    ],
  },
  discoveries: [
    { id: 'ev-receipt', label: '郵便窓口のレシート（19:08 受付）' },
    { id: 'ev-umbrella', label: '裏の路地に残された傘' },
  ],
  revelations: [],
  hint: { mode: 'normal', places: 3, people: 4 },
  questionCount: 3,
  turn: {
    turn: 4,
    maxTurns: 12,
    askedInTurn: 0,
    questionsPerTurn: 1,
    remainingInTurn: 1,
    exhausted: false,
  },
}

/** 使い切る直前。「あと一問」の見え方を確かめる。 */
export const INTERROGATION_SEED_LAST_TURN: InterrogationSeed = {
  ...INTERROGATION_SEED,
  questionCount: 11,
  turn: {
    turn: 12,
    maxTurns: 12,
    askedInTurn: 0,
    questionsPerTurn: 1,
    remainingInTurn: 1,
    exhausted: false,
  },
}

const TRUTH_TIMELINE = [
  { time: '18:28', event: '黒田が水野に、記録に残さない現金取引を持ちかける' },
  { time: '18:37', event: '水野がすり替えに気づき、牧野を問い詰める' },
  { time: '18:50', event: '牧野が店の奥で水野を襲う' },
  { time: '19:08', event: '牧野が郵便窓口で小包を発送する' },
]

export const ACCUSE_CORRECT: AccuseResult = {
  correct: true,
  result: {
    solvedSeconds: 521,
    questionCount: 9,
    evidenceFound: 6,
    contradictionCount: 2,
    methodCorrect: true,
    motiveCorrect: false,
    accuracyPercent: 78,
  },
  truth: {
    culpritCharacterId: MAKINO,
    culpritName: '牧野千尋',
    truth: '牧野は郵便局へ向かった時刻を三十分ずらして申告し、その空白で水野を襲っていた。',
    method: '帳場の奥で、書架の支柱で殴打した',
    motive: '初版本のすり替えを水野に気づかれ、問い詰められたため',
    timeline: TRUTH_TIMELINE,
  },
  deduction: {
    reasoning:
      '郵便窓口の受付が19:08である一方、瀬名は18:39から十分間、戸が一度も開かなかったと証言している。',
    method: '書架の支柱で殴った',
    motive: '金の揉め事',
    methodComment: '凶器も場所も合っています。',
    motiveComment: '金銭が絡むところまでは合っていますが、すり替えの一件までは届いていません。',
  },
}

export const ACCUSE_WRONG: AccuseResult = {
  ...ACCUSE_CORRECT,
  correct: false,
  result: {
    ...ACCUSE_CORRECT.result,
    methodCorrect: false,
    motiveCorrect: false,
    accuracyPercent: 24,
  },
  deduction: {
    reasoning: '黒田は傘を取りに戻ったと言うが、その時刻の裏付けが無い。',
    method: '路地から裏口に回って刺した',
    motive: '初版本の取引を断られたため',
    methodComment: '裏口は雨で塞がっており、通れません。',
    motiveComment: '取引は断られていません。むしろ成立しかけていました。',
  },
}

/** Google だけキー未設定。選べない提供元がある状態を見る。 */
export const LLM_SETTINGS: LlmSettingsResponse = {
  providers: [
    {
      id: 'anthropic',
      label: 'Anthropic',
      available: true,
      models: [
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
        { id: 'claude-opus-5', label: 'Claude Opus 5' },
      ],
    },
    {
      id: 'openai',
      label: 'OpenAI',
      available: true,
      models: [{ id: 'gpt-5', label: 'GPT-5' }],
    },
    {
      id: 'google',
      label: 'Google',
      available: false,
      models: [{ id: 'gemini-3-pro', label: 'Gemini 3 Pro' }],
    },
  ],
  roles: [
    { id: 'actor', label: '会話', note: 'NPCの受け答えと、探偵が組み立てる質問' },
    { id: 'judge', label: '判定', note: '証拠の開示と、推理の採点' },
  ],
  limits: {
    maxTurns: { value: 5, max: 20 },
    questionsPerTurn: { value: 1, max: 5 },
    exchangesPerTopic: { value: 3, max: 8 },
    totalQuestions: { value: 5, max: 20 },
  },
}
