import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { InterrogationProvider } from '@/client/hooks/InterrogationContext'
import { useInterrogation } from '@/client/hooks/useInterrogation'
import { fetchScenarioDetail, fetchSessionHistory, fetchSessionState } from '@/client/lib/api'
import { restoreConversations } from '@/client/lib/restore'

/**
 * 支度で選んだ「まず誰から」。付いていなければ、最後に話した相手から再開する。
 *
 * uuid で縛らないのは、遺体（`victim`）も選べるため。壊れた値が来ても弾かず、
 * 画面側で存在しない相手として無視する——URLを手で書き換えた人にエラー画面を出す
 * ほどのことではない。
 */
const searchSchema = z.object({ first: z.string().nonempty().optional() })

/**
 * 1プレイぶんのレイアウト（聞き込み・推理・リザルト）。
 *
 * ssr: false にしているのは、ここから先がプレイヤー固有の状態だから。
 * サーバで描いても速くならないうえ、loader がクライアントでだけ走るようになるので
 * 既存の api.ts（相対パスで /api を叩く）と SSE の実装にまったく手を入れずに済む。
 *
 * 聞き込みの状態はここが1つだけ持つ。子の画面を行き来しても作り直されず、
 * セッションが変われば sessionId ごとマウントし直されるので、
 * 前のプレイの会話が次に漏れることもない。
 */
export const Route = createFileRoute('/sessions/$sessionId')({
  ssr: false,
  validateSearch: (search) => {
    const parsed = searchSchema.safeParse(search)

    return parsed.success ? parsed.data : {}
  },
  loader: async ({ params }) => {
    const state = await fetchSessionState(params.sessionId)
    // 記録とシナリオは互いに依存しないので並べて取る。
    const [history, scenario] = await Promise.all([
      fetchSessionHistory(params.sessionId),
      fetchScenarioDetail(state.scenarioId),
    ])

    return { state, scenario, conversations: restoreConversations(history) }
  },
  component: PlaySession,
})

function PlaySession() {
  const { state, conversations } = Route.useLoaderData()
  const interrogation = useInterrogation({
    conversations,
    discoveries: state.discoveries,
    revelations: state.revelations,
    hint: state.hint,
    alibiSegments: state.alibiSegments,
    questionCount: state.questionCount,
    turn: state.turn,
  })

  return (
    <InterrogationProvider value={interrogation}>
      <Outlet />
    </InterrogationProvider>
  )
}
