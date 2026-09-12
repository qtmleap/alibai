import { z } from 'zod'

/**
 * 聞き込みの読み上げ。
 *
 * 効果音（`sound.ts`）とは別に持つ。あちらは打鍵と場面の音で、こちらは人の声。
 * 声だけ切りたい人と、音だけ切りたい人が別々に居る。
 *
 * 切ってあるあいだ、会話は読み上げが無かった頃と同じ時間送りで出る。
 */

const STORAGE_KEY = 'alibai:voice'
const voiceSettingSchema = z.enum(['on', 'off'])

export type VoiceSetting = z.infer<typeof voiceSettingSchema>

export const DEFAULT_VOICE: VoiceSetting = 'on'

export const loadVoiceSetting = (): VoiceSetting => {
  try {
    const parsed = voiceSettingSchema.safeParse(localStorage.getItem(STORAGE_KEY))

    return parsed.success ? parsed.data : DEFAULT_VOICE
  } catch {
    return DEFAULT_VOICE
  }
}

export const saveVoiceSetting = (setting: VoiceSetting): void => {
  try {
    localStorage.setItem(STORAGE_KEY, setting)
  } catch {
    // 保存できなくても今回のプレイには影響しない。
  }
}
