import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/client/lib/utils'

/*
  この画面は暗い地に線だけで組み立てる。塗った角丸の箱を並べるとゲームではなく
  設定アプリの見た目になるので、shadcn の既定（白地・角丸・影）はここで全部外し、
  枠線と文字の濃淡だけで状態を出す。

  呼び出し側が className で色を上書きしなくて済むよう、既定をこちらへ寄せておく。
*/
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** 画面の主たる操作。事件を始める・推理を出す、といった一段目のボタン。 */
        default:
          'border border-slate-600 font-semibold tracking-widest text-slate-100 hover:border-slate-400',
        /** 取り返しのつかない操作。 */
        destructive: 'border border-red-900 tracking-widest text-red-400 hover:border-red-700',
        /** 沈めた枠。選ばれていない選択肢や、副次的な入口。 */
        outline:
          'border border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300',
        /** 丸いアイコンボタン（記・図・推）。 */
        icon: 'rounded-full border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200',
        /** 枠なし。列に並ぶ項目そのものを押させるとき。 */
        ghost: 'text-slate-400 hover:text-slate-100',
        /** 文中の細いリンク。 */
        link: 'text-slate-500 underline underline-offset-4 hover:text-slate-300',
      },
      size: {
        /**
         * 高さは3つの目盛りだけ。Input / Select と同じ値を使うので、
         * 横に並べたときに1pxずれて帯がガタつくことがない。
         */
        default: 'h-8 px-3',
        sm: 'h-7 px-2 text-xs',
        lg: 'h-9 px-4',
        /** 縦に伸びる主ボタン。高さではなく余白で厚みを出す。 */
        block: 'w-full py-3',
        icon: 'size-9',
        'icon-sm': 'size-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
