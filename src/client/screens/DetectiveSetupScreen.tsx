import { useId, useState } from 'react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Textarea } from '@/client/components/ui/textarea'
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
import type { ScenarioDetail } from '@/client/lib/schemas'
import { playSe } from '@/client/lib/sound'
import {
  AGE_GROUP_LABELS,
  AGE_GROUP_NOTES,
  AGE_GROUPS,
  type AgeGroup,
  type Detective,
  describeDetective,
  GENDER_LABELS,
  GENDERS,
  type Gender,
} from '~/db/detective'

/**
 * 節の見出しと欄の名前。等幅なのは書式であって時刻ではないので、値には使わない。
 * display は呼び出し側で決める——「探偵」の見出しは机だけに出すが、他は常に出すため。
 */
const LEGEND =
  'font-mono text-[9.5px] leading-[1.75] tracking-[0.24em] text-nezumi-dim lg:text-[10px]'

type Props = {
  scenario: ScenarioDetail
  /**
   * 次へ進む合図だけを送る。選んだ探偵そのものは渡さない。
   * 選択は localStorage に書かれていて、支度の画面はそちらを読む。
   * 画面から画面へ手渡しにすると、URL を直接開かれた瞬間に行方不明になる。
   */
  onDecided: () => void
  onBack: () => void
  /**
   * 保管庫の読み出し。差し替え可能にしてあるのは、通信を伴わずに画面を確かめられるように
   * するため（SettingsScreen の readSettings と同じ流儀）。
   */
  readStore?: () => DetectiveStore
  /**
   * フォームを開いた状態から始める。story が「つくる」「編集する」をクリックなしで
   * 見せるためのもので、実際の遷移は画面内のボタンでしか起きない。
   */
  initialDraft?: Draft
}

/** 編集中のフォーム。新規作成なら id は未発行。 */
export type Draft = { id: string | undefined } & Detective

