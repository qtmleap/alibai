type Props = {
  name: string
  /** 登場順。色を割り当てるのに使う。 */
  index: number
  active?: boolean
  size?: 'sm' | 'md'
}

/**
 * 相手ごとの顔料。
 *
 * 明度も彩度も揃えてある。誰か一人だけが目立つと、画面がプレイヤーより先に
 * その人を怪しむことになる。強調色を持たないのはそのため。
 *
 * Tailwind はクラス名を静的に走査するので、`bg-${color}` のような組み立てでは
 * 消される。使う色は必ず文字列そのままで並べておく。
 */
const PALETTE = [
  'bg-asagi/15 text-asagi-fg',
  'bg-fuji/15 text-fuji-fg',
  'bg-suou/15 text-suou-fg',
  'bg-karashi/15 text-karashi-fg',
]

/** 字だけに顔料を乗せたいとき（名前・目盛り・縦罫）。丸の下地は要らない。 */
const INK = ['text-asagi-fg', 'text-fuji-fg', 'text-suou-fg', 'text-karashi-fg']

/** 面に塗るとき（時刻軸の目盛り）。 */
const SURFACE = ['bg-asagi', 'bg-fuji', 'bg-suou', 'bg-karashi']

/** 縦罫を立てるとき（発話の塊の左端）。どこまでが一人の言葉かを示す。 */
const EDGE = ['border-asagi', 'border-fuji', 'border-suou', 'border-karashi']

/** 剰余で必ず範囲に収まるが、添字アクセスの型は undefined を含む。既定を明示して通す。 */
const pick = (list: string[], index: number, fallback: string): string => {
  const found = list[index % list.length]

  return found === undefined ? fallback : found
}

export const inkOf = (index: number): string => pick(INK, index, 'text-nezumi')

export const surfaceOf = (index: number): string => pick(SURFACE, index, 'bg-nezumi')

export const edgeOf = (index: number): string => pick(EDGE, index, 'border-keisen')

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
  const color = pick(PALETTE, index, 'bg-sumi-3 text-nezumi')
  const box = size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm'

  return (
    <span
      aria-hidden="true"
      className={`flex ${box} shrink-0 items-center justify-center rounded-full font-bold font-mincho ${color} ${
        // 選ばれている合図はその人の顔料そのもの。別の色を足すと、選択が誰の色でもなくなる。
        active ? 'ring-[1.5px] ring-current' : ''
      }`}
    >
      {initialOf(name)}
    </span>
  )
}
