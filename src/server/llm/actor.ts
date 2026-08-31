import { type ModelMessage, streamText } from 'ai'
import type { Env } from '@/server/env'
import { buildDetectiveBlock } from '@/server/llm/detective'
import { cacheHint, type LlmChoice, resolveModel } from '@/server/llm/provider'
import type { Detective } from '~/db/detective'

export type ActorContext = {
  /** リクエストスコープで検証済みの設定。APIキーとゲートウェイの出どころ。 */
  env: Env
  /**
   * この呼び出しで使う組み合わせ。呼び出し側がリクエストごとに一度だけ決めて渡す。
   * ここで役割から引き直さないこと——モデルとキャッシュ指定が別々に解決されると、
   * プロバイダを差し替えたときに片方だけ古い値のまま残る。
   */
  choice: LlmChoice
  /** 全シナリオ共通のゲームルール。最も安定するのでプレフィックス先頭に置く。 */
  gameRules: string
  /** このNPCの人格・知識・秘密・目的・嘘・記憶。真相は絶対に含めない。 */
  characterSheet: string
  /** プレイヤーが演じる探偵。名乗らずに始めることもできるので undefined を許す。 */
  detective: Detective | undefined
  /** このNPCとの会話履歴のみ。他NPCとの会話は混ぜない。 */
  history: ModelMessage[]
  /** プレイヤーの発話。必ずuserロールに閉じ込める。 */
  utterance: string
}

/**
 * 目の前にいる探偵の紹介。
 *
 * プレイヤーが自分で決めた人物像に NPC が反応することで聞き込みの手触りが変わるので、
 * 人格の一部としてプロンプトに入れる。呼びかけ方まで含めた文面の組み立ては
 * `@/server/llm/detective` が持つ。ただし「探偵が何を知っているか」は書かない。
 * NPCが勝手にプレイヤーの推理状況を前提にして喋り出すと、ゲームが先回りしてしまう。
 */
const buildDetectiveMessages = (detective: Detective | undefined): ModelMessage[] =>
  detective === undefined ? [] : [{ role: 'system', content: buildDetectiveBlock(detective) }]

/**
 * NPCの返答をストリーミングで返す。
 *
 * キャッシュ設計の要点:
 *   - gameRules と characterSheet は会話中まったく変化しない → プレフィックス
 *   - 探偵もセッション開始時に決まったら変わらないので、履歴より前に置いてよい
 *     （cacheHint は付けない。数行しかなく最小キャッシュ長に届かないので、
 *       ブレークポイントを1つ消費するだけ無駄になる）
 *   - ターン数・経過時間・発見済み証拠は絶対にここへ埋め込まない
 *     （埋め込むと毎ターンprefixが変わり、キャッシュが全部無効になる）
 */
export const streamNpcReply = ({
  env,
  choice,
  gameRules,
  characterSheet,
  detective,
  history,
  utterance,
}: ActorContext) =>
  streamText({
    model: resolveModel(env, choice),
    // system を messages 側に置くことを明示的に許可する。
    //
    // AI SDK は既定でこれを警告する（プレイヤー由来の文字列が system に混ざる経路を
    // 作りやすいため）。ここでそれでも messages に置くのは、Anthropic の
    // cacheControl が「ブロック単位」の指定で、system オプション（ただの文字列）では
    // ゲームルールとキャラクターシートに別々のブレークポイントを打てないから。
    // キャッシュ設計を捨てるとランニングコストが一桁変わる。
    //
    // プレイヤーの発話は必ず user ロールに閉じ込めており（utterance を
    // system 側へ混ぜる経路はこの関数に存在しない）、警告が想定する事故は起きない。
    allowSystemInMessages: true,
    messages: [
      {
        role: 'system',
        content: gameRules,
        providerOptions: cacheHint(choice),
      },
      {
        role: 'system',
        content: characterSheet,
        providerOptions: cacheHint(choice),
      },
      ...buildDetectiveMessages(detective),
      ...history,
      { role: 'user', content: utterance },
    ],
    // NPCの返答はテンポが命。深い推論より即応性を優先する。
    maxOutputTokens: 1024,
  })
