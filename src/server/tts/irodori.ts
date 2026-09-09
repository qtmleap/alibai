/**
 * Irodori-TTS へ台詞を投げて音声を受け取る。
 *
 * 仕様の正典は各デプロイの `/openapi.json`。この実装は `POST /synth` を持つ形に合わせてある。
 *
 * 声の指定は `speaker_id`（登録済み話者）と `caption`（自由記述）の排他。
 *
 * 【外に出す前に必ず外すこと】
 * いま使っているのは speaker_id のほう。登録話者は既存作品の登場人物で、しかも一体ずつに
 * 実在の声優名が紐づいている。開発中に声の付いた画を確かめるための仮配線であって、
 * このまま公開すると、本人の同意なく複製された声を配ることになる。
 * 公開に向かうときは caption 側（`voiceCaption` / `voiceSeed` の列）へ戻す。
 *
 * caption を使わない理由は品質のほう。**seed を固定しても、台詞が変わると別人の声になる。**
 * 同じ文・同じ seed なら出力はバイト単位で一致するので seed 自体は効いているが、
 * VoiceDesign モードでは文が変われば声色が動く。人物ごとに声を固定する用途には使えない。
 */

/** 突き合わせに要るのは id だけ。名前や年ごろは呼ぶ側が持っていればよい。 */
export type Speaker = { id: string }

/**
 * 探偵の声。話者は「橘シェリー」（CV 柊優花）で固定。
 *
 * 人物と違って探偵は `characters` に行を持たないので、年ごろと性別で絞る道が無い。
 * プレイヤーが名前を決める役なので、選ばせる仕組みも要らない——一体に決め打つ。
 * 遺体や現場を調べたときの所見も、探偵が見たものなのでこの声で読む。
 *
 * 備え付けの探偵（src/client/lib/detective-store.ts の TACHIBANA_SHERRY）は
 * この話者と同じ人物にしてあるので、名前と声が揃う。ただし自分で作った探偵を
 * 選んでも声はこのままで、そこは揃わない。
 *
 * 上の但し書きと同じ扱い。公開に向かうときは TACHIBANA_SHERRY と一緒に落とす。
 */
export const DETECTIVE_SPEAKER_ID = '64cbf822-f7ee-525f-8d2f-8ad7a89664e8'

/**
 * 候補の中から一体を決める。
 *
 * UUIDから引くので、同じ人物には毎回同じ声が当たる。候補の並びが変わらない限り、
 * 話者一覧に追加があっても既存の割り当ては動かない——ただし候補が増減すれば動く。
 * 開発中の足場なので、そこまでの安定は求めていない。
 */
export const speakerFor = <T extends Speaker>(
  candidates: T[],
  characterId: string,
): T | undefined => {
  if (candidates.length === 0) {
    return undefined
  }

  const digest = Array.from(characterId).reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) % 1e9,
    7,
  )

  return candidates[digest % candidates.length]
}

/**
 * 事件に出る人物へ、まとめて声を配る。
 *
 * 一人ずつ独立に決めると、年ごろと性別が同じ二人に同じ声が当たることがある。
 * 同じ事件のなかで声が重なると、誰が喋っているのか耳では分からなくなる——
 * 名前が見えている画面でも、聞いているあいだは声が人物の見分けになっている。
 *
 * `tiers` は望ましい順に並べた候補の束。先の束に空きがあるあいだはそこから取り、
 * 尽きたら次の束へ落ちる。年ごろまで合う声が一体しか居ない組（senior は男女とも
 * 一体ずつ）で二人目が来たとき、重ねるのではなく年ごろを譲るための段。
 *
 * 配る順はIDの昇順。登場順ではないのは、並びの根拠をこの関数の中だけで完結させるため
 * （呼ぶ側が順番を間違えると、人物ごとに違う声が返る関数になってしまう）。
 * どの束にも空きが無くなったら重なりを許す——声が出ないより、二人が似ているほうが
 * まだ遊べる。
 */
export const assignSpeakers = <T extends Speaker>(
  people: { id: string; tiers: T[][] }[],
): Map<string, T> =>
  [...people]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .reduce(
      (acc, person) => {
        const open = person.tiers.find((tier) =>
          tier.some((candidate) => !acc.taken.has(candidate.id)),
        )
        const pool =
          open === undefined
            ? person.tiers.flat()
            : open.filter((candidate) => !acc.taken.has(candidate.id))
        const picked = speakerFor(pool, person.id)

        if (picked === undefined) {
          return acc
        }

        acc.taken.add(picked.id)
        acc.byPerson.set(person.id, picked)

        return acc
      },
      { taken: new Set<string>(), byPerson: new Map<string, T>() },
    ).byPerson

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
