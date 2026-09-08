/**
 * Irodori-TTS へ台詞を投げて音声を受け取る。
 *
 * 仕様の正典は各デプロイの `/openapi.json`。この実装は `POST /synth` を持つ形に合わせてある
 * （OpenAI 互換の `/v1/audio/speech` を出す別実装もあるので、向き先を変えるときは先に確認する）。
 *
 * 声の指定は `speaker_id`（登録済み話者）と `caption`（自由記述）の排他。ここは caption だけを
 * 使う。登録済み話者は既存作品のキャラクターで、権利の面でそのまま乗せられない。
 */

export type Voice = {
  /** 固定しないと台詞ごとに別人の声になる。 */
  seed: number
  /** 声質を書いた一文。場面ごとの感情はここへ足してから渡す。 */
  caption: string
}

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
    body: JSON.stringify({ text, caption: voice.caption, seed: voice.seed }),
  })
