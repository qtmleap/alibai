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
  upsertDetective,
} from '@/client/lib/detective-store'
import type { Detective, ScenarioDetail } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  /**
   * 次へ進む合図だけを送る。選んだ探偵そのものは渡さない。
   * 選択は localStorage に書かれていて、支度の画面はそちらを読む。
   * 画面から画面へ手渡しにすると、URL を直接開かれた瞬間に行方不明になる。
   */
  onDecided: () => void
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
      <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-slate-950 px-5 py-6 text-slate-100">
        <header className="pt-2">
          <h1 className="text-xl font-bold">
            {draft.id === undefined ? '探偵をつくる' : '探偵を編集する'}
          </h1>
        </header>

        {/* 入力欄は枠で囲わず、下線だけで受ける。書く場所が分かれば充分。 */}
        <section className="flex flex-col gap-5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.3em] text-slate-600">名前</span>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              maxLength={40}
              placeholder="例：日下部 灯"
              className="border-b border-slate-800 bg-transparent py-2 text-sm focus:border-slate-600 focus:outline-none"
            />
          </label>

          <div className="flex gap-5">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[10px] tracking-[0.3em] text-slate-600">年齢</span>
              <input
                type="text"
                value={draft.age}
                onChange={(event) => updateDraft({ age: event.target.value })}
                maxLength={20}
                placeholder="28／30代／不詳"
                className="w-full border-b border-slate-800 bg-transparent py-2 text-sm focus:border-slate-600 focus:outline-none"
              />
            </label>

            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[10px] tracking-[0.3em] text-slate-600">性別</span>
              <input
                type="text"
                value={draft.gender}
                onChange={(event) => updateDraft({ gender: event.target.value })}
                maxLength={20}
                placeholder="自由に書けます"
                className="w-full border-b border-slate-800 bg-transparent py-2 text-sm focus:border-slate-600 focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] tracking-[0.3em] text-slate-600">容姿</span>
            <textarea
              value={draft.appearance}
              onChange={(event) => updateDraft({ appearance: event.target.value })}
              maxLength={200}
              rows={3}
              placeholder="例：くたびれたコートを着た長身。目つきが鋭く、口数は少ない。"
              className="resize-none border border-slate-800 bg-transparent px-3 py-2 text-sm leading-relaxed focus:border-slate-600 focus:outline-none"
            />
          </label>
        </section>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={!canSave}
          className="mt-auto border border-slate-600 py-3 text-sm font-semibold tracking-widest text-slate-100 disabled:opacity-40"
        >
          保存する
        </button>

        <button
          type="button"
          onClick={() => setDraft(undefined)}
          className="text-xs text-slate-600 underline"
        >
          やめる
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-slate-950 px-5 py-6 text-slate-100">
      <header className="pt-2">
        <p className="text-xs tracking-widest text-slate-500">これから調べる事件</p>
        <h1 className="mt-1 text-xl font-bold">{scenario.title}</h1>
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

      {/*
        探偵は箱に入れず行として並べる。選ばれている一人は左の罫と文字の明るさで示す。
        「選択中」の札を貼るより、並びの中で一人だけ明るいほうが早く見つかる。
      */}
      <ul className="flex flex-col border-t border-slate-800">
        {store.profiles.map((profile) => {
          const isActive = profile.id === store.activeId

          return (
            <li
              key={profile.id}
              className={
                isActive
                  ? 'border-b border-slate-800 border-l-2 border-l-indigo-500 py-3 pl-3'
                  : 'border-b border-slate-800 py-3 pl-3'
              }
            >
              <button
                type="button"
                onClick={() => update(setActiveDetective(store, profile.id))}
                className="w-full text-left"
              >
                <span
                  className={
                    isActive ? 'font-semibold text-slate-100' : 'font-semibold text-slate-400'
                  }
                >
                  {profile.name}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {[profile.age, profile.gender].filter((part) => part.length > 0).join(' ・ ')}
                </span>
                {profile.appearance.length > 0 && (
                  <span className="mt-1 block text-xs text-slate-600">{profile.appearance}</span>
                )}
              </button>

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDraft({ ...profile })}
                  className="text-xs text-slate-500 underline"
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
        className="self-start text-xs tracking-widest text-slate-500 underline"
      >
        ＋ 新しい探偵をつくる
      </button>

      <button
        type="button"
        onClick={onDecided}
        disabled={selected === undefined}
        className="mt-auto border border-slate-600 py-3 text-sm font-semibold tracking-widest text-slate-100 disabled:opacity-40"
      >
        {selected === undefined ? '探偵を選んでください' : `${selected.name} で事件に向かう`}
      </button>

      <button
        type="button"
        onClick={() => {
          update(clearActiveDetective(store))
          onDecided()
        }}
        className="text-xs text-slate-500 underline"
      >
        名乗らずに始める
      </button>

      <button type="button" onClick={onBack} className="text-xs text-slate-600 underline">
        シナリオを選び直す
      </button>
    </div>
  )
}
