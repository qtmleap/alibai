import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { ScenarioSelectScreen } from '@/client/screens/ScenarioSelectScreen'
import { listScenariosFn } from '@/server/fn/scenarios'

/**
 * 一覧のどこを見ているか。
 *
 * 画面の状態ではなくURLに置くのは、事件を選んで戻ってきたときに
 * 探していた場所へ帰れるようにするため。1ページ目のときは付けない。
 */
const searchSchema = z.object({ page: z.coerce.number().int().min(1).optional() })

/** タイトル画面。一覧はサーバで読んで初回HTMLに載せる。 */
export const Route = createFileRoute('/')({
  loader: () => listScenariosFn(),
  validateSearch: (search) => {
    const parsed = searchSchema.safeParse(search)

    // 壊れたページ番号は1ページ目として開く。範囲外の数字も同じで、
    // 丸め込みは paginate に任せる（URLを手で書き換えた人に見せる画面を増やさない）。
    return parsed.success ? parsed.data : {}
  },
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
      // 1ページ目は ?page=1 を残さない。既定の状態を指すクエリが付いたURLが
      // 共有されると、あとで既定を変えたときにそのURLだけ古い並びで開く。
      onPageChange={(next) => navigate({ to: '/', search: next === 1 ? {} : { page: next } })}
      onSelect={(scenarioId) =>
        navigate({ to: '/scenarios/$scenarioId/detective', params: { scenarioId } })
      }
    />
  )
}
