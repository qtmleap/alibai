import { useState } from 'react'
import { askTopic, describeError } from '@/client/lib/api'
import { mergeById } from '@/client/lib/merge-by-id'
import type {
  AlibiSegmentData,
  Clash,
  Discovery,
  Hint,
  RevelationCard,
  TurnState,
} from '@/client/lib/schemas'
import { advanceTurn } from '@/shared/turns'

export type ChatTurn = {
  /**
   * この会話ログの中で一意。同じ話題から生まれた行は askedAt を共有するので、
   * 時刻と役割の組では重なる。会話は末尾に積むだけで並べ替えないので、
   * 積んだ時点の位置から作れば以後変わらない。
   */
  id: string
  /**
   * topic はプレイヤーが探偵へ渡した指示、user は探偵がNPCへ投げた質問、
   * assistant はNPCの返答。1つの topic から user/assistant の往復が複数生まれる。
   */
  role: 'topic' | 'user' | 'assistant'
  text: string
  /**
   * その話題を投げた時刻（epoch ミリ秒）。
   * 会話はNPCごとに分かれて保持されるので、これが無いと
   * 「誰に何を聞いたか」を1本の時系列に並べ直せない。
   * 同じ話題から生まれた行はすべて同じ値を持たせ、塊のまま並ぶようにする。
   */
  askedAt: number
  /**
   * その話題が証拠や気づきを引き出したか。role が 'topic' の行にだけ意味がある。
   *
   * 投げた時点では分からず、判定が返ってきて初めて決まるので、後から立てる。
   */
  notable?: boolean
}

/**
 * 開いた時点でサーバに残っていたぶん。リロードや直リンクで入ったときの続き。
 * suggestedQuestions は次の質問で作り直されるので復元しない。
 */
