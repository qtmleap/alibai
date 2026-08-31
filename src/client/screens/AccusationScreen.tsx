import { useId, useState } from 'react'
import { AlibiChart, type AlibiPerson, type AlibiSegment } from '@/client/components/AlibiChart'
import { CharacterAvatar, inkOf, surfaceOf } from '@/client/components/CharacterAvatar'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { describeError, submitAccusation } from '@/client/lib/api'
import type { AccuseResult, ScenarioDetail } from '@/client/lib/schemas'
import { playSe } from '@/client/lib/sound'

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には使わない。 */
const LEGEND = 'font-mono text-[9.5px] tracking-[0.24em] text-nezumi-dim lg:text-[10px]'
/** 盤面の時刻。こちらは値そのものなので等幅で桁を揃える。 */
const CLOCK = 'font-mono text-[9.5px] tracking-[0.24em] text-nezumi-dim tabular-nums'

/**
 * 被害者の列に使う鍵。登場人物のIDと衝突しないように、UUIDではない字面を選ぶ。
 * 供述を渡す側（story／将来のサーバ応答）が同じ鍵を使う必要があるので公開する。
 */
export const VICTIM_KEY = 'victim'

/** 顔料の割り当ては登場順。CharacterAvatar と同じ並びを使う。 */
const HUES = ['asagi', 'fuji', 'suou', 'karashi'] as const

const hueOf = (index: number): AlibiPerson['hue'] => {
  const found = HUES[index % HUES.length]

  return found === undefined ? 'asagi' : found
}

/**
 * 表の列見出しに出す肩書。
 * 「店員。書誌と発送手順には強い」の頭だけを取る——列幅は 108px しかなく、
 * 紹介文をそのまま入れると見出しが四行の塊になる。
 */
const roleOf = (introduction: string): string => {
  const head = introduction.split('。')[0]

  return head === undefined ? introduction : head
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':')

  return Number(h) * 60 + Number(m)
}

type Props = {
  scenario: ScenarioDetail
  /** 進行中のセッション。画面が使うのはIDだけ。 */
  sessionId: string
  /** 残りターンを上部バーに出すためだけに持ち込む。 */
  interrogation: UseInterrogation
  /**
   * 聞き終えた供述と、被害者の刻限。まだサーバから降ってこないので、
   * 渡せる呼び出し側からだけ受ける。無ければ表は白紙のまま出る。
   */
  alibi?: { segments: AlibiSegment[]; deadline: { at: string; label: string } }
  onResult: (result: AccuseResult) => void
  onBack: () => void
}

/**
 * 告発。
 *
 * この画面の主作業は「書くこと」で、選ぶことではない。だから容疑者の指名は
 * 横一列に畳んで一行で済ませ、空いた縦をまるごと記述欄へ渡す。
 * 縦に三人並べて右を空けるのは前の形で、やり直した理由がそれ。
 *
 * 広い画面では机の左にアリバイ表を据える（聞き込みと同じ場所・同じ形）。
 * 埋めきれなかった時間がどこかを見ながら書く画面なので、表が隣に無いと
 * 記憶だけで書くことになる。端末では一列に畳み、表は帯へ置き換える。
 */
