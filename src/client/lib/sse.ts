/**
 * POST で受ける SSE を自前でパースするための最小実装。
 *
 * `EventSource` は GET 専用なので `/api/sessions/:id/ask`（POST）には使えない。
 * fetch のレスポンスボディを ReadableStream として読み、`event:` / `data:` 行を
 * 自分で切り出す。
 */

export type SseEvent = {
  event: string
  data: string
}

/** hono/streaming の streamSSE は1メッセージを "...\n\n" で終端する。 */
const EVENT_SEPARATOR = '\n\n'
const DEFAULT_EVENT_NAME = 'message'

const stripFieldPrefix = (line: string, prefix: string): string =>
  line.slice(prefix.length).trimStart()

/**
 * 空行区切りの1ブロックを event/data にパースする。
 * data 行が複数あれば SSE の仕様通り改行で連結する（今回は基本1行だが将来の複数行データにも耐える）。
 */
const parseEventBlock = (block: string): SseEvent | undefined => {
  const lines = block.split('\n').filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return undefined
  }

  const eventLine = lines.find((line) => line.startsWith('event:'))
  const dataLines = lines.filter((line) => line.startsWith('data:'))

  const event = eventLine === undefined ? DEFAULT_EVENT_NAME : stripFieldPrefix(eventLine, 'event:')
  const data = dataLines.map((line) => stripFieldPrefix(line, 'data:')).join('\n')

  return { event, data }
}

/**
 * チャンクを読み進めながら、`\n\n` で区切れる完全なイベントブロックだけを都度取り出す。
 *
 * 繰り越しバッファを外側の `let` 変数で持つ代わりに再帰の引数として運ぶ。
 * ネットワークのチャンク境界はイベントの途中（`event:` 行の途中、区切りの `\n\n` の間、
 * さらにはマルチバイト文字の途中）で平気で切れるので、状態は必ずここで完結させる。
 * TextDecoder は `stream: true` で呼び続けることでマルチバイト文字の分割にも対応する。
 */
const readEvents = async function* (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  carry: string,
): AsyncGenerator<SseEvent> {
  const { done, value } = await reader.read()

  if (done) {
    // ストリーム終端後にバッファへ未完のブロックが残っていたら、それも流し切る。
    const trailing = parseEventBlock(carry)

    if (trailing !== undefined) {
      yield trailing
    }

    return
  }

  const text = carry + decoder.decode(value, { stream: true })
  const blocks = text.split(EVENT_SEPARATOR)
  // 最後の要素は次のチャンクへ続く可能性がある未完のブロックなので、繰り越す。
  const rest = blocks[blocks.length - 1]
  const complete = blocks.slice(0, -1)

  for (const block of complete) {
    const parsed = parseEventBlock(block)

    if (parsed !== undefined) {
      yield parsed
    }
  }

  yield* readEvents(reader, decoder, rest === undefined ? '' : rest)
}

/**
 * fetch のレスポンスボディを SSE イベント列として読む。
 */
export const parseSseStream = async function* (
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()

  yield* readEvents(reader, decoder, '')
}
