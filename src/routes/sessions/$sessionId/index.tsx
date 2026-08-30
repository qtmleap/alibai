import { createFileRoute, getRouteApi, Navigate, useNavigate } from '@tanstack/react-router'
import { useInterrogationContext } from '@/client/hooks/InterrogationContext'
import { InterrogationScreen } from '@/client/screens/InterrogationScreen'

const layout = getRouteApi('/sessions/$sessionId')

/** 聞き込み。1プレイの本体。 */
export const Route = createFileRoute('/sessions/$sessionId/')({
  component: Interrogation,
})

function Interrogation() {
  const { scenario, state } = layout.useLoaderData()
  const interrogation = useInterrogationContext()
  const navigate = useNavigate()

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
      interrogation={interrogation}
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
