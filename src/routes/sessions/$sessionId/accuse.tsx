import { createFileRoute, getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { useInterrogationContext } from '@/client/hooks/InterrogationContext'
import { AccusationScreen } from '@/client/screens/AccusationScreen'

const layout = getRouteApi('/sessions/$sessionId')

/** 推理の提出。 */
export const Route = createFileRoute('/sessions/$sessionId/accuse')({
  component: Accusation,
})

function Accusation() {
  const { scenario, state } = layout.useLoaderData()
  const interrogation = useInterrogationContext()
  const navigate = useNavigate()
  const router = useRouter()

  return (
    <AccusationScreen
      scenario={scenario}
      sessionId={state.sessionId}
      interrogation={interrogation}
      // replace で移るのは、リザルトから戻ったときに推理フォームへ着地させないため。
      // セッションはもう終わっていて、二度目の提出は受け付けられない。
      onResult={() => {
        // セッションはここで終わる。レイアウトが抱えている状態は
        // finished: false のままなので、読み直させてから移る。
        router.invalidate()

        navigate({
          to: '/sessions/$sessionId/result',
          params: { sessionId: state.sessionId },
          replace: true,
        })
      }}
      onBack={() =>
        navigate({ to: '/sessions/$sessionId', params: { sessionId: state.sessionId } })
      }
    />
  )
}
