import { useEffect, useId, useState } from 'react'
import { Input } from '@/client/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { fetchLlmSettings } from '@/client/lib/api'
import { type BriefingMode, loadBriefingMode, saveBriefingMode } from '@/client/lib/briefing-mode'
import type { LlmProvider, LlmSettingsResponse, SettableLlmRole } from '@/client/lib/schemas'
import {
  loadSettings,
  type RoleSetting,
  type Settings,
  saveSettings,
} from '@/client/lib/settings-store'
import { loadSoundSetting, type SoundSetting, saveSoundSetting } from '@/client/lib/sound'
import { clampLimits, modelCallsPerTopic } from '@/shared/turns'

/**
 * このブラウザで使うモデルと、進行の数値を選ぶ画面。
 *
 * 保存先は localStorage だけで、サーバには残らない。自分のプレイにだけ効く。
 * 選べるのは会話と判定の2つ——他の役割は独立した設定を持たず（`db/llm-catalog.ts`）、
 * 並べても操作できない飾りになる。
 *
 * ベースURLとプロンプトはここに無い。前者は攻撃者のサーバへ鍵を送る口になり、
 * 後者は壊れた指示を保存すると全員のプレイが壊れるため。
 *
 * 遊びの外側にある唯一の画面なので、ここだけは演出を持ち込まない。時刻軸も引かない
 * ——ターン数や往復は回数であって盤面の時刻ではなく、同じ帯で描けば軸の意味が薄まる。
 * 同じ理由で数字も等幅にしない。
 *
 * 広い画面（lg）では机（左のアリバイ表）を出さない。物語の外にある画面なので、
 * 他のデスクトップ画面のような二分割にすると、ここまで盤面の続きに見えてしまう。
 * 代わりに内容幅を 760px で止めて中央に置き、余った横幅は
 * 「ラベル左・操作右」に使う——縦に積んだままだと、行がひたすら間延びする。
 */

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には使わない。 */
const LEGEND =
  'font-mono text-[9.5px] leading-[1.75] tracking-[0.24em] text-nezumi-dim lg:text-[10px] lg:leading-[1.8]'
/**
 * 小さい補足。広い画面での寸法はここに焼き込まず、使う場所で足す。
 * 同じ `lg:text-*` を二つ重ねると、どちらが勝つかは生成CSSの順序次第になる。
 */
const FINE = 'text-[10px] leading-[1.7] text-nezumi-dim'
/** 節に付く補足。役割の説明より一段大きい。 */
const FINE_LG = `${FINE} lg:text-[11.5px] lg:leading-[1.8]`
/**
 * 選択欄と数値欄。狭い画面では下線だけ、広い画面では枠で囲む。
 * 端末は指の的が近接するので下線で足りるが、机では欄が横に伸びて
 * 「どこからどこまでが一つの欄か」が下線だけでは追えなくなる。
 */
const FIELD_BOX = 'px-0.5 text-[12px] lg:border lg:px-[10px]'

/** 未選択を表す値。Select は空文字を値にできないので、明示的な番人を置く。 */
const UNSET = '__unset__'

type Props = {
  /** 差し替え可能にしてあるのは、通信を伴わずに画面を確かめられるようにするため。 */
  load?: () => Promise<LlmSettingsResponse>
  /**
   * 保管庫の読み出し。`load` と同じ理由で差し替えられる——選んだあとの見え方は
   * localStorage を仕込まないと出せず、それでは story ごとに状態が混ざる。
   */
  readSettings?: () => Settings
  /** 演出の設定は別の保管庫に住んでいる（記録の画面が単独で読むため）。差し替える理由は同じ。 */
  readBriefing?: () => BriefingMode
  readSound?: () => SoundSetting
  /** 戻り先はルートが決める。他の画面と同じく、ここは表示に専念する。 */
  onBack: () => void
}

