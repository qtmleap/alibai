import { createFileRoute, getRouteApi, Navigate, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useInterrogationContext } from '@/client/hooks/InterrogationContext'
import { InterrogationScreen } from '@/client/screens/InterrogationScreen'

const layout = getRouteApi('/sessions/$sessionId')

/** 聞き込み。1プレイの本体。 */
export const Route = createFileRoute('/sessions/$sessionId/')({
  component: Interrogation,
})

function Interrogation() {
  const { scenario, state } = layout.useLoaderData()
  const { first } = layout.useSearch()
  const interrogation = useInterrogationContext()
  const navigate = useNavigate()

  /*
   * 支度で選んだ相手は一度だけ使う。
   *
   * URLに残したままにすると、推理の画面へ行って戻るたびにこの相手へ引き戻され、
   * 聞き込みの途中で替えた相手が巻き戻る。最初の描画で受け取ってから、
   * クエリだけを静かに落とす（履歴に残さないので、戻るボタンの挙動も変わらない）。
   */
  const [initialTarget] = useState(first)

  useEffect(() => {
    if (first !== undefined) {
      navigate({ to: '.', search: {}, replace: true })
    }
  }, [first, navigate])

  // 終わった事件は聞き込みに戻れない（推理を出した後に戻るを押した場合など）。
  // 開いたままにすると、答え合わせが済んだ相手に質問を投げられてしまう。
  if (state.finished) {
    return (
      <Navigate to="/sessions/$sessionId/result" params={{ sessionId: state.sessionId }} replace />
    )
  }

  return (
    <InterrogationScreen
      scenario={scenario}
      sessionId={state.sessionId}
      detectiveName={state.detectiveName}
      interrogation={interrogation}
      // 支度で選んだ相手。会話が始まっていればそちらが優先される。
      firstTarget={initialTarget}
      // 刻限と食い違いはまだサーバから出ていないので、線だけを渡す。
      alibi={{ segments: interrogation.alibiSegments }}
      onAccuse={() =>
        navigate({ to: '/sessions/$sessionId/accuse', params: { sessionId: state.sessionId } })
      }
      // 戻り先は事件の概要。あちらから「聞き込みに戻る」で帰ってこられるよう、
      // セッションIDを持たせる（持たせないと新しいセッションが立ってしまう）。
      onLeave={() =>
        navigate({
          to: '/scenarios/$scenarioId/overview',
          params: { scenarioId: state.scenarioId },
          search: { session: state.sessionId },
        })
      }
    />
  )
}