export const AccusationScreen = ({
  scenario,
  sessionId,
  interrogation,
  alibi,
  onResult,
  onBack,
}: Props) => {
  const methodId = useId()
  const motiveId = useId()
  const [culpritCharacterId, setCulpritCharacterId] = useState<string | undefined>(undefined)
  const [method, setMethod] = useState('')
  const [motive, setMotive] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const segments = alibi === undefined ? [] : alibi.segments
  const deadline = alibi === undefined ? undefined : alibi.deadline
  const turn = interrogation.turn
  const timeWindow = scenario.timeWindow
  const victim = scenario.victim

  // 表の列は聞き込みの相手＋被害者。被害者は話しかけられないが、
  // 刻限までの在所が引かれるので、列が無いと死亡推定の線が宙に浮く。
  const people: AlibiPerson[] = [
    ...scenario.characters.map((character, index) => ({
      key: character.id,
      name: character.name,
      role: roleOf(character.publicIntroduction),
      hue: hueOf(index),
    })),
    ...(victim === null
      ? []
      : [
          {
            key: VICTIM_KEY,
            name: victim.name,
            role: '被害者',
            hue: hueOf(scenario.characters.length),
          },
        ]),
  ]

  /** 帯のなかでの位置。端末側は幅が端末に依るので、px ではなく % で置く。 */
  const ratio = (at: string): string => {
    if (timeWindow === null) {
      return '0%'
    }

    const from = toMinutes(timeWindow.start)
    const length = toMinutes(timeWindow.end) - from

    return `${(((toMinutes(at) - from) / length) * 100).toFixed(1)}%`
  }

  const canSubmit =
    culpritCharacterId !== undefined &&
    method.trim().length > 0 &&
    motive.trim().length > 0 &&
    !submitting

  const handleSubmit = () => {
    if (culpritCharacterId === undefined) {
      return
    }

    // 押した手応え。答え合わせを待つあいだ画面は動かないので、ここで一つ返す。
    playSe('decide')

    setSubmitting(true)
    setError(undefined)

    submitAccusation({
      sessionId,
      culpritCharacterId,
      /*
       * 「理由」の欄はこの画面に無い（書く場所は殺害方法と動機の二列だけ）。
       * サーバは根拠を空で受け取らないので、書かれた二つをそのまま根拠として送る。
       */
      reasoning: `${method.trim()}\n\n${motive.trim()}`,
      method: method.trim(),
      motive: motive.trim(),
    })
      .then(onResult)
      .catch((err: unknown) => {
        setError(describeError(err))
        setSubmitting(false)
      })
  }

  return (
    // 地の字送りは端末と机で違う。行の高さを一箇所で決めて、あとは継がせる。
    <div className="screen-enter flex min-h-dvh flex-col bg-sumi text-[13px] text-kinari leading-[1.75] lg:h-dvh lg:overflow-hidden lg:text-[14px] lg:leading-[1.8]">
      {/* 上部バーは薄く、机の面を最大に取る。ここに出るのは戻り口と残りターンだけ。 */}
      <header className="flex shrink-0 items-center justify-between gap-5 px-[18px] pt-[22px] lg:h-[46px] lg:border-keisen lg:border-b lg:px-[22px] lg:pt-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 font-mono text-[9.5px] text-nezumi-dim tracking-[0.24em] lg:gap-3 lg:font-gothic lg:text-[12px] lg:tracking-normal"
        >
          {/* 矢印と文字の間合いは端末と机で違う。空白の文字を挟まず、間で開ける。 */}
          <span aria-hidden="true">←</span>
          聞き込みに戻る
        </button>
        {turn === undefined ? null : (
          // ターン数は回数なので地の書体のまま。等幅は盤面の時刻にだけ使う。
          <span className="hidden text-[12px] text-nezumi-dim lg:block">
            {turn.turn} / {turn.maxTurns} ターン
          </span>
        )}
      </header>

      <div
        className={
          timeWindow === null
            ? 'flex min-h-0 flex-1 flex-col'
            : 'flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[524px_1fr]'
        }
      >
        {timeWindow === null ? null : (
          <aside className="hidden min-h-0 flex-col border-keisen border-r px-[22px] pt-[14px] pb-3 lg:flex">
            <div className="flex items-baseline justify-between leading-[1.4]">
              <h2 className="font-mincho text-[14px] tracking-[0.1em]">アリバイ表</h2>
              <span className="font-mono text-[10px] text-nezumi-dim tracking-[0.24em] tabular-nums">
                {timeWindow.start} – {timeWindow.end}
              </span>
            </div>

            <AlibiChart
              people={people}
              segments={segments}
              span={{ from: timeWindow.start, to: timeWindow.end }}
              deadline={deadline}
            />

            {/* 線の意味はここで一度だけ言う。表の中に註を足すと、供述より註が目立つ。 */}
            <div className="mt-4 flex items-center gap-5 text-[10.5px] text-nezumi-dim leading-[1.4]">
              <span className="inline-flex items-center gap-[6px]">
                <span aria-hidden="true" className="h-[3px] w-[14px] bg-nezumi" />
                <span className="text-nezumi">実線</span>　裏付けあり
              </span>
              <span className="inline-flex items-center gap-[6px]">
                <span
                  aria-hidden="true"
                  className="w-[14px] border-nezumi-dim border-t border-dashed"
                />
                <span className="text-nezumi">破線</span>　本人の申告のみ
              </span>
            </div>
          </aside>
        )}

        <section className="flex min-h-0 flex-1 flex-col px-[18px] pb-6 lg:px-[34px] lg:pt-6 lg:pb-[22px]">
          <div className="shrink-0 pt-2 lg:border-keisen lg:border-b lg:pt-0 lg:pb-[18px]">
            <h1 className="font-medium font-mincho text-[21px] tracking-[0.08em] lg:font-bold lg:text-[26px] lg:leading-[1.45] lg:tracking-[0.05em]">
              犯人を指し示す
            </h1>
            <p className="pt-1 text-[12px] text-nezumi lg:max-w-[42em] lg:pt-[10px] lg:text-[13px] lg:leading-[1.9]">
              誰が、どうやって、なぜ。
              {/* 机では一行に収まるので言い添える。端末では畳んで、軸へ場所を譲る。 */}
              <span className="hidden lg:inline">提出すると取り消せません。</span>
            </p>
          </div>

          {/*
            端末の時刻軸。一人一段の帯に畳む。裏付けのある区間は濃く、申告だけの
            区間は薄く——机の実線／破線と同じ区別を、線の太さではなく濃さで言い換える。
          */}
          {timeWindow === null ? null : (
            <div className="relative mt-[18px] mb-[14px] h-[106px] shrink-0 lg:hidden">
              {scenario.characters.map((character, index) => (
                <div
                  key={character.id}
                  className="absolute inset-x-0 h-[3px]"
                  style={{ top: `${12 + index * 32}px` }}
                >
                  <span
                    className={`-translate-y-[13px] absolute left-0 text-[10px] ${inkOf(index)}`}
                  >
                    {character.name}
                  </span>
                  {segments
                    .filter((segment) => segment.who === character.id)
                    .map((segment) => (
                      <span
                        key={`${segment.who}-${segment.from}`}
                        className={`absolute h-[3px] ${surfaceOf(index)} ${
                          segment.kind === 'solid' ? '' : 'opacity-[0.22]'
                        }`}
                        style={{
                          left: ratio(segment.from),
                          width: `calc(${ratio(segment.to)} - ${ratio(segment.from)})`,
                        }}
                      />
                    ))}
                </div>
              ))}

              {deadline === undefined ? null : (
                <span
                  className="absolute top-[6px] bottom-[22px] w-px bg-nezumi-dim"
                  style={{ left: ratio(deadline.at) }}
                />
              )}

              <div className="absolute inset-x-0 bottom-0 flex justify-between border-keisen border-t pt-[5px]">
                <span className={CLOCK}>{timeWindow.start}</span>
                {deadline === undefined ? null : <span className={CLOCK}>{deadline.at}</span>}
                <span className={CLOCK}>{timeWindow.end}</span>
              </div>
            </div>
          )}

          {/*
            指名は三択。机では横一列に畳み、選ばれた一人だけ下辺を朱に替える
            ——塗り足しも枠も足さない。端末では幅が足りないので縦の行に戻す。
          */}
          <fieldset className="flex shrink-0 flex-col lg:mt-6">
            <legend className={LEGEND}>犯人</legend>
            <div className="mt-[6px] flex flex-col border-keisen border-t lg:mt-[7px] lg:grid lg:auto-cols-fr lg:grid-flow-col lg:border-t-0">
              {scenario.characters.map((character, index) => {
                const picked = character.id === culpritCharacterId

                return (
                  <label
                    key={character.id}
                    className={`flex cursor-pointer items-center gap-[10px] border-keisen border-b py-[10px] text-[13px] has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-nezumi lg:border-t lg:px-[14px] lg:py-[13px] lg:text-[13.5px] ${
                      picked ? 'lg:border-b-shu' : ''
                    } ${index === 0 ? '' : 'lg:border-l'}`}
                  >
                    {/* ラジオは見た目を持たせず、行そのものを押す場所にする。
                        矢印キーでの移動は素のラジオのままにしておきたいので、隠すだけ。 */}
                    <input
                      type="radio"
                      name="culprit"
                      value={character.id}
                      checked={picked}
                      onChange={() => setCulpritCharacterId(character.id)}
                      className="sr-only"
                    />
                    {/* 端末は点、机は顔。どちらも指した相手だけ朱に替わる。 */}
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full lg:hidden ${
                        picked ? 'bg-shu' : surfaceOf(index)
                      }`}
                    />
                    <span className="hidden lg:block">
                      <CharacterAvatar name={character.name} index={index} size="sm" />
                    </span>
                    <span className={picked ? 'text-shu' : 'text-nezumi'}>{character.name}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* 書く面。二列に並べ、縦は余りをすべて食わせる。 */}
          <div className="mt-4 flex min-h-0 flex-col gap-4 lg:mt-0 lg:grid lg:flex-1 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-0 lg:pt-[26px]">
            <Field
              id={methodId}
              label="殺害方法"
              value={method}
              placeholder="どうやって殺したのか"
              hint="表の実線と破線が食い違う時間帯を手がかりに。"
              className=""
              onChange={setMethod}
            />
            {/* 二列のあいだは罫線で仕切る。余白だけだと、机の上で紙が二枚に見えない。 */}
            <Field
              id={motiveId}
              label="動機"
              value={motive}
              placeholder="なぜ殺したのか"
              hint="聞き出した秘密のうち、殺すに足るものはどれか。"
              className="lg:-ml-10 lg:border-keisen lg:border-l lg:pl-10"
              onChange={setMotive}
            />
          </div>

          <div className="mt-5 shrink-0 lg:mt-auto lg:pt-[22px]">
            {error === undefined ? null : <p className="pb-2 text-[12px] text-nezumi">{error}</p>}
            {/* 取り消せない一手。朱の枠はこの画面でここだけに出す。 */}
            <Button
              size="block"
              variant="destructive"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="py-[11px] font-mincho leading-[1.75] tracking-[0.24em] lg:py-[13px] lg:text-[15px] lg:leading-[1.8] lg:tracking-[0.2em]"
            >
              {submitting ? '送信中…' : 'この推理を提出する'}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

/**
 * 書く欄ひとつ。
 * 欄は箱で囲う——複数行はどこまで書けるか分からないので、範囲を枠で示す
 * （一行の入力を下線だけにしているのと同じ理由の裏返し）。
 */
const Field = ({
  id,
  label,
  value,
  placeholder,
  hint,
  className,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  /** 欄の下に一行だけ添える手引き。狭い画面では畳む。 */
  hint: string
  /** 段組みの都合（仕切りの罫線）だけを外から渡す。無いときは空文字。 */
  className: string
  onChange: (next: string) => void
}) => (
  <div className={`flex min-h-0 flex-col ${className}`}>
    <label htmlFor={id} className={`${LEGEND} pb-[6px] lg:pb-[9px]`}>
      {label}
    </label>
    <Textarea
      id={id}
      value={value}
      placeholder={placeholder}
      // 端末では枠の高さを min-height で決める。rows の既定（2行）だとそちらが勝つ。
      rows={1}
      onChange={(event) => onChange(event.target.value)}
      // 書くほどに伸びると、下にある提出ボタンが逃げていく。高さは段組みが決める。
      className="field-sizing-fixed min-h-[42px] resize-none px-[11px] py-[9px] text-[12px] lg:min-h-0 lg:flex-1 lg:px-4 lg:py-[14px] lg:text-[13.5px] lg:leading-[1.95]"
    />
    <p className="hidden pt-2 text-[11.5px] text-nezumi-dim leading-[1.7] lg:block">{hint}</p>
  </div>
)
