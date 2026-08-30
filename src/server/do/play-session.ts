import { DurableObject } from 'cloudflare:workers'
import type { ModelMessage } from 'ai'
import { type DiscoveryState, mergeJudgementDiscoveryState } from '@/server/game/discovery-state'
import type { Detective } from '~/db/schema'

/**
 * 進行中のプレイセッションの状態。
 *
 * KV ではなく Durable Object を使う理由は整合性モデル。会話履歴も証拠の発見も
 * read-modify-write であり、結果整合で同一キーへの書き込みが 1秒に1回しか通らない KV では
 * エラーを出さないまま数が合わなくなる。DO は 1インスタンスへの操作が直列化されるので
 * その競合が原理的に起きない。
 *
 * ここはあくまで進行中の作業領域であって、正典は Postgres。
 * このオブジェクトが失われても復元できるよう、DB への書き出しは Worker 側が担当する。
 */

/** DO 自身はDBを触らないので、バインディングへの依存を持たない。 */
type SessionBindings = Record<string, unknown>

export type SessionSnapshot = {
  /** epoch ミリ秒。DO が生まれた瞬間 = セッション開始。 */
  startedAt: number
  /** プレイヤーが投げた質問の総数。 */
  questionCount: number
  /** 発見済み証拠のID。重複しない。 */
  discoveredEvidenceIds: string[]
  /** 解禁済みRevelationカードのID。重複しない。 */
  discoveredRevelationIds: string[]
  /** プレイヤーが矛盾を指摘できた回数 */
  contradictionCount: number
  /** NPCが嘘をついた回数。プレイヤーには見せず、リザルトの解析に使う */
  npcLiedCount: number
  /** プレイヤーが提出した推理。未提出なら undefined */
  accusedCharacterId: string | undefined
  accusationCorrect: boolean | undefined
  /** 終了済みかどうか。二重にリザルトを書かないための番人。 */
  finished: boolean
  /** 開始からの経過秒。呼び出し側が毎回計算しなくて済むように DO 側で出す */
  elapsedSeconds: number
}

type Meta = {
  startedAt: number
  questionCount: number
  contradictionCount: number
  npcLiedCount: number
  accusedCharacterId: string | undefined
  accusationCorrect: boolean | undefined
  finished: boolean
  /**
   * finish() が呼ばれた瞬間の時刻。経過秒の終端をここに固定する。
   * 無いと、finish() をリトライするたびに elapsedSeconds が Date.now() で動いてしまい、
   * 「二度目以降は finished: true をそのまま返す」の冪等性が値レベルで崩れる。
   */
  finishedAt: number | undefined
}

const META_KEY = 'meta'
/** 既存セッション互換のためEvidence側のキー名は変えない。 */
const DISCOVERED_KEY = 'discovered'
const DISCOVERED_REVELATIONS_KEY = 'discovered-revelations'
/**
 * プレイヤーが演じる探偵。meta に混ぜないのは、meta が「ターンごとに更新される集計」で
 * あるのに対し、こちらはセッション開始時に一度書いたら二度と変わらないため。
 * 更新頻度が違うものを同じキーに同居させると、片方を書くたびにもう片方も書き直すことになる。
 */
const DETECTIVE_KEY = 'detective'

/** NPCごとに履歴を分ける。他NPCとの会話を混ぜない設計をキーの形で強制する。 */
const historyKey = (characterId: string) => `history:${characterId}`

/**
 * 往復ごとの質問時刻（epochミリ秒）。history と同じ順・同じ長さで積む。
 *
 * history に混ぜないのは、あちらが actor.ts へそのまま渡す ModelMessage[] だから。
 * 時刻を差し込むとモデルへの入力が変わってしまう。並走する配列にしておけば、
 * 画面を復元するときだけ読めばよい。
 */
const askedAtKey = (characterId: string) => `asked-at:${characterId}`

