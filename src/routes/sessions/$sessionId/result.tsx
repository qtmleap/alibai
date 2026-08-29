import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { fetchSessionResult } from '@/client/lib/api'
import { ResultScreen } from '@/client/screens/ResultScreen'

/**
 * リザルト。
 *
 * 提出の応答をそのまま持ち回すのではなく、ここで読み直している。
 * POST の戻り値を画面の状態に抱えたままだと、リロードした瞬間に
 * 「解けたはずの事件」が二度と表示できなくなる。
 */
export const Route = createFileRoute('/sessions/$sessionId/result')({
  loader: ({ params }) => fetchSessionResult(params.sessionId),
  component: Result,
})

function Result() {
  const accuseResult = Route.useLoaderData()
  const navigate = useNavigate()

  return <ResultScreen accuseResult={accuseResult} onRestart={() => navigate({ to: '/' })} />
}
