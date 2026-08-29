import { createRouter } from '@tanstack/react-router'
import { RouteError, RouteNotFound, RoutePending } from '@/client/components/RouteStatus'
import { routeTree } from '@/routeTree.gen'

/**
 * ルータの生成。TanStack Start がサーバ・クライアント双方でこれを呼ぶ。
 *
 * routeTree.gen.ts は src/routes 以下のディレクトリ構造から自動生成される。
 * 手で書き換えないこと（biome も *.gen.ts を除外している）。
 */
export const getRouter = () =>
  createRouter({
    routeTree,
    // 既定のままだと白地に「Not Found」とだけ出て、暗い画面で通してきた作りが
    // そこだけ剥がれる。3つとも自前のものに差し替える。
    defaultPendingComponent: RoutePending,
    defaultNotFoundComponent: RouteNotFound,
    defaultErrorComponent: RouteError,
    // リンクにポインタが乗った時点で次のデータを取りに行く。
    defaultPreload: 'intent',
    scrollRestoration: true,
  })

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
