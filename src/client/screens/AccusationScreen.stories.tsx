import type { Meta, StoryObj } from '@storybook/react-vite'
import type { AlibiSegment } from '@/client/components/AlibiChart'
import { useInterrogation } from '@/client/hooks/useInterrogation'
import { AccusationScreen, VICTIM_KEY } from '@/client/screens/AccusationScreen'
import { INTERROGATION_SEED_LAST_TURN, SCENARIO } from '@/client/stories/fixtures'

/**
 * ALI_ACC — 告発。
 * 聞き込みの記録を持ち込む画面なので、フックは本物を呼ぶ（INT と同じ理由）。
 */
const SESSION = 'e58a1c74-9b02-4d36-af51-72c9e0b4d386'

/** 固定データの登場人物。並びが変わったら気付けるよう、欠けたら止める。 */
const idOf = (index: number): string => {
  const character = SCENARIO.characters[index]

  if (character === undefined) {
    throw new Error(`固定データに${index}番目の登場人物がいないよ〜。`)
  }

  return character.id
}

const MAKINO = idOf(0)
const KURODA = idOf(1)
const SENA = idOf(2)

/**
 * 打ち止めまで聞いたところ。告発はもう聞き終えたあとの画面なので、
 * 集めた供述を全部渡す（聞き込み中の列は無い）。
 */
const SEGMENTS: AlibiSegment[] = [
  { who: MAKINO, from: '18:20', to: '18:36', kind: 'solid', place: '店内' },
  { who: MAKINO, from: '18:36', to: '19:08', kind: 'claim', place: '郵便局へ、雨のなかを' },
  /*
   * 帳場の帳面から立つ短い裏付け。聞き込みだけでなく場所を調べても線が引けるので、
   * 申告の破線と同じ時間帯にこれが重なる——告発の画面はその食い違いを見ながら書く。
   */
  {
    who: MAKINO,
    from: '18:40',
    to: '18:44',
    kind: 'solid',
    place: '帳場',
    fix: '18:44　最後の記帳',
  },
  { who: MAKINO, from: '19:08', to: '19:14', kind: 'solid', place: '郵便窓口', fix: '19:08　受付' },
  { who: KURODA, from: '18:23', to: '18:41', kind: 'solid', place: '店内', fix: '18:23　来店' },
  {
    who: KURODA,
    from: '18:41',
    to: '18:48',
    kind: 'solid',
    place: '裏の路地',
    fix: '18:41　忘れ傘',
  },
  { who: KURODA, from: '18:48', to: '19:20', kind: 'claim', place: '帰宅したと申告' },
  { who: SENA, from: '18:20', to: '18:39', kind: 'claim', place: '向かいの喫茶店' },
  {
    who: SENA,
    from: '18:39',
    to: '18:48',
    kind: 'solid',
    place: '青雨堂の軒先',
    fix: '18:39　雨宿り',
  },
  { who: SENA, from: '18:48', to: '19:12', kind: 'claim', place: '喫茶店に戻る' },
  { who: SENA, from: '19:12', to: '19:20', kind: 'solid', place: '青雨堂', fix: '19:12　通報' },
  { who: VICTIM_KEY, from: '18:20', to: '18:50', kind: 'solid', place: '店の奥' },
]

const Harness = () => {
  const interrogation = useInterrogation(INTERROGATION_SEED_LAST_TURN)

  return (
    <AccusationScreen
      scenario={SCENARIO}
      sessionId={SESSION}
      interrogation={interrogation}
      alibi={{ segments: SEGMENTS, deadline: { at: '18:50', label: '死亡推定' } }}
      onResult={() => undefined}
      onBack={() => undefined}
    />
  )
}

const meta: Meta<typeof AccusationScreen> = {
  title: 'Screens/ACC 告発',
  component: AccusationScreen,
}

export default meta

type Story = StoryObj<typeof AccusationScreen>

/**
 * 指名だけ済んで、まだ何も書いていないところ。提出は取り消せないので、朱はここにしか出ない。
 *
 * 開いた直後に先頭のラジオを押しておく——指した一人だけ下辺と名が朱に替わる形は、
 * 誰も選ばれていない画面では出てこない。素のラジオを直に押すので、
 * 見た目を持たない sr-only のままでも状態は本物と同じ道を通る。
 */
export const Default: Story = {
  render: () => <Harness />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector('input')?.click()
  },
}
