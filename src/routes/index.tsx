import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ScenarioSelectScreen } from '@/client/screens/ScenarioSelectScreen'
import { listScenariosFn } from '@/server/fn/scenarios'

/** タイトル画面。一覧はサーバで読んで初回HTMLに載せる。 */
export const Route = createFileRoute('/')({
  loader: () => listScenariosFn(),
  component: ScenarioSelect,
})

function ScenarioSelect() {
  const scenarios = Route.useLoaderData()
  const navigate = useNavigate()

  return (
    <ScenarioSelectScreen
      scenarios={scenarios}
      onSelect={(scenarioId) =>
        navigate({ to: '/scenarios/$scenarioId/detective', params: { scenarioId } })
      }
    />
  )
}
