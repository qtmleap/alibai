import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { BriefingScreen } from '@/client/screens/BriefingScreen'

const layout = getRouteApi('/scenarios/$scenarioId')

/**
 * 事件の記録（プロローグ）。
 *
 * 見せ方の設定は localStorage に残るが、初期値が決まっているぶん
 * 食い違いは演出の切り替えだけに留まるので、本文はサーバで描いてよい。
 */
export const Route = createFileRoute('/scenarios/$scenarioId/briefing')({
  component: Briefing,
})

function Briefing() {
  const scenario = layout.useLoaderData()
  const navigate = useNavigate()

  return (
    <BriefingScreen
      scenario={scenario}
      onRead={() =>
        navigate({ to: '/scenarios/$scenarioId/overview', params: { scenarioId: scenario.id } })
      }
    />
  )
}
