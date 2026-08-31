import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/client/components/ui/dialog'
import { splitParagraphs } from '@/client/lib/paragraphs'

type Props = {
  briefing: string
}

/** 本文の組み立ては1箇所に置く。開く入口が複数あるので、ここがずれると読み口が変わる。 */
const CaseNoteBody = ({ briefing }: Props) => (
  <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
    {splitParagraphs(briefing).map((paragraph) => (
      <p key={paragraph} className="text-sm leading-relaxed text-nezumi">
        {paragraph}
      </p>
    ))}
  </div>
)

/**
 * 開閉を外から握る版。推理画面のように、複数の資料を1つの状態で切り替える所で使う。
 */
export const CaseNoteDialog = ({
  briefing,
  open,
  onOpenChange,
}: Props & { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>事件の記録</DialogTitle>
      </DialogHeader>
      <CaseNoteBody briefing={briefing} />
    </DialogContent>
  </Dialog>
)

/**
 * 事件の記録の入口。
 *
 * 画面の上に見出し付きのバーを置くほど頻繁には開かないが、完全に隠すと
 * 細部を確かめたくなったときに戻る道が無い。相手のアイコンが並ぶ列の
 * 一番下に、同じ大きさで置いておく。置き場所は呼び出し側が決める。
 *
 * 開閉は Dialog に任せる（Escape・外側の押下・フォーカスの戻し先まで面倒を見てくれる）。
 */
export const CaseNoteButton = ({ briefing }: Props) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="icon" size="icon" aria-label="事件の記録を読む">
        記
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>事件の記録</DialogTitle>
      </DialogHeader>
      <CaseNoteBody briefing={briefing} />
    </DialogContent>
  </Dialog>
)
