import { useEffect, useRef, useState } from 'react'
import { loadVoiceSetting } from '@/client/lib/voice'

/**
 * 声が付かない行の間。
 *
 * 返答は文の単位で届くが、モデルが速いと二文がほぼ同時に着地して、
 * 読んでいる最中に次が積まれる。届いた順はそのままに、通す間隔にだけ下限を設ける。
 */
const SILENT_INTERVAL_MS = 800

/**
 * `shown` は画面に出してよい行数、`spoken` は読み終わった行数。
 *
 * 二つ持つのは、**読んでいる行が画面に出ている**ようにするため。出す前に鳴らすと、
 * まだ無い行を読み上げることになる。順は「出す → 読む → 次を出す」で、
 * 読んでいる最中は `shown === spoken + 1`——最後に出た一行がいま読まれている行。
 */
type State = { shown: number; spoken: number; armed: boolean }

/**
 * 鳴らせる形にして返す。取れなければ undefined——呼ぶ側は時間送りへ落とす。
 *
 * Blob に落としてから要素を作る。URL を要素に渡して読み込ませると、失敗を
 * `error` イベントで待つことになり、待ちの管理がもう一つ増える。ここで待てば
 * 「取れた／取れない」が返り値だけで決まる。
 */
const load = async (url: string): Promise<HTMLAudioElement | undefined> => {
  try {
    const response = await fetch(url)

    return response.ok ? new Audio(URL.createObjectURL(await response.blob())) : undefined
  } catch {
    return undefined
  }
}

/**
 * 積まれた行を、読み上げに合わせて一つずつ通す。
 * 返すのは「今いくつまで出してよいか」と「まだ読んでいる最中か」。
 *
 * 一行を出して読み上げ、読み終わってから次の行を出す。声の付かない行——書いている途中、
 * 記録に失敗した行、読み上げを切っているとき、合成に失敗したとき——は
 * これまで通り一定の間で通す。**声が出ないことで会話が止まらない**のが要点で、
 * どの失敗も時間送りへ落ちる。
 *
 * 間を置くのは `live`（返答が流れている）あいだに増えた分だけ。履歴の読み込みや
 * 画面の復帰で一気に増えたときは全部そのまま出す——読み直しに間も声も要らない。
 * 流れ終わっても、溜まっているぶんは間を置いて出し切る。
 */
