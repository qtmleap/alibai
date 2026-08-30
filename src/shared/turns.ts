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
