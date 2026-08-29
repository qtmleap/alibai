import { useState } from 'react'
import { askQuestion, describeError } from '@/client/lib/api'
import type { Discovery, TurnState } from '@/client/lib/schemas'
import { advanceTurn } from '@/shared/turns'

export type ChatTurn = {
  role: 'user' | 'assistant'
  text: string
  /**
   * その質問を投げた時刻（epoch ミリ秒）。
   * 会話はNPCごとに分かれて保持されるので、これが無いと
   * 「誰に何を聞いたか」を1本の時系列に並べ直せない。
   * 往復のペアで同じ値を持たせ、質問と答えが離れないようにする。
   */
  askedAt: number
}

const mergeDiscoveries = (current: Discovery[], additions: Discovery[]): Discovery[] => {
  const existingIds = new Set(current.map((discovery) => discovery.id))
  const newOnes = additions.filter((discovery) => !existingIds.has(discovery.id))

  return [...current, ...newOnes]
}

/**
 * 開いた時点でサーバに残っていたぶん。リロードや直リンクで入ったときの続き。
 * suggestedQuestions は次の質問で作り直されるので復元しない。
 */
export type InterrogationSeed = {
  conversations: Record<string, ChatTurn[]>
  discoveries: Discovery[]
  questionCount: number
  turn: TurnState | undefined
}

/**
 * 聞き込み中の状態を持つフック。
 *
 * 呼ぶのはセッションのレイアウトルート。聞き込みの画面自身に持たせると、
 * 推理画面へ行って戻ったときにコンポーネントが作り直され会話ログが消える。
 * レイアウトはセッションが変わるまでアンマウントされないので、
 * 画面を行き来しても聞き込みの続きから再開できる。
 */
export const useInterrogation = (seed: InterrogationSeed) => {
  const [conversations, setConversations] = useState<Record<string, ChatTurn[]>>(seed.conversations)
  const [suggestedQuestions, setSuggestedQuestions] = useState<Record<string, string[]>>({})
  const [discoveries, setDiscoveries] = useState<Discovery[]>(seed.discoveries)
  const [questionCount, setQuestionCount] = useState(seed.questionCount)
  /**
   * ターンの進行。正典はサーバ側（DOの質問回数から導かれる）で、
   * ここが持つのは表示用の写し。判定に使うと、リクエストを直接投げる相手には効かない。
   */
  const [turn, setTurn] = useState<TurnState | undefined>(seed.turn)
  const [askingCharacterId, setAskingCharacterId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  const appendUserTurn = (characterId: string, text: string, askedAt: number) => {
    setConversations((prev) => {
      const current = prev[characterId]
      const turns = current === undefined ? [] : current

      return {
        ...prev,
        [characterId]: [
          ...turns,
          { role: 'user', text, askedAt },
          { role: 'assistant', text: '', askedAt },
        ],
      }
    })
  }

  const appendAssistantDelta = (characterId: string, delta: string) => {
    setConversations((prev) => {
      const current = prev[characterId]
      const turns = current === undefined ? [] : current
      const lastIndex = turns.length - 1
      const last = turns[lastIndex]

      if (last === undefined) {
        return prev
      }

      const nextTurns = [
        ...turns.slice(0, lastIndex),
        { role: last.role, text: last.text + delta, askedAt: last.askedAt },
      ]

      return { ...prev, [characterId]: nextTurns }
    })
  }

  const ask = (params: { sessionId: string; characterId: string; utterance: string }) => {
    const utterance = params.utterance.trim()

    if (utterance.length === 0) {
      return
    }

    setError(undefined)
    appendUserTurn(params.characterId, utterance, Date.now())
    setAskingCharacterId(params.characterId)

    // ターンは投げた瞬間に進める。サーバが質問回数を増やすのは返答を届け終えたあとで、
    // それを待つと数秒おいて急に切り替わる。確定値が届いたらそれで上書きされる。
    setQuestionCount((prev) => prev + 1)
    setTurn((prev) => (prev === undefined ? prev : advanceTurn(prev)))

    askQuestion(
      { sessionId: params.sessionId, characterId: params.characterId, utterance },
      {
        onDelta: (chunk) => appendAssistantDelta(params.characterId, chunk),
        onJudgement: (judgement) => {
          setDiscoveries((prev) => mergeDiscoveries(prev, judgement.revealedEvidences))
          setSuggestedQuestions((prev) => ({
            ...prev,
            [params.characterId]: judgement.suggestedQuestions,
          }))
          setQuestionCount(judgement.questionCount)
          setTurn(judgement.turn)
        },
        onDone: () => setAskingCharacterId(undefined),
      },
    ).catch((err: unknown) => {
      setError(describeError(err))
      setAskingCharacterId(undefined)
    })
  }

  return {
    turn,
    setTurn,
    conversations,
    suggestedQuestions,
    discoveries,
    questionCount,
    askingCharacterId,
    error,
    ask,
  }
}

export type UseInterrogation = ReturnType<typeof useInterrogation>
