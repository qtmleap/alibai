import { useState } from 'react'
import {
  activeDetective,
  clearActiveDetective,
  type DetectiveStore,
  loadDetectiveStore,
  newDetectiveId,
  removeDetective,
  type StoredDetective,
  saveDetectiveStore,
  setActiveDetective,
  toDetective,
  upsertDetective,
} from '@/client/lib/detective-store'
import type { Detective, ScenarioDetail } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  onDecided: (detective: Detective | undefined) => void
  onBack: () => void
}

/** 編集中のフォーム。新規作成なら id は未発行。 */
type Draft = { id: string | undefined } & Detective

const emptyDraft = (): Draft => ({
  id: undefined,
  name: '',
  age: '',
  gender: '',
  appearance: '',
})

/**
 * 探偵役の設定。
 *
 * 探偵はシナリオごとに作り直すものではなく、いくつか作り置いて選んで使う。
 * 保存は localStorage（アカウントの仕組みがまだ無いため）。
 *
 * 全項目を必須にすると遊び始めるまでの手数が増えるので、名前だけ埋まっていれば
 * 保存できる。「名乗らずに始める」も一級の選択肢として残す。
 */
export const DetectiveSetupScreen = ({ scenario, onDecided, onBack }: Props) => {
  const [store, setStore] = useState<DetectiveStore>(loadDetectiveStore)
  const [draft, setDraft] = useState<Draft | undefined>(undefined)

  const update = (next: DetectiveStore) => {
    saveDetectiveStore(next)
    setStore(next)
  }

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((current) => (current === undefined ? current : { ...current, ...patch }))

  const handleSaveDraft = () => {
    if (draft === undefined) {
      return
    }

    const saved: StoredDetective = {
      id: draft.id === undefined ? newDetectiveId() : draft.id,
      name: draft.name,
      age: draft.age,
      gender: draft.gender,
      appearance: draft.appearance,
    }

    update(upsertDetective(store, saved))
    setDraft(undefined)
  }

  const selected = activeDetective(store)

  if (draft !== undefined) {
    const canSave = draft.name.trim().length > 0

    return (
      <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-slate-950 p-4 text-slate-100">
        <header className="pt-4">
          <h1 className="text-xl font-bold">
            {draft.id === undefined ? '探偵をつくる' : '探偵を編集する'}
          </h1>
        </header>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">名前</span>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              maxLength={40}
              placeholder="例：日下部 灯"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-slate-400">年齢</span>
              <input
                type="text"
                value={draft.age}
                onChange={(event) => updateDraft({ age: event.target.value })}
                maxLength={20}
                placeholder="28／30代／不詳"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>

            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-slate-400">性別</span>
              <input
                type="text"
                value={draft.gender}
                onChange={(event) => updateDraft({ gender: event.target.value })}
                maxLength={20}
                placeholder="自由に書けます"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">容姿</span>
            <textarea
              value={draft.appearance}
              onChange={(event) => updateDraft({ appearance: event.target.value })}
              maxLength={200}
              rows={3}
              placeholder="例：くたびれたコートを着た長身。目つきが鋭く、口数は少ない。"
              className="resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
        </section>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={!canSave}
          className="rounded-lg bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          保存する
        </button>

        <button
          type="button"
          onClick={() => setDraft(undefined)}
          className="text-sm text-slate-400 underline"
        >
          やめる
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-slate-950 p-4 text-slate-100">
      <header className="pt-4">
        <p className="text-xs text-slate-500">これから調べる事件</p>
        <h1 className="text-xl font-bold">{scenario.title}</h1>
        <p className="mt-3 text-sm text-slate-300">
          誰として、この事件を調べますか。
          <br />
          選んだ人物像は、聞き込みの相手にも伝わります。
        </p>
      </header>

      {store.profiles.length === 0 && (
        <p className="text-sm text-slate-500">
          まだ探偵がいません。作るか、名乗らずに始めることもできます。
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {store.profiles.map((profile) => {
          const isActive = profile.id === store.activeId

          return (
            <li
              key={profile.id}
              className={
                isActive
                  ? 'rounded-xl border border-indigo-500 bg-slate-900 p-3'
                  : 'rounded-xl border border-slate-800 bg-slate-900 p-3'
              }
            >
              <button
                type="button"
                onClick={() => update(setActiveDetective(store, profile.id))}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold">
                      選択中
                    </span>
                  )}
                  <span className="font-semibold">{profile.name}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {[profile.age, profile.gender].filter((part) => part.length > 0).join(' ・ ')}
                </p>
                {profile.appearance.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">{profile.appearance}</p>
                )}
              </button>

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDraft({ ...profile })}
                  className="text-xs text-slate-400 underline"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => update(removeDetective(store, profile.id))}
                  className="text-xs text-slate-600 underline"
                >
                  削除
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => setDraft(emptyDraft())}
        className="rounded-lg border border-slate-700 py-2 text-sm text-slate-300"
      >
        ＋ 新しい探偵をつくる
      </button>

      <button
        type="button"
        onClick={() => onDecided(selected === undefined ? undefined : toDetective(selected))}
        disabled={selected === undefined}
        className="rounded-lg bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {selected === undefined ? '探偵を選んでください' : `${selected.name} で事件に向かう`}
      </button>

      <button
        type="button"
        onClick={() => {
          update(clearActiveDetective(store))
          onDecided(undefined)
        }}
        className="text-sm text-slate-400 underline"
      >
        名乗らずに始める
      </button>

      <button type="button" onClick={onBack} className="text-xs text-slate-600 underline">
        シナリオを選び直す
      </button>
    </div>
  )
}
