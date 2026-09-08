import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import type { AlibiSegment, Deadline } from '@/client/components/AlibiChart'
import {
  type ChatTurn,
  type InterrogationSeed,
  useInterrogation,
} from '@/client/hooks/useInterrogation'
import type { InvestigablePlace } from '@/client/lib/schemas'
import { InterrogationScreen } from '@/client/screens/InterrogationScreen'
import { INTERROGATION_SEED, SCENARIO } from '@/client/stories/fixtures'
import { VICTIM_ID } from '~/db/scenario-definition'

/**
 * ALI_INT — 聞き込み。
 *
 * interrogation は本物のフックを呼んで作る。作り物のオブジェクトを流し込むと
 * 型を緩める必要が出るうえ、実際の状態遷移と食い違う。
 * 「訊く」を押すと通信しに行って失敗する——ここで見たいのは静止した見え方。
 */
const SESSION = 'e58a1c74-9b02-4d36-af51-72c9e0b4d386'

const MAKINO = SCENARIO.characters[0]
const KURODA = SCENARIO.characters[1]
const SENA = SCENARIO.characters[2]

if (MAKINO === undefined || KURODA === undefined || SENA === undefined) {
  throw new Error('聞き込みの story は三人そろっている前提で組んである。')
}

/**
 * 調べられる場所。scenario にはまだ載らないので、支度の story と同じものをここにも置く。
 * id も揃えてある——支度で選んだ相手をそのまま聞き込みへ渡す道を、後から確かめられる。
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

const CHOBA = PLACES[0]
const OKU = PLACES[1]

if (CHOBA === undefined || OKU === undefined) {
  throw new Error('場所の story は帳場と奥の間の二つで組んである。')
}

/**
 * 聞き込みの台本。
 *
 * mocks/_case.js の script をそのまま写したもの。別の受け答えを並べると、
 * 突き合わせたときの差が意匠から来ているのかデータから来ているのか分からなくなる。
 *
 * 答えの改行は書き手が置いた呼吸で、そのまま段落の切れ目になる（モックの lines と同じ）。
 */
type Beat = {
  /** 探偵が投げる問い。モックと同じく句点は置かない。 */
  q: string
  a: string
  reveals: AlibiSegment[]
}

