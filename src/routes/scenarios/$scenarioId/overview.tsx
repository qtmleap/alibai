import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { CaseOverviewScreen } from '@/client/screens/CaseOverviewScreen'

const layout = getRouteApi('/scenarios/$scenarioId')

/**
 * 聞き込みから戻ってきたときに付く、進行中のセッション。
 *
 * これが付いているあいだ、この画面は「始める場所」ではなく「戻ってきた場所」になる。
 * 付いていなければ今までどおり、これから始める支度の画面。
 */
const searchSchema = z.object({ session: z.uuid().optional() })

/**
 * 聞き込みに入る前の支度。ここで選んだ探偵（localStorage）を読むので data-only。
 */
export const Route = createFileRoute('/scenarios/$scenarioId/overview')({
  ssr: 'data-only',
  validateSearch: (search) => {
    const parsed = searchSchema.safeParse(search)

    // 壊れたクエリは「セッション無し」として扱う。URLを手で書き換えた人に
    // エラー画面を見せるより、支度の画面として素直に開くほうがよい。
    return parsed.success ? parsed.data : {}
  },
  component: CaseOverview,
})

function CaseOverview() {
  const scenario = layout.useLoaderData()
  const { session } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <CaseOverviewScreen
      scenario={scenario}
      activeSessionId={session}
      // replace で入るのは、戻るボタンで「聞き込みを始める」に着地させないため。
      // あれをもう一度押すと、別のセッションが立って計時がやり直しになる。
      onStart={(started) =>
        navigate({
          to: '/sessions/$sessionId',
          params: { sessionId: started.sessionId },
          replace: true,
        })
      }
      onResume={() => {
        if (session !== undefined) {
          navigate({ to: '/sessions/$sessionId', params: { sessionId: session } })
        }
      }}
      onGiveUp={() => navigate({ to: '/' })}
      onBack={() =>
        navigate({ to: '/scenarios/$scenarioId/briefing', params: { scenarioId: scenario.id } })
      }
    />
  )
}
