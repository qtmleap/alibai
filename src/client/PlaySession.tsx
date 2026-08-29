import { useState } from 'react'
import { useInterrogation } from '@/client/hooks/useInterrogation'
import type { AccuseResult, CreateSessionResponse, ScenarioDetail } from '@/client/lib/schemas'
import { AccusationScreen } from '@/client/screens/AccusationScreen'
import { InterrogationScreen } from '@/client/screens/InterrogationScreen'
import { ResultScreen } from '@/client/screens/ResultScreen'

type Props = {
  scenario: ScenarioDetail
  session: CreateSessionResponse
  onRestart: () => void
}

type Screen =
  | { name: 'interrogation' }
  | { name: 'accuse' }
  | { name: 'result'; accuseResult: AccuseResult }

/**
 * 1プレイぶんの画面遷移（聞き込み → 推理提出 → リザルト）をまとめる。
 *
 * useInterrogation をここで持つのは意図的。App 直下で持つと「もう一度あそぶ」で
 * 選択画面に戻ってもフックの状態（会話ログ・発見済み証拠）が生き残ってしまい、
 * 次のプレイに前回の会話が漏れ出す。App が別セッションのたびにこのコンポーネントを
 * 作り直す（＝アンマウントする）ことで、プレイごとに状態をまっさらにする。
 */
export const PlaySession = ({ scenario, session, onRestart }: Props) => {
  const [screen, setScreen] = useState<Screen>({ name: 'interrogation' })
  const interrogation = useInterrogation()

  if (screen.name === 'interrogation') {
    return (
      <InterrogationScreen
        scenario={scenario}
        session={session}
        interrogation={interrogation}
        onAccuse={() => setScreen({ name: 'accuse' })}
      />
    )
  }

  if (screen.name === 'accuse') {
    return (
      <AccusationScreen
        scenario={scenario}
        session={session}
        interrogation={interrogation}
        onResult={(accuseResult) => setScreen({ name: 'result', accuseResult })}
        onBack={() => setScreen({ name: 'interrogation' })}
      />
    )
  }

  return <ResultScreen accuseResult={screen.accuseResult} onRestart={onRestart} />
}