const SCRIPT: Record<string, Beat[]> = {
  [MAKINO.id]: [
    {
      q: '閉店したあと、店に残っていたのは誰ですか',
      a: 'わたしと、店長と、黒田さんです。黒田さんは初版本の話で六時二十三分ごろに見えました。\nわたしは奥の帳場にいましたから、そのあたりはよく覚えています。',
      reveals: [{ who: MAKINO.id, from: '18:20', to: '18:36', kind: 'solid', place: '店内' }],
    },
    {
      q: '店を出たあと、まっすぐ郵便局へ向かったんですね',
      a: 'はい。発送があったので、午後六時三十六分には店を出ています。\n……三十分以上かかる道のりでしたけど。雨でしたから。',
      reveals: [
        {
          who: MAKINO.id,
          from: '18:36',
          to: '19:08',
          kind: 'claim',
          place: '郵便局へ、雨のなかを',
        },
      ],
    },
    {
      q: 'レシートを見せてもらえますか',
      a: 'ええ、鞄に。……これです。窓口の受付は午後七時八分。\n小包の控えも一緒に残っています。日付も時刻も、機械が打ったものです。',
      reveals: [
        {
          who: MAKINO.id,
          from: '19:08',
          to: '19:14',
          kind: 'solid',
          place: '郵便窓口',
          fix: '19:08　受付',
        },
      ],
    },
    {
      q: '黒田さんとは、店で話しましたか',
      a: '少しだけ。黒田さんは初版本を見に来ていて、店長と奥で長く話していました。\nわたしが出るときは、まだ店内にいらしたはずです。',
      reveals: [
        {
          who: KURODA.id,
          from: '18:23',
          to: '18:41',
          kind: 'solid',
          place: '店内',
          fix: '18:23　来店',
        },
      ],
    },
    {
      q: '瀬名さんは、あなたが出ていくのを見ていないそうです',
      a: '……向かいのお店から、うちの戸口が全部見えるわけではありませんから。\nちょうど雨脚が強い時分でしたし。傘を差せば、顔なんて見えないでしょう。',
      reveals: [],
    },
  ],
  [KURODA.id]: [
    {
      q: '何時ごろ、店へ来られましたか',
      a: '六時二十三分です。約束の時間より少し早く着きました。\n初版本は水野さんが奥から出してくださる手筈でしたので、待っていました。',
      reveals: [
        {
          who: KURODA.id,
          from: '18:23',
          to: '18:41',
          kind: 'solid',
          place: '店内',
          fix: '18:23　来店',
        },
      ],
    },
    {
      q: '閉店後、店の奥へは入っていない',
      a: '入っていません。商談は帳場の前で済みましたから。\nそのあとは、まっすぐ帰りました。',
      reveals: [
        { who: KURODA.id, from: '18:48', to: '19:20', kind: 'claim', place: '帰宅したと申告' },
      ],
    },
    {
      q: '傘は、どうされました',
      a: '……ああ。忘れて出てしまって、裏の路地から戻ったんです。六時四十一分ごろ。\n軒下に立てかけたままで。濡れて帰るのは厭でしたから。',
      reveals: [
        {
          who: KURODA.id,
          from: '18:41',
          to: '18:48',
          kind: 'solid',
          place: '裏の路地',
          fix: '18:41　忘れ傘',
        },
      ],
    },
    {
      q: '店主とは、何を話しましたか',
      a: '値段の話です。もっとも、あの人はずっと店の奥にいて、出てきたのは一度きりでした。\n帳場に戻ってからも、奥の物音は続いていましたよ。',
      reveals: [{ who: VICTIM_ID, from: '18:20', to: '18:50', kind: 'solid', place: '店の奥' }],
    },
  ],
  [SENA.id]: [
    {
      q: 'その時間、あなたはどちらに',
      a: '向かいの店に。うちは八時まで開けていますから、ずっと中にいました。\n雨の日はお客も来ませんし、窓の外ばかり見ていました。',
      reveals: [
        { who: SENA.id, from: '18:20', to: '18:39', kind: 'claim', place: '向かいの喫茶店' },
      ],
    },
    {
      q: '青雨堂の軒先で、雨宿りをされていたと聞きました',
      a: 'ええ、六時三十九分ごろでしょうか。ゴミを出しに出たら、急に降りが強くなって。\n十分ばかり、青雨堂さんの軒を借りていました。',
      reveals: [
        {
          who: SENA.id,
          from: '18:39',
          to: '18:48',
          kind: 'solid',
          place: '青雨堂の軒先',
          fix: '18:39　雨宿り',
        },
      ],
    },
    {
      q: '通報されたのは、あなたですね',
      a: 'はい。灯りが点いたままなのが気になって、七時過ぎに戸を叩きました。\n返事がないので中へ入って……七時十二分に電話をしました。',
      reveals: [
        { who: SENA.id, from: '18:48', to: '19:12', kind: 'claim', place: '喫茶店に戻る' },
        {
          who: SENA.id,
          from: '19:12',
          to: '19:20',
          kind: 'solid',
          place: '青雨堂',
          fix: '19:12　通報',
        },
      ],
    },
    {
      q: '牧野さんが店を出ていくのは、見ましたか',
      a: '見ていません。軒先にいた十分のあいだ、あの戸は一度も開きませんでした。\n……開いていたら、音で分かります。あすこの引戸は、建て付けが悪いので。',
      reveals: [],
    },
  ],
  /*
   * 遺体の検分と場所調べ。喋らないので、探偵の一手は問いかけではなく独り言になる。
   * 返ってくるのは所見——見て取ったことだけが並ぶ。
   */
  [VICTIM_ID]: [
    {
      q: '水野さんの死因はなんだろうか、確かめてみよう',
      a: '争った跡は無い。着衣も髪も乱れていない。\n後頭部に、固いものが当たったような打撲がひとつ。倒れた先は帳場の奥だ。',
      reveals: [{ who: VICTIM_ID, from: '18:20', to: '18:50', kind: 'solid', place: '店の奥' }],
    },
  ],
  [CHOBA.id]: [
    {
      q: '帳場の帳面を見てみよう',
      a: '閉店の締めが途中で止まっている。合計の欄が空のままだ。\n最後の記帳は六時四十四分。牧野の字で書かれている。',
      reveals: [
        {
          who: MAKINO.id,
          from: '18:40',
          to: '18:44',
          kind: 'solid',
          place: '帳場',
          fix: '18:44　最後の記帳',
        },
      ],
    },
  ],
  [OKU.id]: [
    {
      q: '書架のあいだを見てみよう',
      a: '棚の一段だけ、埃の跡が新しい。本が一冊、抜かれたまま戻っていない。\n空いた場所の札に、初版本の整理番号が残っている。',
      reveals: [{ who: KURODA.id, from: '18:41', to: '18:48', kind: 'solid', place: '奥の間' }],
    },
  ],
}

