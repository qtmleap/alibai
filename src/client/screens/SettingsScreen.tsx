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
import { clampLimits } from '@/shared/turns'

/**
 * このブラウザで使うモデルと、進行の数値を選ぶ画面。
 *
 * 保存先は localStorage だけで、サーバには残らない。自分のプレイにだけ効く。
 * 選べるのは会話と判定の2つ——他の役割は独立した設定を持たず（`db/llm-catalog.ts`）、
 * 並べても操作できない飾りになる。
 *
 * ベースURLとプロンプトはここに無い。前者は攻撃者のサーバへ鍵を送る口になり、
 * 後者は壊れた指示を保存すると全員のプレイが壊れるため。
 */

const LEGEND = 'text-[10px] tracking-[0.3em] text-slate-600'
const LABEL = 'text-[10px] text-slate-500'

/** 未選択を表す値。Select は空文字を値にできないので、明示的な番人を置く。 */
const UNSET = '__unset__'

type Props = {
  /** 差し替え可能にしてあるのは、通信を伴わずに画面を確かめられるようにするため。 */
  load?: () => Promise<LlmSettingsResponse>
}

export const SettingsScreen = ({ load = fetchLlmSettings }: Props) => {
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
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-slate-950 px-5 py-6 text-slate-100">
      <header className="pt-2">
        <h1 className="font-bold text-xl">設定</h1>
        <p className="pt-1 text-slate-500 text-xs">
          この端末にだけ保存され、あなたのプレイにだけ効きます。
        </p>
      </header>

      {failed ? (
        <p className="border-slate-800 border-t pt-4 text-slate-500 text-xs">
          設定の選択肢を取得できませんでした。しばらくしてから開き直してください。
        </p>
      ) : undefined}

      {catalog === undefined ? undefined : (
        <>
          <section className="flex flex-col gap-5">
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
          </section>

          <section className="flex flex-col gap-4 border-slate-800 border-t pt-5">
            <h2 className={LEGEND}>進行</h2>
            <p className="text-slate-500 text-xs">
              新しく始める事件から効きます。進行中のものは変わりません。
            </p>

            <div className="grid grid-cols-3 gap-3">
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

            <p className="text-[10px] text-slate-600">
              質問の総数は {catalog.limits.totalQuestions.max} 件までです。往復を増やすと1つの
              話題にかかる時間と回数が増え、その分だけ早く上限に届きます。
            </p>
          </section>
        </>
      )}
    </div>
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-slate-300 text-sm">{role.label}</span>
        <span className={LABEL}>{role.note}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/*
          Select の外側が label ではなく div なのは、SelectTrigger が label と
          結びつく種類の要素ではないため。名前は aria-label で渡す。
        */}
        <div className="flex flex-col gap-1">
          <span className={LABEL}>提供元</span>
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
                  {entry.available ? entry.label : `${entry.label}（APIキー未設定）`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className={LABEL}>モデル</span>
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
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className={LABEL}>{label}</span>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
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
