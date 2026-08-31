import { useId, useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Textarea } from '@/client/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/client/components/ui/toggle-group'
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
import { playSe } from '@/client/lib/sound'
import {
  AGE_GROUP_LABELS,
  AGE_GROUP_NOTES,
  AGE_GROUPS,
  describeDetective,
  GENDER_LABELS,
  GENDERS,
} from '~/db/detective'

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
  // 「不詳」から始める。年ごろも性別も、決めていないなら決めないまま遊べる
  // （NPCは年齢を決めつけない呼びかけに寄る）。
  ageGroup: 'unknown',
  gender: 'unknown',
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
  const nameId = useId()
  const appearanceId = useId()
  const [store, setStore] = useState<DetectiveStore>(loadDetectiveStore)
  const [draft, setDraft] = useState<Draft | undefined>(undefined)

  const update = (next: DetectiveStore) => {
    saveDetectiveStore(next)
    setStore(next)
  }

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((current) => (current === undefined ? current : { ...current, ...patch }))

  /**
   * 事件へ向かう一押し。名乗って行く道と名乗らずに行く道の両方がここを通る。
   * 押した手の中で鳴るので、ブラウザの自動再生の制限にも掛からない。
   */
  const goToCase = () => {
    playSe('challenge')
    onDecided()
  }

  const handleSaveDraft = () => {
    if (draft === undefined) {
      return
    }

    const saved: StoredDetective = {
      id: draft.id === undefined ? newDetectiveId() : draft.id,
      name: draft.name,
      ageGroup: draft.ageGroup,
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
      <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-sumi px-5 py-6 text-kinari">
        <header className="pt-2">
          <h1 className="text-xl font-bold">
            {draft.id === undefined ? '探偵をつくる' : '探偵を編集する'}
          </h1>
        </header>

        {/* 入力欄は枠で囲わず下線だけで受ける（Input が持っている）。書く場所が分かれば充分。 */}
        <section className="flex flex-col gap-5">
          <label className="flex flex-col gap-1" htmlFor={nameId}>
            <span className="text-[10px] tracking-[0.3em] text-nezumi-dim">名前</span>
            <Input
              id={nameId}
              type="text"
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              maxLength={40}
              placeholder="例：日下部 灯"
            />
          </label>

          {/*
            年ごろと性別は選択肢に閉じている。自由記述だと「28」「三十路」と書き方が割れ、
            聞き込みの相手（NPC）が呼びかけを決められない。選ばせておけば、
            老人が十代の少女に「お嬢さん」と話しかけるところまで確実に効く。
          */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[10px] tracking-[0.3em] text-nezumi-dim">年ごろ</legend>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              value={draft.ageGroup}
              // 単一選択の ToggleGroup は、選択中をもう一度押すと空文字を返す。
              // 年ごろは必ずどれかである必要があるので、空は無視して選択を保つ。
              onValueChange={(value) => {
                const picked = AGE_GROUPS.find((option) => option === value)

                if (picked !== undefined) {
                  updateDraft({ ageGroup: picked })
                }
              }}
              className="flex-wrap"
            >
              {AGE_GROUPS.map((ageGroup) => (
                <ToggleGroupItem key={ageGroup} value={ageGroup} className="h-auto px-3 py-2">
                  {AGE_GROUP_LABELS[ageGroup]}
                  <span className="ml-1 text-[10px] text-nezumi-dim">
                    {AGE_GROUP_NOTES[ageGroup]}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[10px] tracking-[0.3em] text-nezumi-dim">性別</legend>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              value={draft.gender}
              onValueChange={(value) => {
                const picked = GENDERS.find((option) => option === value)

                if (picked !== undefined) {
                  updateDraft({ gender: picked })
                }
              }}
              className="flex-wrap"
            >
              {GENDERS.map((gender) => (
                <ToggleGroupItem key={gender} value={gender} className="h-auto px-3 py-2">
                  {GENDER_LABELS[gender]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <label className="flex flex-col gap-1" htmlFor={appearanceId}>
            <span className="text-[10px] tracking-[0.3em] text-nezumi-dim">容姿</span>
            {/* rows で決めた高さのまま置く。書くほどに欄が伸びると、下のボタンが逃げていく。 */}
            <Textarea
              id={appearanceId}
              value={draft.appearance}
              onChange={(event) => updateDraft({ appearance: event.target.value })}
              maxLength={200}
              rows={3}
              placeholder="例：くたびれたコートを着た長身。目つきが鋭く、口数は少ない。"
              className="field-sizing-fixed resize-none leading-relaxed"
            />
          </label>
        </section>

        <Button size="block" className="mt-auto" onClick={handleSaveDraft} disabled={!canSave}>
          保存する
        </Button>

        <Button
          variant="link"
          size="sm"
          className="text-nezumi-dim"
          onClick={() => setDraft(undefined)}
        >
          やめる
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-sumi px-5 py-6 text-kinari">
      <header className="pt-2">
        <h1 className="text-xl font-bold">{scenario.title}</h1>
        <p className="mt-3 text-sm text-nezumi">
          誰として、この事件を調べますか。
          <br />
          選んだ人物像は聞き込みの相手にも伝わり、呼びかけ方や態度が変わります。
        </p>
      </header>

      {store.profiles.length === 0 && (
        <p className="text-sm text-nezumi-dim">
          まだ探偵がいません。作るか、名乗らずに始めることもできます。
        </p>
      )}

      {/*
        探偵は箱に入れず行として並べる。選ばれている一人は左の罫と文字の明るさで示す。
        「選択中」の札を貼るより、並びの中で一人だけ明るいほうが早く見つかる。
      */}
      <ul className="flex flex-col border-t border-keisen">
        {store.profiles.map((profile) => {
          const isActive = profile.id === store.activeId

          return (
            <li
              key={profile.id}
              className={
                isActive
                  ? 'border-b border-keisen border-l-2 border-l-kinari py-3 pl-3'
                  : 'border-b border-keisen py-3 pl-3'
              }
            >
              {/*
                行そのものが押す場所なので、ここは素のボタンのまま。Button は中身を
                一行に詰める組み方をするので、名前と説明を積んだこの形とは噛み合わない。
              */}
              <button
                type="button"
                onClick={() => update(setActiveDetective(store, profile.id))}
                className="w-full text-left"
              >
                <span
                  className={isActive ? 'font-semibold text-kinari' : 'font-semibold text-nezumi'}
                >
                  {profile.name}
                </span>
                <span className="mt-1 block text-xs text-nezumi-dim">
                  {describeDetective(profile)}
                </span>
                {profile.appearance.length > 0 && (
                  <span className="mt-1 block text-xs text-nezumi-dim">{profile.appearance}</span>
                )}
              </button>

              <div className="mt-2 flex gap-3">
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  onClick={() => setDraft({ ...profile })}
                >
                  編集
                </Button>
                {/* 消すほうは一段沈める。並べて置くと押し間違える。 */}
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 text-nezumi-dim"
                  onClick={() => update(removeDetective(store, profile.id))}
                >
                  削除
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <Button
        variant="link"
        size="sm"
        className="self-start px-0 tracking-widest"
        onClick={() => setDraft(emptyDraft())}
      >
        ＋ 新しい探偵をつくる
      </Button>

      <Button size="block" className="mt-auto" onClick={goToCase} disabled={selected === undefined}>
        {selected === undefined ? '探偵を選んでください' : `${selected.name} で事件に向かう`}
      </Button>

      <Button
        variant="link"
        size="sm"
        onClick={() => {
          update(clearActiveDetective(store))
          goToCase()
        }}
      >
        名乗らずに始める
      </Button>

      {/* 前の画面へ戻るだけの口なので、名乗らずに始めるよりさらに沈める。 */}
      <Button variant="link" size="sm" className="text-nezumi-dim" onClick={onBack}>
        シナリオを選び直す
      </Button>
    </div>
  )
}
