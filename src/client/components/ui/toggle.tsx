import { cva, type VariantProps } from 'class-variance-authority'
import { Toggle as TogglePrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/client/lib/utils'

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-nezumi disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-sumi-3 bg-transparent text-nezumi-dim data-[state=on]:border-nezumi-dim data-[state=on]:text-kinari',
        /**
         * 横に並べて等分する目盛り。選んだものだけ罫線と字を起こし、塗り潰さない。
         * 段階が順に並ぶもの（難易度）はこちら。囲うと選択肢が箱になる。
         */
        segment:
          'flex-1 border-keisen border-b bg-transparent text-nezumi-dim data-[state=on]:border-kinari data-[state=on]:text-kinari',
      },
      size: {
        default: 'h-9 min-w-9 px-2',
        sm: 'h-8 min-w-8 px-1.5',
        lg: 'h-10 min-w-10 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