/** 「不詳」から始める。年ごろも性別も、決めていないなら決めないまま遊べる（NPCは年齢を決めつけない）。 */
export const emptyDraft = (): Draft => ({
  id: undefined,
  name: '',
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
 *
 * 机の上では左右に割る。左は名簿（支度の画面のアリバイ表と同じ幅の取り決めで、
 * --work-w の 628px を右に固定する）、右は選んだ探偵の姿見か、つくる／編集するの用紙。
 * 端末では割れないので、名簿とフォームを同じ場所に入れ替えて出す
 * ——このとき姿見は出番が無い（選んだ相手は一覧の中で分かるので、端末では改めて見せない）。
 */
export const DetectiveSetupScreen = ({
  scenario,
  onDecided,
  onBack,
  readStore = loadDetectiveStore,
  initialDraft,
}: Props) => {
  const nameId = useId()
  const appearanceId = useId()
  const [store, setStore] = useState<DetectiveStore>(readStore)
  const [draft, setDraft] = useState<Draft | undefined>(initialDraft)

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
  const canSave = draft !== undefined && draft.name.trim().length > 0
  // 名簿は端末では draft が無いあいだだけ、机では常に見せる。
  const rosterVisibleOnPhone = draft === undefined

  return (
    <div className="screen-enter mx-auto flex min-h-dvh-safe max-w-md flex-col bg-sumi text-kinari lg:mx-0 lg:grid lg:h-dvh-safe lg:max-w-none lg:grid-cols-[1fr_628px] lg:gap-0 lg:overflow-hidden">
      {/* ---- 左：名簿 ---- */}
      <div
        className={`${rosterVisibleOnPhone ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col px-[18px] pt-[26px] pb-6 lg:flex lg:flex-none lg:overflow-y-auto lg:border-keisen lg:border-r lg:px-0 lg:py-0 lg:pt-[34px] lg:pr-[34px] lg:pb-[26px] lg:pl-[22px]`}
      >
        <button
          type="button"
          onClick={onBack}
          className="hidden text-left lg:block lg:text-[12.5px] lg:text-nezumi"
        >
          ←　シナリオを選び直す
        </button>

        <header className="lg:mt-[22px] lg:border-keisen lg:border-b lg:pb-[18px]">
          <h1 className="font-bold font-mincho text-[19px] leading-[1.55] tracking-[0.05em] lg:text-[26px] lg:leading-[1.45]">
            {scenario.title}
          </h1>
          <p className="mt-[7px] text-[11.5px] text-nezumi leading-[1.8] lg:mt-2.5 lg:max-w-[42em] lg:text-[13px] lg:leading-[1.9]">
            誰として、この事件を調べますか。
            <br />
            選んだ人物像は聞き込みの相手にも伝わり、呼びかけ方や態度が変わります。
          </p>
        </header>

        <div className="mt-4 flex flex-col gap-4 lg:mt-6 lg:block lg:gap-0">
          <span className={`hidden lg:block lg:pb-[7px] ${LEGEND}`}>探偵</span>

          {store.profiles.length === 0 ? (
            <p className="text-[11px] text-nezumi-dim leading-[1.7] lg:text-[11.5px]">
              まだ探偵がいません。作るか、名乗らずに始めることもできます。
            </p>
          ) : (
            <ul className="flex flex-col border-keisen border-t">
              {store.profiles.map((profile) => {
                const isActive = profile.id === store.activeId

                return (
                  <li
                    key={profile.id}
                    className={`flex items-start gap-[10px] border-keisen border-b py-[7px] pl-3 lg:gap-3 lg:py-[10px] lg:pl-[14px] ${
                      isActive ? 'shadow-[inset_2px_0_0_var(--color-kinari)]' : ''
                    }`}
                  >
                    {/*
                      行そのものが押す場所なので、ここは素のボタンのまま。名前と説明を
                      積む形は Button の一行に詰める組みとは噛み合わない。
                    */}
                    <button
                      type="button"
                      onClick={() => update(setActiveDetective(store, profile.id))}
                      className="flex min-w-0 flex-1 flex-col text-left"
                    >
                      <span
                        className={`text-[13px] leading-[1.75] lg:text-[13.5px] lg:leading-[1.5] ${
                          isActive ? 'text-kinari' : 'text-nezumi'
                        }`}
                      >
                        {profile.name}
                      </span>
                      <span className="text-[10.5px] text-nezumi-dim leading-[1.6] lg:text-[11.5px]">
                        {describeDetective(profile)}
                      </span>
                      {profile.appearance.length > 0 && (
                        <span className="text-[10.5px] text-nezumi-dim leading-[1.6] lg:text-[11.5px]">
                          {profile.appearance}
                        </span>
                      )}
                    </button>

                    {/* 消すほうは一段沈める。並べて置くと押し間違える。 */}
                    <div className="mt-0.5 ml-auto flex flex-none gap-3 lg:gap-[14px]">
                      <button
                        type="button"
                        onClick={() => setDraft({ ...profile })}
                        className="text-[11px] text-nezumi lg:text-[11.5px]"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => update(removeDetective(store, profile.id))}
                        className="text-[11px] text-nezumi-dim lg:text-[11.5px]"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className="self-start text-[12px] text-nezumi tracking-[0.06em] lg:mt-[14px] lg:text-[12.5px] lg:tracking-[0.08em]"
          >
            ＋ 新しい探偵をつくる
          </button>
        </div>

        <div className="mt-auto pt-[22px]">
          <button
            type="button"
            onClick={goToCase}
            disabled={selected === undefined}
            className={`block w-full border py-[13px] text-center font-mincho text-[14px] tracking-[0.2em] lg:py-[13px] lg:text-[15px] ${
              selected === undefined ? 'border-keisen text-nezumi-dim' : 'border-nezumi text-kinari'
            }`}
          >
            {selected === undefined ? '探偵を選んでください' : `${selected.name} で事件に向かう`}
          </button>
          <button
            type="button"
            onClick={() => {
              update(clearActiveDetective(store))
              goToCase()
            }}
            className="mt-[11px] block w-full text-center text-[11.5px] text-nezumi lg:text-[12px] lg:text-nezumi-dim"
          >
            名乗らずに始める
          </button>
          {/* 机の上ではこの導線は上の「←　シナリオを選び直す」が兼ねる。 */}
          <button
            type="button"
            onClick={onBack}
            className="mt-[11px] block w-full text-center text-[11.5px] text-nezumi-dim lg:hidden"
          >
            シナリオを選び直す
          </button>
        </div>
      </div>

      {/* ---- 右：姿見、またはつくる／編集するの用紙 ---- */}
      <div
        className={`${rosterVisibleOnPhone ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col px-[18px] pt-[26px] pb-6 lg:flex lg:overflow-y-auto lg:px-[34px] lg:pt-[34px] lg:pb-[26px] ${
          draft === undefined ? 'lg:justify-center' : ''
        }`}
      >
        {draft === undefined ? (
          selected === undefined ? (
            <p className="hidden text-[11.5px] text-nezumi-dim leading-[1.7] lg:block">
              探偵を作ると、ここにその人の姿が出ます。
            </p>
          ) : (
            <div className="hidden lg:block">
              <span className={`block ${LEGEND}`}>この人として調べます</span>
              <div className="mt-[10px] font-bold font-mincho text-[24px] leading-[1.5] tracking-[0.06em]">
                {selected.name}
              </div>
              <div className="mt-1 text-[12.5px] text-nezumi">{describeDetective(selected)}</div>
              <p
                className={`mt-[18px] max-w-[34em] border-keisen border-t pt-4 text-[13px] leading-[2] ${
                  selected.appearance.length > 0 ? 'text-nezumi' : 'text-nezumi-dim'
                }`}
              >
                {selected.appearance.length > 0 ? selected.appearance : '容姿は書かれていません。'}
              </p>
              <button
                type="button"
                onClick={() => setDraft({ ...selected })}
                className="mt-5 block text-[12.5px] text-nezumi"
              >
                この探偵を編集する
              </button>
            </div>
          )
        ) : (
          <>
            <h2 className="font-bold font-mincho text-[19px] leading-[1.55] tracking-[0.05em] lg:text-[20px] lg:leading-[1.8] lg:tracking-[0.08em]">
              {draft.id === undefined ? '探偵をつくる' : '探偵を編集する'}
            </h2>

            {/* 入力欄は枠で囲わず下線だけで受ける（Input が持っている）。書く場所が分かれば充分。 */}
            <div className="mt-5 flex flex-col gap-5 lg:mt-6 lg:gap-6">
              <label className="flex flex-col gap-1" htmlFor={nameId}>
                <span className={`block ${LEGEND}`}>名前</span>
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
                <legend className={LEGEND}>年ごろ</legend>
                <AgeChoices
                  value={draft.ageGroup}
                  onChange={(ageGroup) => updateDraft({ ageGroup })}
                />
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className={LEGEND}>性別</legend>
                <GenderChoices
                  value={draft.gender}
                  onChange={(gender) => updateDraft({ gender })}
                />
              </fieldset>

              <label className="flex flex-col gap-1" htmlFor={appearanceId}>
                <span className={`block ${LEGEND}`}>容姿</span>
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
            </div>

            <div className="mt-auto pt-6">
              <Button size="block" onClick={handleSaveDraft} disabled={!canSave}>
                保存する
              </Button>
              {!canSave && (
                <p className="mt-2 text-center text-[11.5px] text-nezumi-dim">
                  名前が決まると保存できます。
                </p>
              )}
              {/* やめるは枠を持たせない——保存が沈んでいるあいだ、枠つきの取り消しが主役に見えてしまう。 */}
              <button
                type="button"
                onClick={() => setDraft(undefined)}
                className="mt-[11px] block w-full text-center text-[12px] text-nezumi-dim"
              >
                やめる
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** 二択・多択の選び方は SettingsScreen の ChoiceRow と同じ組み——塗らず、選んだものだけ罫線と字を起こす。 */
const AgeChoices = ({
  value,
  onChange,
}: {
  value: AgeGroup
  onChange: (next: AgeGroup) => void
}) => (
  <div className="flex flex-wrap gap-x-[18px] lg:gap-x-6 lg:gap-y-2.5">
    {AGE_GROUPS.map((ageGroup) => (
      <button
        key={ageGroup}
        type="button"
        aria-pressed={ageGroup === value}
        onClick={() => onChange(ageGroup)}
        className={`border-b py-[6px] text-[11.5px] lg:py-2 lg:text-[12.5px] ${
          ageGroup === value ? 'border-kinari text-kinari' : 'border-keisen text-nezumi-dim'
        }`}
      >
        {AGE_GROUP_LABELS[ageGroup]}
        <span className="ml-1.5 text-[9.5px] lg:ml-2 lg:text-[10px]">
          {AGE_GROUP_NOTES[ageGroup]}
        </span>
      </button>
    ))}
  </div>
)

const GenderChoices = ({
  value,
  onChange,
}: {
  value: Gender
  onChange: (next: Gender) => void
}) => (
  <div className="flex">
    {GENDERS.map((gender) => (
      <button
        key={gender}
        type="button"
        aria-pressed={gender === value}
        onClick={() => onChange(gender)}
        className={`flex-1 border-b py-[7px] text-center text-[11.5px] lg:py-[9px] lg:text-[12.5px] ${
          gender === value ? 'border-kinari text-kinari' : 'border-keisen text-nezumi-dim'
        }`}
      >
        {GENDER_LABELS[gender]}
      </button>
    ))}
  </div>
)
