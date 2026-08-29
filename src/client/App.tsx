import { useState } from 'react'
import type { CreateSessionResponse, Detective, ScenarioDetail } from '@/client/lib/schemas'
import { PlaySession } from '@/client/PlaySession'
import { BriefingScreen } from '@/client/screens/BriefingScreen'
import { DetectiveSetupScreen } from '@/client/screens/DetectiveSetupScreen'
import { ScenarioSelectScreen } from '@/client/screens/ScenarioSelectScreen'

/**
 * トップレベルの画面遷移。ルーティングライブラリは要らない規模なので、
 * ユニオン型のステートで今どの段階かだけを出し分ける。
 *
 * シナリオ選択 → 探偵の設定 → 事件の記録 → プレイ、の順。
 * 探偵を先に決めるのは、ゲームマスターの語りを「自分が呼ばれた」ものとして
 * 聞けるようにするため。事件を知る前に名乗るほうが、順序として自然に読める。
 */
type Stage =
  | { name: 'select' }
  | { name: 'detective'; scenario: ScenarioDetail }
  | { name: 'briefing'; scenario: ScenarioDetail; detective: Detective | undefined }
  | {
      name: 'playing'
      scenario: ScenarioDetail
      session: CreateSessionResponse
    }

export const App = () => {
  const [stage, setStage] = useState<Stage>({ name: 'select' })

  if (stage.name === 'select') {
    return (
      <ScenarioSelectScreen onSelect={(scenario) => setStage({ name: 'detective', scenario })} />
    )
  }

  if (stage.name === 'detective') {
    return (
      <DetectiveSetupScreen
        scenario={stage.scenario}
        onDecided={(detective) =>
          setStage({ name: 'briefing', scenario: stage.scenario, detective })
        }
        onBack={() => setStage({ name: 'select' })}
      />
    )
  }

  if (stage.name === 'briefing') {
    return (
      <BriefingScreen
        scenario={stage.scenario}
        detective={stage.detective}
        onStart={(session) => setStage({ name: 'playing', scenario: stage.scenario, session })}
      />
    )
  }

  return (
    // key を session.sessionId にすることで、万一同じ画面のまま次のセッションが
    // 始まっても PlaySession が確実に作り直され、前のプレイの会話ログが残らない。
    <PlaySession
      key={stage.session.sessionId}
      scenario={stage.scenario}
      session={stage.session}
      onRestart={() => setStage({ name: 'select' })}
    />
  )
}
