import { createFileRoute } from '@tanstack/react-router'
import { FloorPlanEditorScreen } from '@/client/screens/FloorPlanEditorScreen'

/**
 * 見取り図を作るための道具。制作用なので、ゲーム側からの導線は張らない。
 *
 * ssr を切ってあるのは、画面の中身がポインタ操作とブラウザの状態だけでできていて、
 * サーバで先に描いても一度も使われないため。
 */
export const Route = createFileRoute('/dev/floor-plan')({
  ssr: false,
  component: FloorPlanEditorScreen,
})
