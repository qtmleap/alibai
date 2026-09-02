/**
 * ターン制の進行。
 *
 * サーバとクライアントの両方から読む。置き場所を server 配下から移したのは、
 * 画面側が「質問を投げた瞬間」にターンを進めて見せるため。サーバの判定を待つと、
 * LLMが答え終わるまでターンが変わらず、数秒おいてから急に切り替わる。
 * 同じ式を2箇所に書くと必ずずれるので、式はここ1つに置いて両方が読む。
 *
 * 判定の正典はあくまでサーバ側。ここで導いた値は表示を先回りさせるためのもので、
 * 実際に質問を通すかどうかはサーバが持つ質問回数で決まる。
 *
 * 質問を無制限に許すと「全員に片端から聞く」のが最適解になり、推理する必要がなくなる。
 * 回数を絞ると、誰に何を聞くかを選ぶこと自体がゲームになる。
 *
 * ここで数える1回は「プレイヤーが投げた話題1つ」であって、探偵とNPCが交わした往復の数
 * ではない。往復で数えると、探偵がどこまで食い下がるかでターンの減りが変わってしまう。
 *
 * 状態としては DO が持つ質問回数だけが正典で、ここはそこから今のターンを導くだけ。
 * ターン番号を別に保存すると、質問回数とターンが食い違ったときにどちらが正しいか
 * 決められなくなる。
 */

/**
 * 1つの話題につき、探偵が重ねる往復の上限。
 *
 * プレイヤーが投げるのは「〜について訊いて」という話題だけで、実際の質問は探偵役の
 * モデルが組み立てる。放っておくと気の済むまで続けるので、どこかで必ず止める必要がある。
 *
 * 止め方をプロンプト（「2〜3往復で切り上げて」）に任せてはいけない。頼むだけでは
 * 平然と超えるし、超えた分はそのまま呼び出し回数と待ち時間と請求額になる。
 * サーバのループ回数として持てば、この値が守られることが構造で決まる。
 *
 * 難易度モード（db/game-mode.ts）にぶら下げないこと。あちらが決めてよいのは
 * 「未発見の情報をどこまで教えるか」だけで、聞き込みの手応えそのものは動かさない。
 */
export const EXCHANGES_PER_TOPIC = 3

/**
 * 話題として送れる長さ。
 *
 * プレイヤーが書くのは「〜について訊いて」という一言の指示で、質問の文面ではない。
 * 長く書けると質問そのものを書き下したくなり、探偵に任せる作りと噛み合わなくなる。
 *
 * 入力欄とサーバの検証で同じ値を読む。片方だけ広いと、画面では書けるのに送ると
 * 弾かれる（あるいはその逆の）状態ができる。
 */
export const MAX_TOPIC_CHARS = 140

/**
 * プレイヤーが設定画面から動かせる進行の数値と、その上限。
 *
 * 上限が要るのは、この3つの積が**1プレイのコストの唯一の天井**だから。
 * 1回の話題で最大 `2 × exchangesPerTopic + 1` 回モデルを呼ぶので、
 * 3つとも自由に上げられると天井そのものが消える。
 *
 * 積の上限を別に持つのは、`maxTurns` と `questionsPerTurn` を両方上限まで上げられると
 * 質問回数が 45 まで伸びるため。事件に登場するのは3〜5人なので、そこまで訊けると
 * 全員に片端から聞く余裕が生まれ、絞って訊くことがゲームでなくなる。
 */
export const LIMIT_CEILINGS = {
  maxTurns: 15,
  questionsPerTurn: 3,
  exchangesPerTopic: 5,
  /**
   * maxTurns × questionsPerTurn の上限。
   *
   * 20 から 30 へ引き上げてある。3人の相手に20問だと、矛盾を見つけてから
   * それを突く問いに手が回らないまま終わる——一巡目で持ち札を使い切ってしまう。
   */
  totalQuestions: 30,
}

export type SessionLimits = {
  maxTurns: number
  questionsPerTurn: number
  exchangesPerTopic: number
}

