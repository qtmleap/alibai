import type * as React from 'react'

import { cn } from '@/client/lib/utils'

/*
  枠で囲った入力欄を並べると設定アプリの見た目になる。下線だけにして、
  地は画面の色をそのまま透かす。高さは Button / Select と同じ 8。
*/
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-8 w-full min-w-0 border-keisen border-b bg-transparent px-1 text-kinari text-sm outline-none transition-colors placeholder:text-nezumi-dim focus:border-nezumi disabled:pointer-events-none disabled:opacity-40 file:text-kinari file:text-sm',
        'aria-invalid:border-shu',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
