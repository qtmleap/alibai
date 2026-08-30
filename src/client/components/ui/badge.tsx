import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/client/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap px-2 py-0.5 text-xs',
  {
    variants: {
      variant: {
        /** 見つけたもの。増えていくのが分かるよう、この色だけ画面から浮かせる。 */
        default: 'bg-byakuroku/15 text-byakuroku',
        /** 数や残量のような、添えるだけの情報。 */
        muted: 'text-nezumi tabular-nums',
        outline: 'border border-keisen text-nezumi',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
