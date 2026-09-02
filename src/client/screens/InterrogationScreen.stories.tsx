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
import {
  INTERROGATION_SEED,
  INTERROGATION_SEED_LAST_TURN,
  SCENARIO,
} from '@/client/stories/fixtures'
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

if (CHOBA === undefined) {
  throw new Error('場所の story は帳場から始める前提で組んである。')
}

/**
 * アリバイ表に立つ線。
 *
 * いまのAPIは時刻付きの在所を返さないので、story が持つ。
 * 中身は mocks/_case.js の台本と同じ——別の事件を並べると、差の出所が
 * 意匠なのかデータなのか分からなくなる。
 *
 * 刻限は遺体発見だけが出ていて、死亡推定はまだ「不明」。この台本では誰も
 * 遺体を検分していないので、盤面もそこを知らない（#death=unknown と同じ状態）。
 */
const DEADLINE: Deadline = { foundAt: '19:10', label: '死亡推定', death: { kind: 'unknown' } }

/** 4ターン目まで訊いたところで開いている線。 */
const SEGMENTS_MID: AlibiSegment[] = [
  { who: MAKINO.id, from: '18:20', to: '18:36', kind: 'solid', place: '店内' },
  { who: MAKINO.id, from: '18:36', to: '19:08', kind: 'claim', place: '郵便局へ、雨のなかを' },
  {
    who: MAKINO.id,
    from: '19:08',
    to: '19:14',
    kind: 'solid',
    place: '郵便窓口',
    fix: '19:08　受付',
  },
  { who: KURODA.id, from: '18:23', to: '18:41', kind: 'solid', place: '店内', fix: '18:23　来店' },
]

/**
 * 打ち止めまで訊いたところ。三人ぶんが出そろい、食い違いが一本立つ。
 *
 * 並びは聞き出した順。端末の帯は「最後に裏付けが取れた線」に白を立てるので、
 * 人ごとにまとめて並べ替えると、その一本が別の時刻へ移る。
 */
const SEGMENTS_LAST: AlibiSegment[] = [
  ...SEGMENTS_MID,
  {
    who: KURODA.id,
    from: '18:41',
    to: '18:48',
    kind: 'solid',
    place: '裏の路地',
    fix: '18:41　忘れ傘',
  },
  { who: KURODA.id, from: '18:48', to: '19:20', kind: 'claim', place: '帰宅したと申告' },
  { who: SENA.id, from: '18:20', to: '18:39', kind: 'claim', place: '向かいの喫茶店' },
  {
    who: SENA.id,
    from: '18:39',
    to: '18:48',
    kind: 'solid',
    place: '青雨堂の軒先',
    fix: '18:39　雨宿り',
  },
  { who: 'victim', from: '18:20', to: '18:50', kind: 'solid', place: '店の奥' },
  { who: SENA.id, from: '18:48', to: '19:12', kind: 'claim', place: '喫茶店に戻る' },
  { who: SENA.id, from: '19:12', to: '19:20', kind: 'solid', place: '青雨堂', fix: '19:12　通報' },
]

/**
 * 帳場を調べ終えたところ。人の証言では出てこなかった一本が、所見から立つ。
 *
 * 立つ列は牧野。部屋そのものの列は無いので、場所を調べて分かったことは
 * 「誰がどこにいたか」として人の列に入る。
 */
const SEGMENTS_PLACE: AlibiSegment[] = [
  ...SEGMENTS_LAST,
  {
    who: MAKINO.id,
    from: '18:40',
    to: '18:44',
    kind: 'solid',
    place: '帳場',
    fix: '18:44　最後の記帳',
  },
]

const ASKED_AT = 1_756_000_000_000

/** 一往復ぶん。話題・探偵の質問・返答は同じ時刻を共有して、一本の時系列に塊のまま並ぶ。 */
const exchange = (n: number, topic: string, question: string, answer: string): ChatTurn[] => [
  { id: `t${n}`, role: 'topic', text: topic, askedAt: ASKED_AT + n * 60_000 },
  { id: `u${n}`, role: 'user', text: question, askedAt: ASKED_AT + n * 60_000 },
  { id: `a${n}`, role: 'assistant', text: answer, askedAt: ASKED_AT + n * 60_000 },
]

const merge = (base: ChatTurn[] | undefined, added: ChatTurn[]): ChatTurn[] =>
  base === undefined ? added : [...base, ...added]

/**
 * 打ち止めの回。終盤の三往復を継ぎ足して、画面の下端に映るところを揃える。
 * 最後に喋ったのが瀬名なので、開いた画面は瀬名を向いている。
 */
