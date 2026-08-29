import { useState } from 'react'
import { Modal } from '@/client/components/Modal'
import { splitParagraphs } from '@/client/lib/paragraphs'

type Props = {
  briefing: string
}

/** 事件の記録の中身。開く入口が複数あるので、本文の組み立てはここ1つに置く。 */
export const CaseNoteModal = ({ briefing, onClose }: Props & { onClose: () => void }) => (
  <Modal title="事件の記録" onClose={onClose}>
    <div className="flex flex-col gap-4">
      {splitParagraphs(briefing).map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed text-slate-300">
          {paragraph}
        </p>
      ))}
    </div>
  </Modal>
)

/**
 * 事件の記録の入口。
 *
 * 画面の上に見出し付きのバーを置くほど頻繁には開かないが、完全に隠すと
 * 細部を確かめたくなったときに戻る道が無い。相手のアイコンが並ぶ列の
 * 一番下に、同じ大きさで置いておく。置き場所は呼び出し側が決める。
 */
export const CaseNoteButton = ({ briefing }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="事件の記録を読む"
        className="size-9 shrink-0 rounded-full border border-slate-700 text-xs text-slate-400"
      >
        記
      </button>

      {open && <CaseNoteModal briefing={briefing} onClose={() => setOpen(false)} />}
    </>
  )
}
