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
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-1 focus-visible:ring-nezumi disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** 画面の主たる操作。事件を始める・推理を出す、といった一段目のボタン。 */
        default:
          'border border-nezumi-dim font-semibold tracking-widest text-kinari hover:border-nezumi',
        /** 取り返しのつかない操作。朱が出るのはこの variant だけ。 */
        destructive: 'border border-shu tracking-widest text-shu hover:border-shu',
        /** 沈めた枠。選ばれていない選択肢や、副次的な入口。 */
        outline: 'border border-sumi-3 text-nezumi-dim hover:border-nezumi-dim hover:text-nezumi',
        /** 丸いアイコンボタン（記・図・推）。 */
        icon: 'rounded-full border border-keisen text-nezumi hover:border-nezumi-dim hover:text-kinari',
        /** 枠なし。列に並ぶ項目そのものを押させるとき。 */
        ghost: 'text-nezumi hover:text-kinari',
        /** 文中の細いリンク。 */
        link: 'text-nezumi-dim underline underline-offset-4 hover:text-nezumi',
      },
      size: {
        /**
         * 高さは3つの目盛りだけ。Input / Select と同じ値を使うので、
         * 横に並べたときに1pxずれて帯がガタつくことがない。
         */
        default: 'h-8 px-3',
        sm: 'h-7 px-2 text-xs',
        lg: 'h-9 px-4',
        /**
         * 縦に伸びる主ボタン。高さではなく余白で厚みを出す。
         * 語りと同じ明朝で、字送りを広く取る——押す前に一拍置かせるため。
         */
        block:
          'w-full py-[11px] font-mincho font-normal tracking-[0.2em] lg:py-[13px] lg:text-[15px]',
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
