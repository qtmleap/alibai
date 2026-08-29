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
 * 状態としては DO が持つ質問回数だけが正典で、ここはそこから今のターンを導くだけ。
 * ターン番号を別に保存すると、質問回数とターンが食い違ったときにどちらが正しいか
 * 決められなくなる。
 */

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
