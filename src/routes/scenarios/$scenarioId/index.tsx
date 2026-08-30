import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * /scenarios/:id そのものには画面が無い。シナリオを選んだ次にすることは
 * 「誰として調べるか」を決めることなので、そこへ送る。
 */
export const Route = createFileRoute('/scenarios/$scenarioId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/scenarios/$scenarioId/detective',
      params,
      replace: true,
    })
  },
})
