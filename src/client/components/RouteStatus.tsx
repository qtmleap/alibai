import { Link } from '@tanstack/react-router'

/**
 * ルータが直接描く3つの状態（読み込み中・見つからない・エラー）。
 *
 * 既定のままだと白地に「Not Found」とだけ出て、暗い画面で通してきた作りが
 * そこだけ剥がれる。凝ったものは要らないが、地の色と文字の調子は揃える。
 */

const frame =
  'mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 bg-slate-950 px-5 text-center text-slate-100'

/** データが届くまでの間。SSR しない画面ではサーバがこれを描く。 */
export const RoutePending = () => (
  <div className={frame}>
    <p className="text-xs tracking-[0.3em] text-slate-600">読み込み中…</p>
  </div>
)

export const RouteNotFound = () => (
  <div className={frame}>
    <p className="text-xs tracking-[0.3em] text-slate-600">その事件は見つかりません</p>
    <Link to="/" className="text-sm text-slate-400 underline">
      事件を選び直す
    </Link>
  </div>
)

export const RouteError = ({ error }: { error: Error }) => (
  <div className={frame}>
    <p className="text-xs tracking-[0.3em] text-slate-600">うまく開けませんでした</p>
    {/* 何が起きたかは出す。黙って戻す画面は、同じ操作をもう一度させるだけになる。 */}
    <p className="text-sm text-red-400">{error.message}</p>
    <Link to="/" className="text-sm text-slate-400 underline">
      最初から
    </Link>
  </div>
)
