import type * as React from 'react'

import { cn } from '@/client/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full border border-slate-800 bg-transparent p-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-slate-500 disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