export type InterrogationSeed = {
  conversations: Record<string, ChatTurn[]>
  discoveries: Discovery[]
  revelations: RevelationCard[]
  /** 未発見のものの残り件数。難易度が許した粒度までしか入っていない。 */
  hint: Hint
  /** 時刻表に引ける線。掴んだ手掛かりから引ける分だけがサーバから届く。 */
  alibiSegments: AlibiSegmentData[]
  /** 供述が噛み合わない区間。揃うまでは無い。 */
  clash: Clash | undefined
  /** 開示済みの死亡推定時刻。掴むまでは null で、盤面は「不明」を描く。 */
  estimatedDeathAt: string | null
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
  const [revelations, setRevelations] = useState<RevelationCard[]>(seed.revelations)
  /**
   * 残り件数はサーバが数える（発見済みの正典はDO側にあるので、こちらでは足し引きしない）。
   * 定期取得したセッション状態で丸ごと差し替える。
   */
  const [hint, setHint] = useState<Hint>(seed.hint)
  /**
   * 時刻表の線。判定のたびに「その時点で引ける全件」が届くので、足さずに置き換える。
   * こちらで積むと、サーバが引き直した結果（線の終わりが縮むなど）を取りこぼす。
   */
  const [alibiSegments, setAlibiSegments] = useState<AlibiSegmentData[]>(seed.alibiSegments)
  const [clash, setClash] = useState<Clash | undefined>(seed.clash)
  /**
   * 刻限。開示済みかどうかを決めるのはサーバで、こちらは届いた値を置くだけ。
   * 線と同じく毎回そのときの姿が届くので、足さずに置き換える。
   */
  const [estimatedDeathAt, setEstimatedDeathAt] = useState<string | null>(seed.estimatedDeathAt)
  const [questionCount, setQuestionCount] = useState(seed.questionCount)
  /**
   * ターンの進行。正典はサーバ側（DOの質問回数から導かれる）で、
   * ここが持つのは表示用の写し。判定に使うと、リクエストを直接投げる相手には効かない。
   */
  const [turn, setTurn] = useState<TurnState | undefined>(seed.turn)
  const [askingCharacterId, setAskingCharacterId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  const appendTurns = (characterId: string, added: Omit<ChatTurn, 'id'>[]) => {
    setConversations((prev) => {
      const current = prev[characterId]
      const turns = current === undefined ? [] : current

      return {
        ...prev,
        [characterId]: [
          ...turns,
          ...added.map((turn, index) => ({
            ...turn,
            id: `${turn.askedAt}:${turns.length + index}`,
          })),
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

      const nextTurns = [...turns.slice(0, lastIndex), { ...last, text: last.text + delta }]

      return { ...prev, [characterId]: nextTurns }
    })
  }

  /**
   * 探偵の質問の断片を継ぎ足す。
   *
   * 宛先は末尾ではなく1つ手前。質問が始まった時点で「質問」と「返答」を対で積むので、
   * 質問が書かれているあいだ、末尾には返答待ちの空の行が居る。
   */
  const appendQuestionDelta = (characterId: string, delta: string) => {
    setConversations((prev) => {
      const current = prev[characterId]
      const turns = current === undefined ? [] : current
      const index = turns.length - 2
      const target = turns[index]

      if (target === undefined || target.role !== 'user') {
        return prev
      }

      return {
        ...prev,
        [characterId]: [
          ...turns.slice(0, index),
          { ...target, text: target.text + delta },
          ...turns.slice(index + 1),
        ],
      }
    })
  }

  /**
   * その話題が何かを引き出したことを、会話ログの上でも印にする。
   *
   * 話題の行は askedAt で一意に指せる。同じ話題から生まれた行は同じ値を持つが、
   * そのうち role が 'topic' のものは1つだけなので。
   */
  const markTopicNotable = (characterId: string, askedAt: number) => {
    setConversations((prev) => {
      const current = prev[characterId]

      if (current === undefined) {
        return prev
      }

      return {
        ...prev,
        [characterId]: current.map((turn) =>
          turn.role === 'topic' && turn.askedAt === askedAt ? { ...turn, notable: true } : turn,
        ),
      }
    })
  }

  const ask = (params: { sessionId: string; characterId: string; topic: string }) => {
    const topic = params.topic.trim()

    if (topic.length === 0) {
      return
    }

    setError(undefined)

    // 同じ話題から生まれる行はすべてこの時刻を共有する。往復ごとに取り直すと、
    // 記録を時系列に並べ直したときに話題の塊が崩れる。
    const askedAt = Date.now()

    appendTurns(params.characterId, [{ role: 'topic', text: topic, askedAt }])
    setAskingCharacterId(params.characterId)

    // ターンは投げた瞬間に進める。サーバが質問回数を増やすのは返答を届け終えたあとで、
    // それを待つと数秒おいて急に切り替わる。確定値が届いたらそれで上書きされる。
    setQuestionCount((prev) => prev + 1)
    setTurn((prev) => (prev === undefined ? prev : advanceTurn(prev)))

    askTopic(
      { sessionId: params.sessionId, characterId: params.characterId, topic },
      {
        // 探偵が質問を書き始めたら、そこから次の往復が始まる。返答用の空の行も
        // 一緒に積む。中身が届くまでのあいだ、それが待ちの目印になる。
        onQuestionStart: () =>
          appendTurns(params.characterId, [
            { role: 'user', text: '', askedAt },
            { role: 'assistant', text: '', askedAt },
          ]),
        onQuestion: (chunk) => appendQuestionDelta(params.characterId, chunk),
        onDelta: (chunk) => appendAssistantDelta(params.characterId, chunk),
        onJudgement: (judgement) => {
          if (judgement.revealedEvidences.length > 0 || judgement.revealedRevelations.length > 0) {
            markTopicNotable(params.characterId, askedAt)
          }

          setDiscoveries((prev) => mergeById(prev, judgement.revealedEvidences))
          setRevelations((prev) => mergeById(prev, judgement.revealedRevelations))
          setSuggestedQuestions((prev) => ({
            ...prev,
            [params.characterId]: judgement.suggestedQuestions,
          }))
          setAlibiSegments(judgement.alibiSegments)
          setClash(judgement.clash)
          setEstimatedDeathAt(judgement.estimatedDeathAt)
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
    revelations,
    hint,
    setHint,
    alibiSegments,
    setAlibiSegments,
    clash,
    estimatedDeathAt,
    questionCount,
    askingCharacterId,
    error,
    ask,
  }
}

export type UseInterrogation = ReturnType<typeof useInterrogation>
