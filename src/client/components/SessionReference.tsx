import { useState } from 'react'
import { Modal } from '@/client/components/Modal'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { buildHistory } from '@/client/lib/history'
import { splitParagraphs } from '@/client/lib/paragraphs'
import type { ScenarioDetail } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  interrogation: UseInterrogation
}

type ReferenceView = 'prologue' | 'history'

/**
 * 聞き込み中に必要な「思い出す」ための入口。
 *
 * プロローグは聞き込み画面に常駐させない。常に見えていると今起きている会話より
 * 導入の文字が目に入り、画面を切り替えた意味がなくなる。
 *
 * 代わりに小さなボタンでモーダルを開く。ゲームの進行を止めず、読み終えたら
 * 同じ質問入力の場所へそのまま戻れる。
 */
export const SessionReference = ({ scenario, interrogation }: Props) => {
  const [view, setView] = useState<ReferenceView | undefined>(undefined)
  const history = buildHistory(interrogation.conversations, scenario.characters)

  const close = () => setView(undefined)

  return (
    <>
      <div className="flex gap-3 border-b border-slate-800 bg-slate-950 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => setView('prologue')}
          className="text-slate-400 underline"
        >
          事件の記録
        </button>
        <button
          type="button"
          onClick={() => setView('history')}
          className="text-slate-400 underline"
        >
          聞き込み記録{history.length === 0 ? '' : ` (${history.length})`}
        </button>
      </div>

      {view === 'prologue' && (
        <Modal title="事件の記録" onClose={close}>
          <div className="flex flex-col gap-4">
            {splitParagraphs(scenario.briefing).map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-slate-300">
                {paragraph}
              </p>
            ))}
          </div>
        </Modal>
      )}

      {view === 'history' && (
        <Modal title="聞き込み記録" onClose={close}>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">まだ誰にも質問していません。</p>
          ) : (
            <ol className="flex flex-col gap-5">
              {history.map((entry) => (
                <li
                  key={`${entry.characterId}:${entry.askedAt}`}
                  className="border-l-2 border-slate-700 pl-3"
                >
                  <p className="text-xs font-semibold text-indigo-300">{entry.characterName}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-100">
                    <span className="mr-1 text-slate-500">あなた：</span>
                    {entry.question}
                  </p>
                  {entry.answer.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">返答を待っています…</p>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      <span className="mr-1 text-slate-500">{entry.characterName}：</span>
                      {entry.answer}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}
    </>
  )
}
