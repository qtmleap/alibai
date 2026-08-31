import { z } from 'zod'

/**
 * 場面の効果音。
 *
 * 音源は public/se/ に置く（実体は追跡していない。`bun run se:fetch` で取得する）。
 * 出典は効果音ラボ。規約で直リンクが禁じられているので、実行時に向こうを参照しない。
 *
 * ライブラリは入れない。ここで要るのは一発ものを数種類鳴らすことだけで、
 * オーディオスプライトも、ループも、BGMのクロスフェードも無い。
 * その日が来たら howler なりを検討する。
 */

const STORAGE_KEY = 'alibai:sound'
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

/** 鳴らす場面。ファイル名ではなく場面で呼ぶので、差し替えがここだけで済む。 */
export type Se = 'challenge' | 'stage' | 'turn' | 'decide' | 'solved'

/**
 * 音量は素材ごとに違う。1つの係数では揃わないので、素材ごとの値を持つ。
 * どれも控えめなのは、この画面が罫線と余白で持たせる作りで、音だけ前に出ると浮くため。
 *
 * 明るい音は使わない。和太鼓や電子的なジングルはこの事件の温度に合わない
 * ——扉の軋みと鐘で、暗さのほうへ寄せてある。
 *
 * turn は 1.6 秒（TurnAnnounce の表示時間）に収まる長さから選ぶこと。
 * はみ出すと、暗転が明けたあとも音だけが会話に残る。
 */
const SOURCES: Record<Se, { file: string; volume: number }> = {
  challenge: { file: 'text-impact1', volume: 0.45 },
  stage: { file: 'door-old-open1', volume: 0.45 },
  turn: { file: 'iron-door-close1', volume: 0.4 },
  decide: { file: 'decision23', volume: 0.35 },
  solved: { file: 'temple-bell1', volume: 0.4 },
}

/**
 * 鳴らした音は使い回す。毎回 new すると、そのたびに取りに行った上に
 * 参照の切れた要素が再生中のまま残る。
 */
const players = new Map<Se, HTMLAudioElement>()

const playerFor = (se: Se): HTMLAudioElement | undefined => {
  const cached = players.get(se)

  if (cached !== undefined) {
    return cached
  }

  const source = SOURCES[se]

  try {
    const audio = new Audio(`/se/${source.file}.mp3`)
    audio.preload = 'auto'
    audio.volume = source.volume
    players.set(se, audio)

    return audio
  } catch {
    // Audio が無い環境。音が出ないだけで、プレイは続けられる。
    return undefined
  }
}

/**
 * 1回鳴らす。
 *
 * ブラウザは操作の無い再生を止める。ここでは弾かれても握り潰す——
 * 音が出ないことより、例外でその場の処理が止まるほうが困る。
 * （iOS では画面に入った瞬間の音が鳴らないことがある。curtain がそれに当たる。）
 */
export const playSe = (se: Se): void => {
  if (loadSoundSetting() === 'off') {
    return
  }

  const audio = playerFor(se)

  if (audio === undefined) {
    return
  }

  try {
    // 前の再生が残っていても頭から鳴らす。連打したときに無音にならない。
    audio.currentTime = 0
    void audio.play().catch(() => undefined)
  } catch {
    // 同上。
  }
}