/**
 * 往復ごとの「プレイヤーが指定した話題」。history と同じ順・同じ長さで積む。
 *
 * 1つの話題から複数の往復が生まれるので、話題を持つのはその先頭の往復だけで、
 * 続きは null になる。全部に持たせると、画面に同じ見出しが何度も並ぶ。
 *
 * askedAt と同じく history には混ぜない。あちらは actor.ts へそのまま渡す
 * ModelMessage[] で、話題を差し込むとモデルへの入力が変わってしまう。
 */
const topicsKey = (characterId: string) => `topics:${characterId}`

/**
 * ModelMessage の content は文字列とは限らない（パーツの配列にもなる）。
 * このDOが積むのは自分で組み立てた文字列だけだが、型の上では両方あり得るので
 * 復元して返すときにここで均しておく。
 */
const textOf = (content: ModelMessage['content']): string => {
  if (typeof content === 'string') {
    return content
  }

  return content.map((part) => (part.type === 'text' ? part.text : '')).join('')
}

/** 復元用に返す1往復。ModelMessage をそのまま外へ出さない（下の getHistories 参照）。 */
export type HistoryExchange = {
  question: string
  answer: string
  askedAt: number
  /**
   * この往復から始まる話題。続きの往復と、話題という考え方より前に始まった
   * セッションでは null になる。
   */
  topic: string | null
}

export type CharacterHistory = {
  characterId: string
  exchanges: HistoryExchange[]
}

export class PlaySession extends DurableObject<SessionBindings> {
  /**
   * 最初に触られた時刻を開始時刻として確定させる。
   * 以降は同じ値を返し続けるので、リザルトの経過秒がリクエストごとにブレない。
   */
  private async meta(): Promise<Meta> {
    const stored = await this.ctx.storage.get<Meta>(META_KEY)

    if (stored !== undefined) {
      return stored
    }

    const fresh: Meta = {
      startedAt: Date.now(),
      questionCount: 0,
      contradictionCount: 0,
      npcLiedCount: 0,
      accusedCharacterId: undefined,
      accusationCorrect: undefined,
      finished: false,
      finishedAt: undefined,
    }
    await this.ctx.storage.put(META_KEY, fresh)

    return fresh
  }

  /** 発見済み証拠IDの現在値。無ければ空配列。 */
  private async discoveredEvidence(): Promise<string[]> {
    const stored = await this.ctx.storage.get<string[]>(DISCOVERED_KEY)

    return stored === undefined ? [] : stored
  }

  /** 解禁済みRevelation IDの現在値。導入前のセッションでは空配列。 */
  private async discoveredRevelations(): Promise<string[]> {
    const stored = await this.ctx.storage.get<string[]>(DISCOVERED_REVELATIONS_KEY)

    return stored === undefined ? [] : stored
  }

  private async discoveryState(): Promise<DiscoveryState> {
    const [evidenceIds, revelationIds] = await Promise.all([
      this.discoveredEvidence(),
      this.discoveredRevelations(),
    ])

    return { evidenceIds, revelationIds }
  }

  /**
   * Meta + 発見済み情報を、呼び出し側が使う形に組み立てる。
   * finished 済みなら経過秒は finishedAt で止め、進行中なら Date.now() で伸ばし続ける。
   */
  private toSnapshot(meta: Meta, discoveries: DiscoveryState): SessionSnapshot {
    const elapsedUntil = meta.finishedAt === undefined ? Date.now() : meta.finishedAt

    return {
      startedAt: meta.startedAt,
      questionCount: meta.questionCount,
      discoveredEvidenceIds: discoveries.evidenceIds,
      discoveredRevelationIds: discoveries.revelationIds,
      contradictionCount: meta.contradictionCount,
      npcLiedCount: meta.npcLiedCount,
      accusedCharacterId: meta.accusedCharacterId,
      accusationCorrect: meta.accusationCorrect,
      finished: meta.finished,
      elapsedSeconds: Math.floor((elapsedUntil - meta.startedAt) / 1000),
    }
  }