const LAST_TURN_SEED: InterrogationSeed = {
  ...INTERROGATION_SEED_LAST_TURN,
  conversations: {
    ...INTERROGATION_SEED_LAST_TURN.conversations,
    [MAKINO.id]: merge(
      INTERROGATION_SEED_LAST_TURN.conversations[MAKINO.id],
      exchange(
        10,
        '瀬名の証言との食い違い',
        '瀬名さんは、あなたが出ていくのを見ていないそうです。',
        '……向かいのお店から、うちの戸口が全部見えるわけではありませんから。ちょうど雨脚が強い時分でしたし。傘を差せば、顔なんて見えないでしょう。',
      ),
    ),
    [KURODA.id]: merge(
      INTERROGATION_SEED_LAST_TURN.conversations[KURODA.id],
      exchange(
        11,
        '店主と話した内容',
        '店主とは、何を話しましたか。',
        '値段の話です。もっとも、あの人はずっと店の奥にいて、出てきたのは一度きりでした。帳場に戻ってからも、奥の物音は続いていましたよ。',
      ),
    ),
    [SENA.id]: merge(
      INTERROGATION_SEED_LAST_TURN.conversations[SENA.id],
      exchange(
        12,
        '通報したときのこと',
        '通報されたのは、あなたですね。',
        'はい。灯りが点いたままなのが気になって、七時過ぎに戸を叩きました。返事がないので中へ入って……七時十二分に電話をしました。',
      ),
    ),
  },
}

/**
 * 十四手目。遺体を検分したあと、帳場へ回ったところ。
 *
 * 喋らない相手は二人続く。ログの名前はどちらも「所見」で、縦罫は遺体が芥子、
 * 帳場が灰——色の付いた相手は答え、灰のままの相手は答えない。
 */
const PLACE_SEED: InterrogationSeed = {
  ...LAST_TURN_SEED,
  conversations: {
    ...LAST_TURN_SEED.conversations,
    [VICTIM_ID]: exchange(
      13,
      '死因',
      '水野さんの死因はなんだろうか、確かめてみよう。',
      '争った跡は無い。着衣も髪も乱れていない。後頭部に、固いものが当たったような打撲がひとつ。倒れた先は帳場の奥だ。',
    ),
    [CHOBA.id]: exchange(
      14,
      '帳場の帳面',
      '帳場の帳面を見てみよう。',
      '閉店の締めが途中で止まっている。合計の欄が空のままだ。最後の記帳は六時四十四分。牧野の字で書かれている。',
    ),
  },
  questionCount: 13,
  /*
   * 場所を調べるのも一手を使う。人に訊くか現場を見るかは同じ財布から出るので、
   * 台本の十五手ぶんをそのまま持たせる。
   */
  turn: {
    turn: 14,
    maxTurns: 15,
    askedInTurn: 0,
    questionsPerTurn: 1,
    remainingInTurn: 1,
    exhausted: false,
  },
}

const Harness = ({
  seed,
  detectiveName,
  segments,
  clash,
}: {
  seed: InterrogationSeed
  detectiveName: string | null
  segments: AlibiSegment[]
  clash?: { at: string; label: string; between: [string, string] }
}) => {
  const interrogation = useInterrogation(seed)

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
      interrogation={interrogation}
      alibi={{ segments, deadline: DEADLINE, clash }}
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
  const [count, setCount] = useState(0)
  const [take, setTake] = useState(0)

  useEffect(() => {
    if (count >= SEGMENTS_LAST.length) {
      return
    }

    const timer = setTimeout(() => setCount(count + 1), SEGMENT_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [count])

  const done = count >= SEGMENTS_LAST.length

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCount(0)
          setTake(take + 1)
        }}
        className="fixed top-3 right-3 z-50 border border-keisen bg-sumi px-[9px] py-[3px] text-[10px] tracking-[0.16em] text-nezumi-dim hover:border-nezumi-dim hover:text-kinari"
      >
        もう一度（{count} / {SEGMENTS_LAST.length}）
      </button>
      <Harness
        key={take}
        seed={LAST_TURN_SEED}
        detectiveName="灰かぶりの探偵"
        segments={SEGMENTS_LAST.slice(0, count)}
        // 食い違いは線が出そろってから引く。途中で引くと、繋ぐ先がまだ無い。
        clash={done ? { at: '18:36', label: '食い違い', between: [MAKINO.id, SENA.id] } : undefined}
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
    <Harness seed={INTERROGATION_SEED} detectiveName="灰かぶりの探偵" segments={SEGMENTS_MID} />
  ),
}

/** 名乗らずに始めたセッション。会話の聞き手が一般名詞に落ちる。 */
export const Anonymous: Story = {
  render: () => <Harness seed={INTERROGATION_SEED} detectiveName={null} segments={SEGMENTS_MID} />,
}

/** 最後のターン。線が出そろい、食い違いが一本立っている。 */
export const LastTurn: Story = {
  // 既定では書き出し名を単語に割って「Last Turn」になる。突き合わせの対応表が
  // 見ているのは書き出し名そのものなので、ここで留める。
  name: 'LastTurn',
  render: () => (
    <Harness
      seed={LAST_TURN_SEED}
      detectiveName="灰かぶりの探偵"
      segments={SEGMENTS_LAST}
      clash={{ at: '18:36', label: '食い違い', between: [MAKINO.id, SENA.id] }}
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
      seed={PLACE_SEED}
      detectiveName="灰かぶりの探偵"
      segments={SEGMENTS_PLACE}
      clash={{ at: '18:36', label: '食い違い', between: [MAKINO.id, SENA.id] }}
    />
  ),
}

/** 線が増えていくところ。裏の取れた線は伸び上がり、申告だけの線は揺れて淡く残る。 */
export const 時刻表が埋まる: Story = { render: () => <Growing /> }
