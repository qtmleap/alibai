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
 * 会話ログの隅に浮かべる、事件の記録の入口。
 *
 * 画面の上に見出し付きのバーを置くほど頻繁には開かない。かといって
 * 完全に隠すと、細部を確かめたくなったときに戻る道が無い。
 * 会話の邪魔をしない大きさで、いつも同じ場所に置いておく。
 */
export const CaseNoteButton = ({ briefing }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/*
        mt-auto で会話が短いときも下端へ落とし、sticky で会話が伸びたあとも
        下端に留める。会話の量で置き場所が動くと、探すたびに目で追うことになる。
      */}
      <div className="sticky bottom-0 mt-auto flex justify-end pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="事件の記録を読む"
          className="size-9 rounded-full border border-slate-700 bg-slate-900/90 text-xs text-slate-400 backdrop-blur"
        >
          記
        </button>
      </div>

      {open && <CaseNoteModal briefing={briefing} onClose={() => setOpen(false)} />}
    </>
  )
}
