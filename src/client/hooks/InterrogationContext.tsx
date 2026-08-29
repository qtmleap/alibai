import { createContext, type ReactNode, useContext } from 'react'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'

/**
 * 聞き込みの状態を、セッション配下の画面すべてに配る。
 *
 * props で手渡しできないのは、子の画面を描くのがルータの <Outlet /> だから。
 * 状態そのものはレイアウトルートが1つだけ持ち、ここはその参照を配るだけ。
 */
const InterrogationContext = createContext<UseInterrogation | undefined>(undefined)

export const InterrogationProvider = ({
  value,
  children,
}: {
  value: UseInterrogation
  children: ReactNode
}) => <InterrogationContext.Provider value={value}>{children}</InterrogationContext.Provider>

export const useInterrogationContext = (): UseInterrogation => {
  const value = useContext(InterrogationContext)

  // セッションのレイアウトの外でこれを呼ぶのは配線の誤り。
  // 空の状態を代わりに返すと、会話ログが消えた画面が黙って描かれてしまう。
  if (value === undefined) {
    throw new Error('聞き込みの状態はセッションのレイアウトの中でしか読めないよ〜。')
  }

  return value
}
