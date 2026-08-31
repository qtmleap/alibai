import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageSearch, parsePageSearch } from '@/client/lib/pagination'
import { ScenarioSelectScreen } from '@/client/screens/ScenarioSelectScreen'
import { listScenariosFn } from '@/server/fn/scenarios'

/** タイトル画面。一覧はサーバで読んで初回HTMLに載せる。 */
export const Route = createFileRoute('/')({
  loader: () => listScenariosFn(),
  validateSearch: parsePageSearch,
  component: ScenarioSelect,
})

function ScenarioSelect() {
  const scenarios = Route.useLoaderData()
  const { page } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <ScenarioSelectScreen
      scenarios={scenarios}
      page={page === undefined ? 1 : page}
      onPageChange={(next) => navigate({ to: '/', search: pageSearch(next) })}
      onSelect={(scenarioId) =>
        navigate({ to: '/scenarios/$scenarioId/detective', params: { scenarioId } })
      }
      // 見ていたページを設定画面へ預ける。戻ってきたときに探していた場所へ帰るため。
      onSettings={() => navigate({ to: '/settings', search: pageSearch(page) })}
    />
  )
}
