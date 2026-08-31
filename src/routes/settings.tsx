import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageSearch, parsePageSearch } from '@/client/lib/pagination'
import { SettingsScreen } from '@/client/screens/SettingsScreen'

/**
 * この端末で使うモデルと進行の数値を選ぶ画面。
 *
 * ssr を切ってあるのは、初期値が localStorage にしか無いため。サーバで先に描くと
 * 既定値の画面が一度出てから設定値に差し替わる（設定画面としては一番読みにくい形）。
 *
 * page を受け取るのは自分で使うためではなく、一覧のどこから来たかを預かって返すため。
 */
export const Route = createFileRoute('/settings')({
  ssr: false,
  validateSearch: parsePageSearch,
  component: Settings,
})

function Settings() {
  const { page } = Route.useSearch()
  const navigate = useNavigate()

  return <SettingsScreen onBack={() => navigate({ to: '/', search: pageSearch(page) })} />
}