  /**
   * このNPCとの会話履歴だけを返す。actor.ts の history にそのまま渡せる形。
   */
  async getHistory(characterId: string): Promise<ModelMessage[]> {
    const stored = await this.ctx.storage.get<ModelMessage[]>(historyKey(characterId))

    return stored === undefined ? [] : stored
  }

  /**
   * プレイヤーが演じる探偵を記録する。セッション開始時に一度だけ呼ばれる想定。
   * 名乗らずに始めることもできるので、呼ばれないまま進むセッションもある。
   */
  async setDetective(detective: Detective): Promise<void> {
    await this.ctx.storage.put(DETECTIVE_KEY, detective)
  }

  /**
   * 記録されている探偵。名乗らずに始めたセッションでは undefined。
   *
   * 履歴と1つのオブジェクトにまとめて返したくなるが、そうすると
   * Workers の RPC 型ユーティリティが ModelMessage[] を含む戻り値を解決できず
   * never に潰れる。呼び出し側で Promise.all すれば往復は1回分で済むので、
   * メソッドは分けたままにしておく。
   */
  async getDetective(): Promise<Detective | undefined> {
    return await this.ctx.storage.get<Detective>(DETECTIVE_KEY)
  }

  /**
   * 1つの話題ぶんのやり取りを、まとめて履歴に積む。
   *
   * 質問回数は往復の数ではなく1だけ増やす。プレイヤーが投げたのは話題1つで、
   * そこから何往復するかは探偵が決めるため。往復で数えると、探偵がどこまで
   * 食い下がったかでターンの減りが変わる（`src/shared/turns.ts`）。
   *
   * 時刻は往復ごとに取り直さず、この話題ぜんぶで同じ値を共有する。1つの話題は
   * 一続きのやり取りなので、記録を並べ直したときにも塊のまま残ってほしい。
   */
  async appendTopic(
    characterId: string,
    topic: string,
    exchanges: { question: string; answer: string }[],
  ): Promise<number> {
    const current = await this.getHistory(characterId)
    const next: ModelMessage[] = [
      ...current,
      ...exchanges.flatMap((exchange): ModelMessage[] => [
        { role: 'user', content: exchange.question },
        { role: 'assistant', content: exchange.answer },
      ]),
    ]

    const meta = await this.meta()
    const updated: Meta = { ...meta, questionCount: meta.questionCount + 1 }
    const [askedAt, topics] = await Promise.all([
      this.askedAtList(characterId),
      this.topicList(characterId),
    ])
    const askedAtNow = Date.now()

    await this.ctx.storage.put({
      [historyKey(characterId)]: next,
      [askedAtKey(characterId)]: [...askedAt, ...exchanges.map(() => askedAtNow)],
      [topicsKey(characterId)]: [
        ...topics,
        ...exchanges.map((_exchange, index) => (index === 0 ? topic : null)),
      ],
      [META_KEY]: updated,
    })

    return updated.questionCount
  }

  /** 往復ごとの質問時刻。この機能より前に始まったセッションでは空になる。 */
  private async askedAtList(characterId: string): Promise<number[]> {
    const stored = await this.ctx.storage.get<number[]>(askedAtKey(characterId))

    return stored === undefined ? [] : stored
  }

  /** 往復ごとの話題。話題という考え方より前に始まったセッションでは空になる。 */
  private async topicList(characterId: string): Promise<(string | null)[]> {
    const stored = await this.ctx.storage.get<(string | null)[]>(topicsKey(characterId))

    return stored === undefined ? [] : stored
  }

