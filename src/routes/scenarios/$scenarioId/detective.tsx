import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { DetectiveSetupScreen } from '@/client/screens/DetectiveSetupScreen'

const layout = getRouteApi('/scenarios/$scenarioId')

/**
 * 探偵の設定。
 *
 * ssr: 'data-only' にしているのは、この画面が localStorage の保管庫を読んで描くため。
 * サーバには保管庫が無いので、描いても必ずクライアントと食い違う。
 * シナリオの読み込み自体はサーバで済ませたいので、データだけ SSR する。
 */
export const Route = createFileRoute('/scenarios/$scenarioId/detective')({
  ssr: 'data-only',
  component: DetectiveSetup,
})

function DetectiveSetup() {
  const scenario = layout.useLoaderData()
  const navigate = useNavigate()

  return (
    <DetectiveSetupScreen
      scenario={scenario}
      onDecided={() =>
        navigate({ to: '/scenarios/$scenarioId/briefing', params: { scenarioId: scenario.id } })
      }
      onBack={() => navigate({ to: '/' })}
    />
  )
}
