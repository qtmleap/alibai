import { z } from 'zod'

/**
 * タイプライターの打鍵音。
 *
 * 音声ファイルは持たず Web Audio で合成する。数十ミリ秒のノイズを短く切るだけの音なので、
 * わざわざ素材を抱えてネットワークから取りに行く理由がない（依存もアセットも増えない）。
 *
 * ブラウザは操作なしの再生を止めるので、AudioContext は最初に鳴らす瞬間まで作らない。
 * この画面へはボタンを押して来るため、その時点では再生が許可されている。
 */

const STORAGE_KEY = 'alibai:typing-sound'
const soundSettingSchema = z.enum(['on', 'off'])

export type SoundSetting = z.infer<typeof soundSettingSchema>

export const DEFAULT_SOUND: SoundSetting = 'on'

export const loadSoundSetting = (): SoundSetting => {
  try {
    const parsed = soundSettingSchema.safeParse(localStorage.getItem(STORAGE_KEY))

    return parsed.success ? parsed.data : DEFAULT_SOUND
  } catch {
    return DEFAULT_SOUND
  }
}

export const saveSoundSetting = (setting: SoundSetting): void => {
  try {
    localStorage.setItem(STORAGE_KEY, setting)
  } catch {
    // 保存できなくても今回のプレイには影響しない。
  }
}

/**
 * この文字で音を鳴らすか。
 *
 * 空白や改行で鳴らすと、字が出ていないのに音だけ鳴って気持ち悪い。
 * 句読点は鳴らす（打鍵しているので）。
 */
export const shouldClick = (char: string): boolean => char.trim().length > 0

const NOISE_SECONDS = 0.03

/** AudioContext とノイズは使い回す。1文字ごとに作ると音が詰まったときに重い。 */
const audio: { context: AudioContext | undefined; noise: AudioBuffer | undefined } = {
  context: undefined,
  noise: undefined,
}

const ensureContext = (): AudioContext | undefined => {
  if (audio.context !== undefined) {
    return audio.context
  }

  try {
    const context = new AudioContext()
    const frames = Math.floor(context.sampleRate * NOISE_SECONDS)
    const buffer = context.createBuffer(1, frames, context.sampleRate)
    const channel = buffer.getChannelData(0)

    for (const index of channel.keys()) {
      channel[index] = Math.random() * 2 - 1
    }

    audio.context = context
    audio.noise = buffer

    return context
  } catch {
    // Web Audio が使えない環境。音が出ないだけで、読み進めることはできる。
    return undefined
  }
}

/**
 * 打鍵音を1回鳴らす。
 *
 * バンドパスで高域だけ残すと、ノイズが「カッ」という硬い音になる。
 * 再生速度を毎回わずかにずらすのは、同じ波形が並ぶと機械的に聞こえるため。
 */
export const playTypeClick = (): void => {
  const context = ensureContext()
  const noise = audio.noise

  if (context === undefined || noise === undefined) {
    return
  }

  // タブが背面から戻ったときなど、止まったままのことがある。
  if (context.state === 'suspended') {
    void context.resume()
  }

  const source = context.createBufferSource()
  source.buffer = noise
  source.playbackRate.value = 0.85 + Math.random() * 0.3

  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.8

  const gain = context.createGain()
  const now = context.currentTime
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + NOISE_SECONDS)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)
  source.start(now)
  source.stop(now + NOISE_SECONDS)
}
