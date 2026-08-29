import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { CaseOverviewScreen } from '@/client/screens/CaseOverviewScreen'

const layout = getRouteApi('/scenarios/$scenarioId')

/**
 * 聞き込みに入る前の支度。ここで選んだ探偵（localStorage）を読むので data-only。
 */
export const Route = createFileRoute('/scenarios/$scenarioId/overview')({
  ssr: 'data-only',
  component: CaseOverview,
})

function CaseOverview() {
  const scenario = layout.useLoaderData()
  const navigate = useNavigate()

  return (
    <CaseOverviewScreen
      scenario={scenario}
      // replace で入るのは、戻るボタンで「聞き込みを始める」に着地させないため。
      // あれをもう一度押すと、別のセッションが立って計時がやり直しになる。
      onStart={(session) =>
        navigate({
          to: '/sessions/$sessionId',
          params: { sessionId: session.sessionId },
          replace: true,
        })
      }
      onBack={() =>
        navigate({ to: '/scenarios/$scenarioId/briefing', params: { scenarioId: scenario.id } })
      }
    />
  )
}