/**
 * 受け取った希望を、遊べる範囲へ収める。
 *
 * 範囲外をエラーにせず切り詰めるのは、古い設定が localStorage に残っているだけの
 * プレイヤーを事件の途中で締め出さないため。積の上限に当たったときに削るのは
 * `questionsPerTurn` のほう——ターン数を削るとゲームの見た目の長さが変わってしまう。
 */
export const clampLimits = (
  wanted: Partial<SessionLimits>,
  fallback: SessionLimits,
): SessionLimits => {
  const pick = (value: number | undefined, ceiling: number, base: number): number =>
    value === undefined || !Number.isFinite(value)
      ? Math.min(base, ceiling)
      : Math.min(Math.max(1, Math.floor(value)), ceiling)

  const maxTurns = pick(wanted.maxTurns, LIMIT_CEILINGS.maxTurns, fallback.maxTurns)
  const wantedPerTurn = pick(
    wanted.questionsPerTurn,
    LIMIT_CEILINGS.questionsPerTurn,
    fallback.questionsPerTurn,
  )

  return {
    maxTurns,
    questionsPerTurn: Math.max(
      1,
      Math.min(wantedPerTurn, Math.floor(LIMIT_CEILINGS.totalQuestions / maxTurns)),
    ),
    exchangesPerTopic: pick(
      wanted.exchangesPerTopic,
      LIMIT_CEILINGS.exchangesPerTopic,
      fallback.exchangesPerTopic,
    ),
  }
}

/**
 * 1つの話題を処理するのに走るモデル呼び出しの回数。
 *
 * 往復ごとに「質問を組み立てる」と「NPCが答える」の2回、最後に判定が1回。
 * レート制限をこの重みで消費させることで、往復数を増やしたプレイヤーが
 * 同じ予算をその分速く使い切るようになる。
 */
export const modelCallsPerTopic = (exchangesPerTopic: number): number => 2 * exchangesPerTopic + 1

/**
 * 遺体や場所を検分するときのモデル呼び出しの回数。
 *
 * 何を調べるかを組み立てて1回、所見を書き起こして1回、判定で1回。
 * 相手が喋らないので往復しない——聞き込み（既定7回）より軽い。
 * ターンは同じく1問ぶん使うが、予算の減り方はこの重みで数える。
 */
export const EXAMINATION_MODEL_CALLS = 3

export type TurnState = {
  /** 何ターン目か。1始まり。使い切ったあとは最終ターンの番号で止まる。 */
  turn: number
  maxTurns: number
  /** このターンで既に使った質問数。 */
  askedInTurn: number
  questionsPerTurn: number
  /** このターンであと何回聞けるか。 */
  remainingInTurn: number
  /** 全ターンを使い切ったか。true なら質問を受け付けない。 */
  exhausted: boolean
}

export const turnStateOf = (
  questionCount: number,
  maxTurns: number,
  questionsPerTurn: number,
): TurnState => {
  const asked = Math.max(0, questionCount)
  const total = maxTurns * questionsPerTurn
  const exhausted = asked >= total

  // 使い切ったあとは最終ターンに留める。「6ターン目」と表示されると
  // まだ続きがあるように見えてしまう。
  const rawTurn = Math.floor(asked / questionsPerTurn) + 1
  const turn = Math.min(maxTurns, rawTurn)
  const askedInTurn = exhausted ? questionsPerTurn : asked % questionsPerTurn

  return {
    turn,
    maxTurns,
    askedInTurn,
    questionsPerTurn,
    remainingInTurn: questionsPerTurn - askedInTurn,
    exhausted,
  }
}

/**
 * いま投げた1問を織り込んだ次の状態。
 *
 * サーバが質問回数を増やすのは返答を届け終えたあとなので、そこを待つと
 * 数秒おいて急にターンが切り替わる。投げた瞬間にこちらで先へ進めておき、
 * サーバの確定値が届いたらそれで上書きする。
 *
 * 質問回数を持ち回らずに済ませるため、いまのターンと消化数から逆算する。
 * 表示のための先回りなので、実際に質問を通すかどうかはサーバが決める。
 */
export const advanceTurn = (state: TurnState): TurnState => {
  const asked = (state.turn - 1) * state.questionsPerTurn + state.askedInTurn

  return turnStateOf(asked + 1, state.maxTurns, state.questionsPerTurn)
}