  /**
   * 画面を復元するための、NPCごとの会話。
   *
   * 戻り値に ModelMessage を出さないのは型の都合。あれを含む戻り値は
   * Workers の RPC 型ユーティリティが解決できず never に潰れる
   * （getDetective のコメントと同じ理由）。ここでは往復を平たい形に均して返す。
   *
   * 時刻を持たない古いセッションは、開始時刻から1秒ずつずらした値で代用する。
   * 正確な時刻より、NPCをまたいだ並び順が壊れないことのほうが画面には効く。
   */
  async getHistories(characterIds: string[]): Promise<CharacterHistory[]> {
    const meta = await this.meta()

    return await Promise.all(
      characterIds.map(async (characterId) => {
        const messages = await this.getHistory(characterId)
        const [times, topics] = await Promise.all([
          this.askedAtList(characterId),
          this.topicList(characterId),
        ])
        const exchanges = messages.flatMap((message, index) => {
          if (message.role !== 'user') {
            return []
          }

          const answer = messages[index + 1]
          const round = index / 2
          const recorded = times[round]
          const topic = topics[round]

          return [
            {
              question: textOf(message.content),
              answer: answer === undefined ? '' : textOf(answer.content),
              askedAt: recorded === undefined ? meta.startedAt + round * 1000 : recorded,
              topic: topic === undefined ? null : topic,
            },
          ]
        })

        return { characterId, exchanges }
      }),
    )
  }

  /**
   * 1ターン分の Judge 判定を反映する。証拠のマージと集計を1回のストレージ操作で済ませる。
   * ask エンドポイントは Judge の構造化出力の該当フィールドをそのまま渡せる。
   * npcLied はプレイヤーには見せないが、リザルト解析のためにここで数えておく。
   */
  async recordJudgement(judgement: {
    revealedEvidenceIds: string[]
    revealedRevelationIds: string[]
    contradictionPointedOut: boolean
    npcLied: boolean
  }): Promise<SessionSnapshot> {
    const meta = await this.meta()
    const discoveries = mergeJudgementDiscoveryState(await this.discoveryState(), judgement)

    const updatedMeta: Meta = {
      ...meta,
      contradictionCount: meta.contradictionCount + (judgement.contradictionPointedOut ? 1 : 0),
      npcLiedCount: meta.npcLiedCount + (judgement.npcLied ? 1 : 0),
    }

    await this.ctx.storage.put({
      [META_KEY]: updatedMeta,
      [DISCOVERED_KEY]: discoveries.evidenceIds,
      [DISCOVERED_REVELATIONS_KEY]: discoveries.revelationIds,
    })

    return this.toSnapshot(updatedMeta, discoveries)
  }

  /**
   * プレイヤーの推理を記録する。二度目以降は最初の回答を保持する。
   * 言い直しや二重送信のたびに正誤が書き換わると、確定したはずのリザルトが揺らぐ。
   */
  async recordAccusation(culpritCharacterId: string, correct: boolean): Promise<SessionSnapshot> {
    const meta = await this.meta()

    if (meta.accusedCharacterId !== undefined) {
      return this.toSnapshot(meta, await this.discoveryState())
    }

    const updatedMeta: Meta = {
      ...meta,
      accusedCharacterId: culpritCharacterId,
      accusationCorrect: correct,
    }

    await this.ctx.storage.put(META_KEY, updatedMeta)

    return this.toSnapshot(updatedMeta, await this.discoveryState())
  }

  async snapshot(): Promise<SessionSnapshot> {
    const meta = await this.meta()
    const discoveries = await this.discoveryState()

    return this.toSnapshot(meta, discoveries)
  }

  /**
   * セッションを終了させ、確定したスナップショットを返す。
   * 呼び出し側はこれを使って results を書く。二度目以降は finished: true のまま
   * 同じ elapsedSeconds を返し続けるので、リトライや二重送信でリザルトの値がブレない。
   */
  async finish(): Promise<SessionSnapshot> {
    const meta = await this.meta()

    if (meta.finished) {
      return this.toSnapshot(meta, await this.discoveryState())
    }

    const updatedMeta: Meta = { ...meta, finished: true, finishedAt: Date.now() }
    await this.ctx.storage.put(META_KEY, updatedMeta)

    return this.toSnapshot(updatedMeta, await this.discoveryState())
  }

  /**
   * DBへの書き出しが済んだセッションの作業領域を捨てる。
   * DO のストレージは明示的に消さない限り残り続ける。
   */
  async dispose(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}