export const SettingsScreen = ({
  load = fetchLlmSettings,
  readSettings = loadSettings,
  readBriefing = loadBriefingMode,
  readSound = loadSoundSetting,
  onBack,
}: Props) => {
  const [settings, setSettings] = useState<Settings>(readSettings)
  const [briefing, setBriefing] = useState<BriefingMode>(readBriefing)
  const [sound, setSound] = useState<SoundSetting>(readSound)
  const [catalog, setCatalog] = useState<LlmSettingsResponse | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    load()
      .then(setCatalog)
      .catch(() => setFailed(true))
  }, [load])

  const update = (next: Settings) => {
    saveSettings(next)
    setSettings(next)
  }

  const updateRole = (role: SettableLlmRole, value: RoleSetting | undefined) => {
    const llm = { ...settings.llm }

    if (value === undefined) {
      delete llm[role]
    } else {
      llm[role] = value
    }

    update({ ...settings, llm })
  }

  const chooseBriefing = (next: BriefingMode) => {
    saveBriefingMode(next)
    setBriefing(next)
  }

  const chooseSound = (next: SoundSetting) => {
    saveSoundSetting(next)
    setSound(next)
  }

  // 音は打鍵のときしか鳴らない。せり上がるを選んでいるあいだは選ばせない。
  const soundPickable = briefing === 'typewriter'

  return (
    <div className="screen-enter mx-auto flex min-h-dvh-safe max-w-md flex-col gap-[18px] bg-sumi px-[18px] pt-[26px] pb-6 text-kinari lg:max-w-[760px] lg:gap-[34px] lg:px-0 lg:pt-[46px] lg:pb-[60px]">
      <header>
        {/*
          戻り口だけは机で等幅をやめる。ここは節の見出しではなく道しるべで、
          字間を空けた小さい等幅にすると、760px の柱の頭で読点のように見える。

          机での行の高さ 2.1 は、12px の字に対する数ではなく 25.2px という高さの言い換え
          ——この一行だけ地の字（14px・行1.8）の行に乗るので、1.8 のままだと 22px に痩せて、
          下に続く節がまるごと 3px 持ち上がる。
        */}
        <button
          type="button"
          onClick={onBack}
          className="block font-mono text-[9.5px] text-nezumi-dim leading-[1.75] tracking-[0.24em] lg:font-gothic lg:text-[12px] lg:leading-[2.1] lg:tracking-normal"
        >
          ← 事件を選ぶ
        </button>
        <h1 className="pt-4 font-bold font-mincho text-xl leading-[1.75] tracking-[0.14em] lg:pt-[18px] lg:text-[26px] lg:leading-[1.8] lg:tracking-[0.1em]">
          設定
        </h1>
        <p className="pt-[5px] text-[10.5px] text-nezumi-dim leading-[1.7] lg:pt-2 lg:text-[12.5px] lg:text-nezumi lg:leading-[1.8]">
          この端末にだけ保存されます。サーバには残らず、あなたのプレイにだけ効きます。
        </p>
      </header>

      {failed ? (
        <p className={`border-keisen border-t pt-4 ${FINE_LG}`}>
          設定の選択肢を取得できませんでした。しばらくしてから開き直してください。
        </p>
      ) : undefined}

      {catalog === undefined ? undefined : (
        <>
          {/*
            節の区切りは、狭い画面では見出しの上の一本。広い画面では役割そのものが
            行になり、行ごとの罫線が区切りを兼ねるので、上の一本は引かない
            ——二重に引くと、行の集まりが囲われた箱に見える。
          */}
          {/*
            広い画面では節の中の間合いを罫線側に合わせるので、flex の gap を畳んで
            要素ごとの padding で決める。gap のままだと、見出しと本文の距離と
            罫線までの距離が同じ値に縛られる。
          */}
          <section className="flex flex-col gap-[13px] border-keisen border-t pt-[14px] lg:gap-0 lg:border-t-0 lg:pt-0">
            <h2 className={`${LEGEND} lg:block lg:pb-[7px]`}>使うモデル</h2>

            <div className="flex flex-col gap-[13px] lg:gap-0 lg:border-keisen lg:border-t">
              {catalog.roles.map((role) => (
                <RoleFields
                  key={role.id}
                  role={role}
                  catalog={catalog}
                  value={settings.llm[role.id]}
                  onChange={(next) => updateRole(role.id, next)}
                />
              ))}
            </div>

            <UnavailableNote catalog={catalog} />
          </section>

          <section className="flex flex-col gap-[13px] border-keisen border-t pt-[14px] lg:gap-0 lg:border-t-0 lg:pt-0">
            <h2 className={`${LEGEND} lg:block lg:pb-[7px]`}>進行</h2>
            <p className={`${FINE_LG} lg:pt-[10px]`}>
              新しく始める事件から効きます。進行中のものは変わりません。
            </p>

            <div className="grid grid-cols-3 gap-2 lg:gap-[18px] lg:pt-[14px]">
              <LimitField
                label="ターン数"
                value={settings.limits.maxTurns}
                max={catalog.limits.maxTurns.max}
                onChange={(maxTurns) =>
                  update({
                    ...settings,
                    limits: clampLimits({ ...settings.limits, maxTurns }, settings.limits),
                  })
                }
              />
              <LimitField
                label="1ターンの質問"
                value={settings.limits.questionsPerTurn}
                max={catalog.limits.questionsPerTurn.max}
                onChange={(questionsPerTurn) =>
                  update({
                    ...settings,
                    limits: clampLimits({ ...settings.limits, questionsPerTurn }, settings.limits),
                  })
                }
              />
              <LimitField
                label="1話題の往復"
                value={settings.limits.exchangesPerTopic}
                max={catalog.limits.exchangesPerTopic.max}
                onChange={(exchangesPerTopic) =>
                  update({
                    ...settings,
                    limits: clampLimits({ ...settings.limits, exchangesPerTopic }, settings.limits),
                  })
                }
              />
            </div>

            <Budget settings={settings} max={catalog.limits.totalQuestions.max} />
          </section>
        </>
      )}

      {/*
        事件の記録の見せ方。演出の好みなので、記録の画面に切り替えを置くと毎回そこで一拍止まる。
        物語の外にあるこの画面へ寄せて、始める前に一度だけ決めてもらう。
        モデルの一覧を待たずに決められる値なので、取得の成否とは切り離して置く。
      */}
      <section className="flex flex-col gap-[13px] border-keisen border-t pt-[14px] lg:gap-0 lg:border-t-0 lg:pt-0">
        <h2 className={`${LEGEND} lg:block lg:pb-[7px]`}>事件の記録</h2>

        <div className="flex flex-col gap-[13px] lg:gap-0 lg:border-keisen lg:border-t">
          <ChoiceRow
            name="見せ方"
            note="読み上げの運び"
            // 端末では説明を畳む。見せ方は二つの選択肢そのものが説明になっていて、
            // 狭い画面で一行足すと、次の行との間合いが潰れる。
            noteOnPhone={false}
            choices={BRIEFING_CHOICES}
            value={briefing}
            pickable={true}
            onChange={chooseBriefing}
          />
          <ChoiceRow
            name="打鍵音"
            note="一段落ずつのときだけ鳴ります"
            noteOnPhone={true}
            choices={SOUND_CHOICES}
            value={sound}
            pickable={soundPickable}
            onChange={chooseSound}
          />
        </div>

        <p className={`${FINE_LG} lg:pt-[10px]`}>
          {soundPickable
            ? '一段落ずつは、読む速さをあなたが握ります。'
            : 'せり上がるは速さが決まっているぶん、音は鳴りません。'}
        </p>
      </section>
    </div>
  )
}