/**
 * 聞き込みの順番。mocks/_mock.js の PLAY と同じ運びで、9手目に食い違いが立ち、
 * 10手目でそれを牧野に当てる。遺体の検分と場所調べも同じ財布から一手を使う。
 */
const PLAY: { who: string; i: number }[] = [
  { who: MAKINO.id, i: 0 },
  { who: MAKINO.id, i: 1 },
  { who: MAKINO.id, i: 2 },
  { who: KURODA.id, i: 0 },
  { who: KURODA.id, i: 2 },
  { who: KURODA.id, i: 1 },
  { who: SENA.id, i: 0 },
  { who: SENA.id, i: 1 },
  { who: SENA.id, i: 3 },
  { who: MAKINO.id, i: 4 },
  { who: KURODA.id, i: 3 },
  { who: SENA.id, i: 2 },
  { who: VICTIM_ID, i: 0 },
  { who: CHOBA.id, i: 0 },
  { who: OKU.id, i: 0 },
]

const MAX_TURNS = PLAY.length

const ASKED_AT = 1_756_000_000_000

const beatOf = (who: string, index: number): Beat => {
  const beat = SCRIPT[who]?.[index]

  if (beat === undefined) {
    throw new Error(`台本に無い一手を指している: ${who} / ${index}`)
  }

  return beat
}

/** 一往復ぶん。話題・探偵の質問・返答は同じ時刻を共有して、一本の時系列に塊のまま並ぶ。 */
const exchange = (n: number, beat: Beat): ChatTurn[] => [
  { id: `t${n}`, role: 'topic', text: beat.q, askedAt: ASKED_AT + n * 60_000 },
  { id: `u${n}`, role: 'user', text: beat.q, askedAt: ASKED_AT + n * 60_000 },
  { id: `a${n}`, role: 'assistant', text: beat.a, askedAt: ASKED_AT + n * 60_000 },
]

const keyOf = (segment: AlibiSegment): string =>
  `${segment.who}/${segment.from}/${segment.to}/${segment.kind}`

/** n 手目まで進めたところ。会話・線・次に訊けそうなことが、同じ台本から一度に出る。 */
const playUpTo = (n: number) => {
  const beats = PLAY.slice(0, n)
  // 相手ごとに分けて持つ。積むだけなので、袋を作り直さず手元のものへ足す。
  const conversations: Record<string, ChatTurn[]> = {}

  for (const [index, play] of beats.entries()) {
    const held = conversations[play.who]

    conversations[play.who] = [
      ...(held === undefined ? [] : held),
      ...exchange(index, beatOf(play.who, play.i)),
    ]
  }

  // 同じ線を二度開くことがある（黒田の来店は牧野からも黒田からも出る）。重ねても見え方は変わらない。
  const segments = beats
    .flatMap((play) => beatOf(play.who, play.i).reveals)
    .filter((segment, index, all) => all.findIndex((s) => keyOf(s) === keyOf(segment)) === index)

  return {
    turn: n,
    current: PLAY[n - 1]?.who,
    conversations,
    segments,
    // 次に訊けそうなこと。台本の先読みなので、残りが無ければ空。
    hints: PLAY.slice(n, n + 2).map((play) => beatOf(play.who, play.i).q),
  }
}

/**
 * 刻限。遺体発見だけが出ていて、死亡推定はまだ「不明」。この台本では誰も
 * 遺体を検分していないので、盤面もそこを知らない（#death=unknown と同じ状態）。
 */
