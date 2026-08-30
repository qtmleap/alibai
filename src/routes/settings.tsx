import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SettingsScreen } from '@/client/screens/SettingsScreen'

/**
 * この端末で使うモデルと進行の数値を選ぶ画面。
 *
 * ssr を切ってあるのは、初期値が localStorage にしか無いため。サーバで先に描くと
 * 既定値の画面が一度出てから設定値に差し替わる（設定画面としては一番読みにくい形）。
 */
export const Route = createFileRoute('/settings')({
  ssr: false,
  component: Settings,
})

function Settings() {
  const navigate = useNavigate()

  return <SettingsScreen onBack={() => navigate({ to: '/' })} />
}
