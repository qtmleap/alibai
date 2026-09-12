import { type ModelMessage, streamText } from 'ai'
import type { Env } from '@/server/env'
import { buildDetectiveBlock } from '@/server/llm/detective'
import { resolveModel } from '@/server/llm/provider'
import type { Detective } from '~/db/detective'

export type ActorContext = {
  /** リクエストスコープで検証済みの設定。APIキーとゲートウェイの出どころ。 */
  env: Env
  /**
   * この呼び出しで使うモデル。呼び出し側がリクエストごとに一度だけ決めて渡す。
   * ここで役割から引き直さないこと——同じ往復の中で別々に解決すると、
   * プレイヤーが設定を変えた瞬間に質問と返答が違うモデルで走る。
   */
  modelId: string
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
const detectiveBlocks = (detective: Detective | undefined): string[] =>
  detective === undefined ? [] : [buildDetectiveBlock(detective)]

/**
 * NPCの返答をストリーミングで返す。
 *
 * キャッシュ設計の要点:
 *   - gameRules と characterSheet は会話中まったく変化しない → プレフィックス
 *   - 探偵もセッション開始時に決まったら変わらないので、履歴より前に置いてよい
 *   - ターン数・経過時間・発見済み証拠は絶対にここへ埋め込まない
 *     （埋め込むと毎ターンprefixが変わり、キャッシュが全部無効になる）
 */
export const streamNpcReply = ({
  env,
  modelId,
  gameRules,
  characterSheet,
  detective,
  history,
  utterance,
}: ActorContext) =>
  streamText({
    model: resolveModel(env, modelId),
    /*
      前置きは system オプションに一本化する。messages の先頭に system ロールで
      積む書き方もできるが、互換サーバが Anthropic へ中継する構成だと 400 になる
      （あちらは system を最上位でしか受けない）。

      以前ブロックを分けていたのは、Anthropic のキャッシュ指定をブロック単位で
      打つためだった。その指定はもう送っていないので、分ける理由が無い。
      並び（変わらないものから先に）はそのまま保つ——自動のプレフィックスキャッシュは
      文字列の先頭一致で効くので、順序だけが効き目を決める。
    */
    system: [gameRules, characterSheet, ...detectiveBlocks(detective)].join('\n\n'),
    messages: [...history, { role: 'user', content: utterance }],
    // NPCの返答はテンポが命。深い推論より即応性を優先する。
    maxOutputTokens: 1024,
  })
