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
import type { LlmProvider, LlmSettingsResponse, SettableLlmRole } from '@/client/lib/schemas'
import {
  loadSettings,
  type RoleSetting,
  type Settings,
  saveSettings,
} from '@/client/lib/settings-store'
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
 */

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には使わない。 */
const LEGEND = 'font-mono text-[9.5px] tracking-[0.24em] text-nezumi-dim'
const FINE = 'text-[10px] leading-[1.7] text-nezumi-dim'

/** 未選択を表す値。Select は空文字を値にできないので、明示的な番人を置く。 */
const UNSET = '__unset__'

type Props = {
  /** 差し替え可能にしてあるのは、通信を伴わずに画面を確かめられるようにするため。 */
  load?: () => Promise<LlmSettingsResponse>
  /** 戻り先はルートが決める。他の画面と同じく、ここは表示に専念する。 */
  onBack: () => void
}

export const SettingsScreen = ({ load = fetchLlmSettings, onBack }: Props) => {
  const [settings, setSettings] = useState<Settings>(loadSettings)
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

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] bg-sumi px-5 py-6 text-kinari">
      <header>
        <button type="button" onClick={onBack} className={LEGEND}>
          ← 事件を選ぶ
        </button>
        <h1 className="pt-4 font-bold font-mincho text-xl tracking-[0.14em]">設定</h1>
        <p className="pt-1.5 text-[10.5px] text-nezumi-dim leading-[1.7]">
          この端末にだけ保存されます。サーバには残らず、あなたのプレイにだけ効きます。
        </p>
      </header>

      {failed ? (
        <p className={`border-keisen border-t pt-4 ${FINE}`}>
          設定の選択肢を取得できませんでした。しばらくしてから開き直してください。
        </p>
      ) : undefined}

      {catalog === undefined ? undefined : (
        <>
          <section className="flex flex-col gap-[13px] border-keisen border-t pt-[14px]">
            <h2 className={LEGEND}>使うモデル</h2>

            {catalog.roles.map((role) => (
              <RoleFields
                key={role.id}
                role={role}
                catalog={catalog}
                value={settings.llm[role.id]}
                onChange={(next) => updateRole(role.id, next)}
              />
            ))}

            <UnavailableNote catalog={catalog} />
          </section>

          <section className="flex flex-col gap-[13px] border-keisen border-t pt-[14px]">
            <h2 className={LEGEND}>進行</h2>
            <p className={FINE}>新しく始める事件から効きます。進行中のものは変わりません。</p>

            <div className="grid grid-cols-3 gap-2">
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
    </div>
  )
}

/**
 * 三つの数字が実際に何になるか。
 *
 * 積を出さないと、上限に当たって `questionsPerTurn` が黙って削られた理由が
 * 誰にも分からない（`clampLimits`）。呼び出し回数を併記するのは、
 * 上限がある本当の理由が1プレイのコストだから。
 */
const Budget = ({ settings, max }: { settings: Settings; max: number }) => (
  <p className="text-[11px] text-nezumi leading-[1.8]">
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
    <p className={FINE}>
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
    <div className="flex flex-col gap-[7px]">
      <div>
        <div className="text-[13px]">{role.label}</div>
        <div className={FINE}>{role.note}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/*
          Select の外側が label ではなく div なのは、SelectTrigger が label と
          結びつく種類の要素ではないため。名前は aria-label で渡す。
        */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className={LEGEND}>提供元</span>
          <Select
            value={provider === undefined ? UNSET : provider}
            onValueChange={(next) =>
              onChange(next === UNSET ? undefined : { provider: pickProvider(catalog, next) })
            }
          >
            <SelectTrigger aria-label={`${role.label}の提供元`}>
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

        <div className="flex min-w-0 flex-col gap-1">
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
            <SelectTrigger aria-label={`${role.label}のモデル`}>
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
    <label className="flex min-w-0 flex-col gap-1" htmlFor={id}>
      <span className={LEGEND}>{label}</span>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        className="text-right"
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