export const useVoicedReveal = (
  /**
   * 通す順に並んだ行の、音を取りに行く先。声が付かない行は undefined。
   *
   * 毎回作り直される配列なので、依存には入れない（入れると返答が伸びるたびに
   * 鳴っている途中の音が止まる）。読むのは行が入れ替わった瞬間だけなので、
   * 参照で持ち回る。
   */
  urls: (string | undefined)[],
  live: boolean,
): { shown: number; speaking: boolean } => {
  const total = urls.length
  const [state, setState] = useState<State>({ shown: total, spoken: total, armed: false })
  /*
   * 読み上げの入切は聞き始めに一度だけ見る。行ごとに localStorage を読むと、
   * 一行ごとに同期の読み取りが挟まる（`useReadOut` の打鍵音と同じ理由）。
   */
  const [voiceOn] = useState(() => loadVoiceSetting() === 'on')
  const urlsRef = useRef(urls)
  urlsRef.current = urls
  /**
   * 合成を頼んである音。宛先ごとに1つ。
   *
   * 合成には一行あたり数秒かかるので、順番が来てから頼むと、行と行のあいだが
   * そのぶん空く。鳴らす順を待たずに、宛先が分かった端から並行で頼んでおく。
   *
   * 読み終えても表からは落とさない。落とすと、次の行が届いて頼み直すときに
   * 読み終えた行まで作り直してしまう。音そのもの（blob）は鳴らし終えた時点で
   * 手放すので、残るのは空になった要素だけ。
   */
  const pending = useRef(new Map<string, Promise<HTMLAudioElement | undefined>>())
  /** いま鳴っているもの。画面を離れるときに止める。 */
  const playing = useRef<HTMLAudioElement | undefined>(undefined)

  /*
    宛先が分かった端から合成を頼む。宛先が立つのはサーバが発言を記録した時点なので、
    探偵の質問を読んでいるあいだに返答の合成が進む。
  */
  const known = urls.join('|')

  useEffect(() => {
    if (!voiceOn) {
      return
    }

    // 声の付かない行はここで空になる。宛先に区切りの字は入らない（問い合わせは ?line=N）。
    for (const url of known.split('|')) {
      if (url.length > 0 && !pending.current.has(url)) {
        pending.current.set(url, load(url))
      }
    }
  }, [known, voiceOn])

  /* 読み切らずに離れたぶん。blob は明示的に手放さないと残る。 */
  useEffect(() => {
    const held = pending.current

    return () => {
      for (const audio of held.values()) {
        void audio.then((element) => {
          if (element !== undefined) {
            URL.revokeObjectURL(element.src)
          }
        })
      }

      held.clear()
    }
  }, [])

  /*
    次の一行を出す。訊いた瞬間に「間を置く相手」になり、読み終えてこちらの番に
    戻ったら外れる。外れているあいだは届いたぶんをそのまま出す。

    出すのは前の行を読み終えてから（`shown === spoken`）。読んでいる最中に
    次を出すと、読み上げより先に字が進む。
  */
  useEffect(() => {
    if (live && !state.armed) {
      setState({ shown: state.shown, spoken: state.spoken, armed: true })

      return
    }

    if (!state.armed) {
      if (state.shown !== total || state.spoken !== total) {
        setState({ shown: total, spoken: total, armed: false })
      }

      return
    }

    if (state.spoken >= total && !live) {
      setState({ shown: state.shown, spoken: state.spoken, armed: false })

      return
    }

    if (state.shown === state.spoken && state.shown < total) {
      setState({ shown: state.shown + 1, spoken: state.spoken, armed: true })
    }
  }, [total, live, state])

  /** いま読んでいる最中か。出ているのに読み終わっていない行があるあいだ。 */
  const reading = state.armed && state.spoken < state.shown

  /*
    出ている一行を読み上げる。依存に total を入れないのは、返答が伸びるたびに
    作り直されると、鳴っている途中の音が止まって頭から鳴り直すため。
  */
  useEffect(() => {
    if (!reading) {
      return
    }

    const url = urlsRef.current[state.spoken]
    const cancelled = { value: false }
    /*
      畳んだ後は進めない。鳴らし終える前に離れた回に、要素へ残った ended が
      後から届いて、もう居ない行の位置を立て直すのを防ぐ。
    */
    const done = () => {
      if (!cancelled.value) {
        setState((prev) => ({ shown: prev.shown, spoken: prev.spoken + 1, armed: prev.armed }))
      }
    }

    if (!voiceOn || url === undefined) {
      const timer = setTimeout(done, SILENT_INTERVAL_MS)

      return () => clearTimeout(timer)
    }

    // 先に頼んである音。まだ頼んでいなければ（切から入に変わった直後など）ここで頼む。
    const requested = pending.current.get(url)
    const audio = requested === undefined ? load(url) : requested

    void audio.then((element) => {
      if (cancelled.value) {
        return
      }

      // 取れなかった・鳴らせなかったときは待たずに次へ。無音のまま止まるより出す。
      if (element === undefined) {
        done()

        return
      }

      playing.current = element
      element.addEventListener('ended', done, { once: true })
      element.addEventListener('error', done, { once: true })
      void element.play().catch(done)
    })

    return () => {
      cancelled.value = true

      const element = playing.current

      if (element !== undefined) {
        element.pause()
        // 音は行ごとに使い捨て。放っておくと、聞き込みのあいだ blob が積み上がる。
        URL.revokeObjectURL(element.src)
        playing.current = undefined
      }
    }
  }, [reading, state.spoken, voiceOn])

  return { shown: state.shown, speaking: reading }
}
