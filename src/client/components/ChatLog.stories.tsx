import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { ChatLog } from '@/client/components/ChatLog'
import type { ChatTurn } from '@/client/hooks/useInterrogation'

/*
 * 会話の見え方と、文が置かれていく間。
 *
 * 見たいのは静止した姿ではなく速さのほうなので、返答が一字ずつ届くところまで作る。
 * 実際の SSE と同じで、届くのは字、画面に出るのは文——ChatLog は書きかけの一文を
 * 伏せ、出来上がった順に 0.8 秒の間を置いて通す。
 */

const ASKED_AT = 1_700_000_000_000

const SPEAKER = '牧野千尋'
const ASKER = '灰城アキラ'

/** 相手の顔料。0 は浅葱。 */
const SPEAKER_INDEX = 0

const TOPIC = '事件のあった時間について訊いて'
const QUESTION = '午後六時半から七時過ぎまで、どちらにいらっしゃいましたか。'

/*
 * 返答は句点で四文。モデルが速いと二文がほぼ同時に着地するので、
 * ここでは 1 字 25 ミリ秒——読むより速く届く側に寄せてある。
 * それでも画面に出る間隔は 0.8 秒より詰まらない、というのが見どころ。
 */
const REPLY =
  '午後六時三十五分には店を出ています。郵便局へ行くところでした。窓口の受付は午後七時八分でしたよ。……ええ、雨でしたから、少し手間取りました。'

const CHAR_INTERVAL_MS = 25

const turnsUpTo = (count: number): ChatTurn[] => [
  { id: 't1', role: 'topic', text: TOPIC, askedAt: ASKED_AT },
  { id: 'u1', role: 'user', text: QUESTION, askedAt: ASKED_AT },
  { id: 'a1', role: 'assistant', text: REPLY.slice(0, count), askedAt: ASKED_AT },
]

const Streaming = () => {
  const [count, setCount] = useState(0)
  // 積み直しの合図。ChatLog は間の消化ぶんを内側に持つので、作り直さないと戻らない。
  const [take, setTake] = useState(0)

  useEffect(() => {
    if (count >= REPLY.length) {
      return
    }

    const timer = setTimeout(() => setCount(count + 1), CHAR_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [count])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] tracking-[0.16em] text-nezumi-dim">
          {count} / {REPLY.length} 字が到着
        </span>
        <button
          type="button"
          onClick={() => {
            setCount(0)
            setTake(take + 1)
          }}
          className="flex-none border border-keisen px-[9px] py-[3px] text-[10px] tracking-[0.16em] text-nezumi-dim hover:border-nezumi-dim hover:text-kinari"
        >
          もう一度
        </button>
      </div>

      <div key={take} className="flex flex-col gap-[15px]">
        <ChatLog
          turns={turnsUpTo(count)}
          speakerName={SPEAKER}
          speakerIndex={SPEAKER_INDEX}
          askerName={ASKER}
          awaiting={count < REPLY.length}
        />
      </div>
    </div>
  )
}

const Settled = () => (
  <div className="flex flex-col gap-[15px]">
    <ChatLog
      turns={turnsUpTo(REPLY.length)}
      speakerName={SPEAKER}
      speakerIndex={SPEAKER_INDEX}
      askerName={ASKER}
      awaiting={false}
    />
  </div>
)

const meta: Meta<typeof ChatLog> = {
  title: 'Parts/会話',
  component: ChatLog,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[560px] bg-sumi px-6 py-10">
        <Story />
      </div>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof meta>

/** 返答が流れてくる。書きかけの一文は出ず、出来た一文が 0.8 秒ごとに置かれる。 */
export const 流れてくる: Story = { render: () => <Streaming /> }

/** 読み直したとき。書き終わった会話は間を置かず、そのまま全部出る。 */
export const 読み直し: Story = { render: () => <Settled /> }
