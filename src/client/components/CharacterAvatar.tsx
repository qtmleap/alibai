type Props = {
  name: string
  /** 登場順。色を割り当てるのに使う。 */
  index: number
  active?: boolean
  size?: 'sm' | 'md'
}

/**
 * 相手ごとの色。
 *
 * Tailwind はクラス名を静的に走査するので、`bg-${color}-900` のような組み立てでは
 * 消される。使う色は必ず文字列そのままで並べておく。
 */
const PALETTE = [
  'bg-rose-900/70 text-rose-100',
  'bg-emerald-900/70 text-emerald-100',
  'bg-sky-900/70 text-sky-100',
  'bg-amber-900/70 text-amber-100',
  'bg-violet-900/70 text-violet-100',
]

/** 姓の一文字目。サロゲートペアで割れないよう Array.from で取る。 */
export const initialOf = (name: string): string => {
  const first = Array.from(name.trim())[0]

  return first === undefined ? '?' : first
}

/**
 * 会話相手のアイコン。
 *
 * 写真は持てないので頭文字を置く。名前だけを並べるより、色と形で
 * 「誰と話しているか」が視界の端でも分かる。チャットアプリで顔写真が
 * 果たしている役目を、最小限のもので代える。
 */
export const CharacterAvatar = ({ name, index, active = false, size = 'md' }: Props) => {
  const color = PALETTE[index % PALETTE.length]
  const box = size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm'

  return (
    <span
      aria-hidden="true"
      className={`flex ${box} shrink-0 items-center justify-center rounded-full font-semibold ${color} ${
        active ? 'ring-2 ring-indigo-400' : ''
      }`}
    >
      {initialOf(name)}
    </span>
  )
}
