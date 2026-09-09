import { z } from 'zod'

/**
 * Irodori-TTS へ台詞を投げて音声を受け取る。
 *
 * 仕様の正典は各デプロイの `/openapi.json`。この実装は `POST /synth` と `GET /speakers` を
 * 持つ形に合わせてある。
 *
 * 声の指定は `speaker_id`（登録済み話者）と `caption`（自由記述）の排他。
 *
 * 【外に出す前に必ず外すこと】
 * いま使っているのは speaker_id のほう。登録話者は既存作品の登場人物で、しかも一体ずつに
 * 実在の声優名（`cv`）が紐づいている。開発中に声の付いた画を確かめるための仮配線であって、
 * このまま公開すると、本人の同意なく複製された声を配ることになる。
 * 公開に向かうときは caption 側（`voiceCaption` / `voiceSeed` の列）へ戻す。
 */

export type Speaker = { uuid: string; name: string }

const speakerListSchema = z.object({
  speakers: z.array(z.object({ uuid: z.uuid(), name: z.string().nonempty() }).loose()),
})

/*
  話者一覧は動かないデータなので isolate に溜める。台詞1つごとに引き直すと、
  再生のたびに往復が1つ増える。シークレットではないので置いておいて差し支えない。
*/
const cached: { speakers: Speaker[] | undefined } = { speakers: undefined }

/** 登録話者の一覧。取れなければ空。 */
export const listSpeakers = async (baseUrl: string): Promise<Speaker[]> => {
  if (cached.speakers !== undefined) {
    return cached.speakers
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/speakers`, {
    headers: { Accept: 'application/json' },
  }).catch(() => undefined)

  if (response === undefined || !response.ok) {
    console.error('[tts] failed to list speakers', response?.status)

    return []
  }

  const parsed = speakerListSchema.safeParse(await response.json().catch(() => undefined))

  if (!parsed.success) {
    console.error('[tts] unexpected speaker list shape')

    return []
  }

  cached.speakers = parsed.data.speakers

  return cached.speakers
}

/**
 * キャラクターに話者を割り当てる。
 *
 * 一覧に性別も年齢も入っていないので、キャラクターの `gender` や `ageGroup` とは
 * 突き合わせられない。**声と人物像は噛み合わない**（女性NPCに男性の声が当たる）。
 * 仮配線として割り切っている点で、直すには話者側にその情報が要る。
 *
 * UUIDから引くので、同じ人物には毎回同じ声が当たる。確かめたいのはそこ。
 */
export const speakerFor = (speakers: Speaker[], characterId: string): Speaker | undefined => {
  if (speakers.length === 0) {
    return undefined
  }

  const digest = Array.from(characterId).reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) % 1e9,
    7,
  )

  return speakers[digest % speakers.length]
}

/** 登録話者で鳴らす。細かい調整は送らない——話者ごとの既定が上流にある。 */
export type Voice = { speakerId: string }

/**
 * 上流の応答をそのまま返す。本文を isolate に溜めないのは、48kHz の wav が
 * 短い台詞でも数百KBあり、同時に喋る人数だけ積み上がるため。
 *
 * 失敗しても throw しない。声が出ないことでプレイを止めたくないので、
 * 呼び出し側が「音は無し」として畳めるように応答をそのまま渡す。
 */
export const synthesize = async (baseUrl: string, text: string, voice: Voice): Promise<Response> =>
  fetch(`${baseUrl.replace(/\/+$/, '')}/synth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
    body: JSON.stringify({ text, speaker_id: voice.speakerId }),
  })
