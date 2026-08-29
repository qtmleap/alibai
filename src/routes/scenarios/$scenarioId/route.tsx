import { createFileRoute, Outlet } from '@tanstack/react-router'
import { scenarioDetailFn } from '@/server/fn/scenarios'

/**
 * シナリオ配下の共通レイアウト。
 *
 * 探偵の設定・事件の記録・支度の3画面はどれも同じシナリオを見るので、
 * 読み込みはここに1つだけ置く。画面を行き来しても取り直さない。
 */
export const Route = createFileRoute('/scenarios/$scenarioId')({
  loader: ({ params }) => scenarioDetailFn({ data: params.scenarioId }),
  component: Outlet,
})
