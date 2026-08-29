import { type ReactNode, useEffect, useId } from 'react'

type Props = {
  title: string
  children: ReactNode
  onClose: () => void
}

/**
 * 読み返し用のモーダル。
 *
 * 画面遷移せず今の聞き込みをそのまま保てるよう、軽いダイアログに留める。
 * 背景は「押せる見た目の要素」にせず、dialog::backdrop と同じ役目の別ボタンを
 * 下に敷く。そうすると、背景クリックで閉じる操作をアクセシブルな button として
 * 実装でき、静的な div にクリックを付けることもない。
 */
export const Modal = ({ title, children, onClose }: Props) => {
  const titleId = useId()

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute inset-0 cursor-default bg-slate-950/80"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold tracking-widest text-slate-200">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 text-lg text-slate-400"
            aria-label="閉じる"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  )
}
