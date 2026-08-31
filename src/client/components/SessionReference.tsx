import { useState } from 'react'
import { CaseNoteDialog } from '@/client/components/CaseNote'
import { Button } from '@/client/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/ui/dialog'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { buildHistory } from '@/client/lib/history'
import type { ScenarioDetail } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  interrogation: UseInterrogation
}

type ReferenceView = 'prologue' | 'history'

/**
 * 聞き込み中に必要な「思い出す」ための入口。
 *
 * 使うのは推理画面。あちらには会話ログが無いので、誰が何を言ったかを
 * ここから開いて確かめる。聞き込み画面では会話がそのまま見えているため、
 * 記録は事件の記録だけを会話ログの隅（CaseNoteButton）に置いてある。
 */
export const SessionReference = ({ scenario, interrogation }: Props) => {
  const [view, setView] = useState<ReferenceView | undefined>(undefined)
  const history = buildHistory(interrogation.conversations, scenario.characters)

  return (
    <>
      <div className="flex gap-3 border-b border-keisen bg-sumi px-3 py-2 text-xs">
        <Button variant="link" size="sm" className="px-0" onClick={() => setView('prologue')}>
          事件の記録
        </Button>
        <Button variant="link" size="sm" className="px-0" onClick={() => setView('history')}>
          聞き込み記録{history.length === 0 ? '' : ` (${history.length})`}
        </Button>
      </div>

      <CaseNoteDialog
        briefing={scenario.briefing}
        open={view === 'prologue'}
        onOpenChange={(open) => setView(open ? 'prologue' : undefined)}
      />

      <Dialog
        open={view === 'history'}
        onOpenChange={(open) => setView(open ? 'history' : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>聞き込み記録</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-nezumi-dim">まだ誰にも質問していません。</p>
          ) : (
            <ol className="flex max-h-[70dvh] flex-col gap-5 overflow-y-auto">
              {history.map((entry) => (
                <li
                  key={`${entry.characterId}:${entry.askedAt}`}
                  className="border-l-2 border-keisen pl-3"
                >
                  <p className="text-xs font-semibold text-nezumi">{entry.characterName}</p>
                  <p className="mt-2 text-sm leading-relaxed text-kinari">
                    <span className="mr-1 text-nezumi-dim">あなた：</span>
                    {entry.question}
                  </p>
                  {entry.answer.length === 0 ? (
                    <p className="mt-2 text-sm text-nezumi-dim">返答を待っています…</p>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-nezumi">
                      <span className="mr-1 text-nezumi-dim">{entry.characterName}：</span>
                      {entry.answer}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
