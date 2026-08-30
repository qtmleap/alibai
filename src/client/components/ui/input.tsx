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
        'flex h-8 w-full min-w-0 border-slate-700 border-b bg-transparent px-1 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-slate-400 disabled:pointer-events-none disabled:opacity-40 file:text-sm file:text-slate-100',
        'aria-invalid:border-red-800',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