const DEADLINE: Deadline = {
  // 発見時刻は事件の記録が語っている公開情報。モックの CASE.found と同じ 19:15。
  foundAt: SCENARIO.victim?.foundAt === null ? undefined : SCENARIO.victim?.foundAt,
  label: '死亡推定',
  death: { kind: 'unknown' },
}

/** 食い違い。牧野の申告と瀬名の証言が噛み合わない一点。九手目で立つ。 */
const CLASH = { at: '18:36', label: '食い違い', between: [MAKINO.id, SENA.id] } satisfies {
  at: string
  label: string
  between: [string, string]
}

/**
 * 経過時間。モックの Mock.clock と同じ見せかけで、計っているわけではない。
 * 十五手で十分弱に収まる速さ——一覧が「約10分」と言っている以上、
 * 画面の時計だけ二十六分を指していては辻褄が合わない。
 */
const elapsedOf = (turn: number): number => turn * 47 + 13

const seedOf = (turn: number): InterrogationSeed => ({
  ...INTERROGATION_SEED,
  conversations: playUpTo(turn).conversations,
  questionCount: turn - 1,
  turn: {
    turn,
    maxTurns: MAX_TURNS,
    askedInTurn: 0,
    questionsPerTurn: 1,
    remainingInTurn: 1,
    exhausted: false,
  },
})

/**
 * サーバの返事。経過時間はここからしか出ないので、静止画のために返しておく
 * ——画面が計器を出すかどうかは通信の成否で決まるべきではない。
 */
const serveSession = (turn: number, seed: InterrogationSeed) => {
  const original = globalThis.fetch
  const served = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    String(input).includes(`/api/sessions/${SESSION}`)
      ? Promise.resolve(
          Response.json({
            sessionId: SESSION,
            scenarioId: SCENARIO.id,
            detectiveName: '灰かぶりの探偵',
            hint: seed.hint,
            questionCount: seed.questionCount,
            elapsedSeconds: elapsedOf(turn),
            finished: false,
            discoveries: seed.discoveries,
            revelations: seed.revelations,
            alibiSegments: [],
            clash: null,
            estimatedDeathAt: null,
            turn: seed.turn,
          }),
        )
      : original(input, init)

  globalThis.fetch = Object.assign(served, { preconnect: original.preconnect })

  return () => {
    globalThis.fetch = original
  }
}

/** 帯を出しておく間隔。NewFactBand が引く 2.6 秒より短くして、途切れないようにする。 */
const BAND_INTERVAL_MS = 2400

