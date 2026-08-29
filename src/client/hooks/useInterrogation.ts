import { useState } from 'react'
import { askQuestion, describeError } from '@/client/lib/api'
import type { Discovery } from '@/client/lib/schemas'

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
 * 聞き込み中の状態を App に持たせるためのフック。
 *
 * InterrogationScreen 自身に状態を持たせると、推理画面へ行って「戻る」で
 * コンポーネントが作り直され会話ログが消えてしまう。App がアンマウントされない限り
 * この状態は生き続けるので、画面を行き来しても聞き込みの続きから再開できる。
 */
export const useInterrogation = () => {
  const [conversations, setConversations] = useState<Record<string, ChatTurn[]>>({})
  const [suggestedQuestions, setSuggestedQuestions] = useState<Record<string, string[]>>({})
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [questionCount, setQuestionCount] = useState(0)
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
        },
        onDone: () => setAskingCharacterId(undefined),
      },
    ).catch((err: unknown) => {
      setError(describeError(err))
      setAskingCharacterId(undefined)
    })
  }

  return {
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
