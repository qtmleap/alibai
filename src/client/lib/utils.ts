import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn の部品が使う class 結合子。
 *
 * 条件付きの class をまとめたうえで、Tailwind の衝突（`p-4` と `p-2` の両方が
 * 付くような場合）を後勝ちで解決する。呼び出し側から見た旨みは、
 * 部品の既定の見た目を className で上書きできること。
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