type Choice<T extends string> = { key: T; label: string }

const BRIEFING_CHOICES: readonly Choice<BriefingMode>[] = [
  { key: 'typewriter', label: '一段落ずつ' },
  { key: 'crawl', label: 'せり上がる' },
]

const SOUND_CHOICES: readonly Choice<SoundSetting>[] = [
  { key: 'on', label: '鳴らす' },
  { key: 'off', label: '鳴らさない' },
]

/**
 * 二択の行。難易度の四択と同じ組みで、塗りつぶさずに選んだものだけ罫線と字を起こす。
 *
 * 触れないときは「提供元が決まるまでモデルは触れない」のと同じ扱い——枠を地に沈めて、
 * 押せないことを枠と色で言う。灰色にするだけだと、ただの飾りに見える。
 */
const ChoiceRow = <T extends string>({
  name,
  note,
  noteOnPhone,
  choices,
  value,
  pickable,
  onChange,
}: {
  name: string
  note: string
  noteOnPhone: boolean
  choices: readonly Choice<T>[]
  value: T
  pickable: boolean
  onChange: (next: T) => void
}) => (
  <div className="flex flex-col gap-[7px] lg:grid lg:grid-cols-[248px_1fr] lg:items-center lg:gap-5 lg:border-keisen lg:border-b lg:py-[14px]">
    {/*
      端末では名前・説明・二択が同じ間合いで積む。役割の行と違って説明が操作の直前に来るので、
      名前に貼り付けると「打鍵音」と「一段落ずつのときだけ鳴ります」が一かたまりに見える。
      机では名前と説明が左の柱にまとまるので、その 7px は畳む。
    */}
    <div className="flex flex-col gap-[7px] lg:block">
      <div className="text-[13px] leading-[1.75] lg:text-[13.5px] lg:leading-[1.8]">{name}</div>
      <div
        className={`text-[10.5px] text-nezumi-dim leading-[1.6] lg:block lg:text-[11px] ${
          noteOnPhone ? '' : 'hidden'
        }`}
      >
        {note}
      </div>
    </div>

    <div className="flex">
      {choices.map((choice) => (
        <button
          key={choice.key}
          type="button"
          disabled={!pickable}
          aria-pressed={pickable && choice.key === value}
          onClick={() => onChange(choice.key)}
          // 行の高さは地の字のもの（端末 1.75・机 1.8）。既定のままだと二択の帯が 3〜4px 痩せて、
          // 選んだものの下線が上がる——選択を言うのがこの下線なので、そこだけずれると目につく。
          className={`flex-1 border-b py-[7px] text-center text-[11.5px] leading-[1.75] lg:py-[9px] lg:text-[12.5px] lg:leading-[1.8] ${choiceClass(
            pickable,
            pickable && choice.key === value,
          )}`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  </div>
)

const choiceClass = (pickable: boolean, chosen: boolean): string => {
  if (!pickable) {
    return 'border-sumi-3 text-nezumi-dim'
  }

  return chosen ? 'border-kinari text-kinari' : 'border-keisen text-nezumi-dim'
}

/**
 * 三つの数字が実際に何になるか。
 *
 * 積を出さないと、上限に当たって `questionsPerTurn` が黙って削られた理由が
 * 誰にも分からない（`clampLimits`）。呼び出し回数を併記するのは、
 * 上限がある本当の理由が1プレイのコストだから。
 */
const Budget = ({ settings, max }: { settings: Settings; max: number }) => (
  <p className="text-[11px] text-nezumi leading-[1.8] lg:pt-[18px] lg:text-[12.5px] lg:leading-[2]">
    {settings.limits.maxTurns}ターン × {settings.limits.questionsPerTurn}問 ＝{' '}
    <b className="font-medium text-kinari">
      全部で{settings.limits.maxTurns * settings.limits.questionsPerTurn}問
    </b>
    （上限{max}問）。
    <br />
    1話題ごとに、モデルを
    <b className="font-medium text-kinari">
      {modelCallsPerTopic(settings.limits.exchangesPerTopic)}回
    </b>
    呼びます。
  </p>
)

/** 鍵が入っていない提供元は選べない。理由を書かないと、灰色の行が故障に見える。 */
const UnavailableNote = ({ catalog }: { catalog: LlmSettingsResponse }) => {
  const missing = catalog.providers.filter((entry) => !entry.available)

  if (missing.length === 0) {
    return undefined
  }

  return (
    <p className={`${FINE_LG} lg:pt-[10px]`}>
      {missing.map((entry) => entry.label).join('・')} は APIキーが未設定のため選べません。
    </p>
  )
}

const RoleFields = ({
  role,
  catalog,
  value,
  onChange,
}: {
  role: LlmSettingsResponse['roles'][number]
  catalog: LlmSettingsResponse
  value: RoleSetting | undefined
  onChange: (next: RoleSetting | undefined) => void
}) => {
  const provider = value?.provider
  const models =
    provider === undefined ? [] : catalog.providers.find((entry) => entry.id === provider)?.models

  return (
    // 広い画面ではラベル左・操作右の一行。左を固定幅にしてあるのは、役割名の長短で
    // セレクトの左端が揃わなくなると、二つの役割が別の作りに見えるため。
    <div className="flex flex-col gap-[7px] lg:grid lg:grid-cols-[248px_1fr] lg:items-center lg:gap-5 lg:border-keisen lg:border-b lg:py-[14px]">
      <div>
        <div className="text-[13px] leading-[1.75] lg:text-[13.5px] lg:leading-[1.8]">
          {role.label}
        </div>
        <div className="text-[10.5px] text-nezumi-dim leading-[1.6] lg:text-[11px]">
          {role.note}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:gap-[14px]">
        {/*
          Select の外側が label ではなく div なのは、SelectTrigger が label と
          結びつく種類の要素ではないため。名前は aria-label で渡す。
        */}
        <div className="flex min-w-0 flex-col gap-1 lg:gap-[5px]">
          <span className={LEGEND}>提供元</span>
          <Select
            value={provider === undefined ? UNSET : provider}
            onValueChange={(next) =>
              onChange(next === UNSET ? undefined : { provider: pickProvider(catalog, next) })
            }
          >
            <SelectTrigger aria-label={`${role.label}の提供元`} className={triggerClass(provider)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>既定のまま</SelectItem>
              {catalog.providers.map((entry) => (
                <SelectItem key={entry.id} value={entry.id} disabled={!entry.available}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1 lg:gap-[5px]">
          <span className={LEGEND}>モデル</span>
          <Select
            value={value?.model === undefined ? UNSET : value.model}
            disabled={provider === undefined}
            onValueChange={(next) =>
              onChange(
                provider === undefined
                  ? undefined
                  : { provider, model: next === UNSET ? undefined : next },
              )
            }
          >
            <SelectTrigger
              aria-label={`${role.label}のモデル`}
              className={triggerClass(value?.model, provider === undefined)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>既定のまま</SelectItem>
              {(models === undefined ? [] : models).map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

/**
 * 選択欄の見え方。
 *
 * 選んでいないときは字を沈める。「既定のまま」は値ではなく値が無いことの名前なので、
 * 選んだ提供元と同じ明るさで並ぶと、二つの状態が見分けられなくなる。
 * 触れない欄（提供元が決まる前のモデル）は部品側の既定に任せる——枠も字も一緒に沈む。
 * ここで字色まで重ねて沈めると、部品の disabled 時の不透明度と二重にかかって
 * 沈みすぎる（枠だけ見えて字が消える）ので、disabled のときは色を足さない。
 */
const triggerClass = (chosen: string | undefined, disabled = false): string =>
  `${FIELD_BOX} lg:text-[12.5px] [&_svg]:size-3 ${
    !disabled && chosen === undefined ? 'text-nezumi-dim lg:text-nezumi' : ''
  }`

/** 応答に無い提供元は選ばせない。型を通すためだけの分岐ではなく、実際の番人。 */
const pickProvider = (catalog: LlmSettingsResponse, value: string): LlmProvider => {
  const found = catalog.providers.find((entry) => entry.id === value)

  if (found === undefined) {
    throw new Error(`未知の提供元: ${value}`)
  }

  return found.id
}

/**
 * 数値欄。空にされたときに NaN を書き込まないよう、読めた値だけを通す。
 */
const LimitField = ({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (next: number) => void
}) => {
  const id = useId()

  return (
    <label className="flex min-w-0 flex-col gap-1 lg:gap-[5px]" htmlFor={id}>
      <span className={LEGEND}>{label}</span>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        // 広い画面では欄が伸びる。右寄せのままだと値がラベルから離れて、
        // どの数字がどの項目のものか分からなくなる。
        className={`${FIELD_BOX} text-right lg:text-[13px] lg:text-left`}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10)

          if (Number.isFinite(next)) {
            onChange(next)
          }
        }}
      />
    </label>
  )
}
