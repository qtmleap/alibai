/**
 * Irodori-TTS へ台詞を投げて音声を受け取る。
 *
 * OpenAI互換の `POST /audio/speech` を使う。baseUrl は `/v1` まで含める。
 * 宛先はLLMと同じ互換サーバで、読み上げ専用の接続先は持たない（`OPENAI_URL`）。
 * 登録済み話者のIDは `voice` に載せ、モデルは上流で有効なIDを呼び出し側が指定する。
 *
 * 【外に出す前に必ず外すこと】
 * いま使っているのは登録話者のほう。登録話者は既存作品の登場人物で、しかも一体ずつに
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
 * 呼び出しごとの設定。認証情報をDBの話者データやクライアントへ混ぜない。
 * `/audio/speech` は今のところ鍵を要らないが、有れば載せる——LLMと同じサーバなので
 * 後から認証が入ったときに、ここだけ 401 で黙ることにならない。
 */
export type SpeechOptions = {
  model: string
  apiKey?: string
  signal?: AbortSignal
}

/**
 * 上流の応答をそのまま返す。本文を isolate に溜めないのは、48kHz の wav が
 * 短い台詞でも数百KBあり、同時に喋る人数だけ積み上がるため。
 *
 * HTTPエラーは応答のまま返す。通信例外とキャンセルはrejectするので、
 * 呼び出し側で音声だけの失敗に変換する。本文や認証情報をエラーとして公開しない。
 */
export const synthesize = async (
  baseUrl: string,
  text: string,
  voice: Voice,
  options: SpeechOptions,
): Promise<Response> =>
  fetch(`${baseUrl.replace(/\/+$/, '')}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/wav',
      ...(options.apiKey === undefined || options.apiKey === ''
        ? {}
        : { Authorization: `Bearer ${options.apiKey}` }),
    },
    body: JSON.stringify({
      model: options.model,
      input: text,
      voice: voice.speakerId,
      response_format: 'wav',
    }),
    signal: options.signal,
    /*
      鍵を載せたまま転送先を追わない。`error` ではなく `manual` なのは、workerd の
      fetch が `error` を受け取ると即座に投げるため——呼び出し側から見ると通信断と
      区別が付かず、502 に畳まれて原因が見えなくなる。`manual` なら 3xx がそのまま
      応答として返り、`ok` が false になって同じ扱いに落ちる。
    */
    redirect: 'manual',
  })