const Harness = ({
  turn,
  detectiveName,
  newFact,
  segments,
}: {
  turn: number
  detectiveName: string | null
  /** 帯に出す一行。増えたことを知らせる帯は、増えた瞬間にしか出ない。 */
  newFact?: string
  /** 表に立てる線。台本どおりでない見え方（増えていく途中）を見たいときだけ渡す。 */
  segments?: AlibiSegment[]
}) => {
  const played = playUpTo(turn)
  const [seed] = useState(() => seedOf(turn))
  /*
    サーバの返事は、画面が最初に取りに行くより前に用意しておく必要がある
    ——子の effect は親の effect より先に走るので、ここは描画のうちに差し替える。
  */
  const [restore] = useState(() => serveSession(turn, seed))
  const interrogation = useInterrogation(seed)
  /*
    画面に入った時点で持っているぶんは帯に出ない（既知の手掛かりを知らされても
    何も増えていない）。増えたところを見たいので、開いてから足す。

    実装は 2.6 秒で帯を引くが、モックは静止画としても読まれるので出したままにしてある。
    突き合わせを成り立たせるため、ここでは足し続けて出したままにする。
  */
  const [learned, setLearned] = useState(interrogation.revelations)

  useEffect(() => restore, [restore])

  useEffect(() => {
    if (newFact === undefined) {
      return
    }

    const add = () =>
      setLearned((prev) => [
        ...prev,
        {
          id: `9d3b7c${prev.length}-0000-4000-8000-00000000000f`,
          title: newFact,
          text: newFact,
          category: '証言',
          subject: { type: 'event' as const, id: `turn-${turn}` },
        },
      ])

    add()
    const timer = setInterval(add, BAND_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [newFact, turn])

  return (
    <InterrogationScreen
      scenario={SCENARIO}
      /*
        場所はどの story にも通す。この事件では最初から調べられるので、
        端末の切り替えには相手が誰であろうと並ぶ。
      */
      places={PLACES}
      sessionId={SESSION}
      detectiveName={detectiveName}
      interrogation={{
        ...interrogation,
        revelations: learned,
        // 次に訊けそうなことはフックの外から来る（サーバが返答と一緒に返す）。
        suggestedQuestions: played.current === undefined ? {} : { [played.current]: played.hints },
      }}
      firstTarget={played.current}
      alibi={{
        segments: segments === undefined ? played.segments : segments,
        deadline: DEADLINE,
        // 食い違いは九手目で立つ。それより前は繋ぐ先がまだ無い。
        clash: turn >= 9 && segments === undefined ? CLASH : undefined,
      }}
      onAccuse={() => undefined}
      onLeave={() => undefined}
    />
  )
}

/** 線が一本増えるまでの間。立ち上がり（0.42秒）を見届けてから次が来る速さ。 */
const SEGMENT_INTERVAL_MS = 1200

/**
 * 線が一本ずつ増えていくところ。
 *
 * 聞き込みが進むと表がどう動くかを見るための story で、実際の進行とは繋がっていない
 * （サーバはまだ時刻付きの在所を返さない）。増えた線だけが一度動く、という
 * AlibiChart の作りをここで確かめる。
 */
const Growing = () => {
  const all = playUpTo(MAX_TURNS).segments
  const [count, setCount] = useState(0)
  const [take, setTake] = useState(0)

  useEffect(() => {
    if (count >= all.length) {
      return
    }

    const timer = setTimeout(() => setCount(count + 1), SEGMENT_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [count, all.length])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCount(0)
          setTake(take + 1)
        }}
        className="fixed top-3 right-3 z-50 border border-keisen bg-sumi px-[9px] py-[3px] text-[10px] text-nezumi-dim tracking-[0.16em] hover:border-nezumi-dim hover:text-kinari"
      >
        もう一度（{count} / {all.length}）
      </button>
      <Harness
        key={take}
        turn={MAX_TURNS}
        detectiveName="灰かぶりの探偵"
        segments={all.slice(0, count)}
      />
    </>
  )
}

const meta: Meta<typeof InterrogationScreen> = {
  title: 'Screens/INT 聞き込み',
  component: InterrogationScreen,
}

export default meta

type Story = StoryObj<typeof InterrogationScreen>

/** 中盤。何本か線が立ち、まだ訊ける。 */
export const Default: Story = {
  render: () => (
    <Harness
      turn={4}
      detectiveName="灰かぶりの探偵"
      newFact="牧野は午後六時三十五分に店を出たと述べた"
    />
  ),
}

/** 名乗らずに始めたセッション。会話の聞き手が一般名詞に落ちる。 */
export const Anonymous: Story = {
  render: () => <Harness turn={4} detectiveName={null} />,
}

/** 最後のターン。線が出そろい、食い違いが一本立っている。 */
export const LastTurn: Story = {
  // 既定では書き出し名を単語に割って「Last Turn」になる。突き合わせの対応表が
  // 見ているのは書き出し名そのものなので、ここで留める。
  name: 'LastTurn',
  render: () => (
    <Harness
      turn={12}
      detectiveName="灰かぶりの探偵"
      newFact="牧野は午後六時三十五分に店を出たと述べた"
    />
  ),
}

/**
 * 場所を調べているところ。帳場へ向かっているので、訊くのではなく調べる文言になる。
 *
 * 表に帳場の列は無い。列見出しはどれも光らないまま、所見から立った一本だけが
 * 牧野の列に増える。
 */
export const 場所を調べる: Story = {
  render: () => (
    <Harness
      turn={14}
      detectiveName="灰かぶりの探偵"
      newFact="帳場の帳面は午後六時四十四分で止まっていた"
    />
  ),
}

/** 線が増えていくところ。裏の取れた線は伸び上がり、申告だけの線は揺れて淡く残る。 */
export const 時刻表が埋まる: Story = { render: () => <Growing /> }
