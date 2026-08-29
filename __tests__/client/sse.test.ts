import { describe, expect, test } from 'bun:test'
import { parseSseStream } from '@/client/lib/sse'

/**
 * `chunks` を enqueue した順番どおりに、それぞれ独立した read() 結果として返す
 * ReadableStream を組み立てる。デフォルトの ReadableStreamDefaultController は
 * enqueue 単位を勝手にまとめないので、テストで狙ったチャンク境界をそのまま再現できる。
 */
const streamOf = (chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      }

      controller.close()
    },
  })
}

const collect = async (stream: ReadableStream<Uint8Array>) => {
  const events: { event: string; data: string }[] = []

  for await (const event of parseSseStream(stream)) {
    events.push(event)
  }

  return events
}

describe('parseSseStream', () => {
  test('1チャンクに収まった単一イベントを読める', async () => {
    const events = await collect(streamOf(['event: delta\ndata: こんにちは\n\n']))

    expect(events).toEqual([{ event: 'delta', data: 'こんにちは' }])
  })

  test('1チャンクに複数イベントが詰まっていても分割できる', async () => {
    const events = await collect(
      streamOf(['event: delta\ndata: あ\n\nevent: delta\ndata: い\n\nevent: done\ndata: \n\n']),
    )

    expect(events).toEqual([
      { event: 'delta', data: 'あ' },
      { event: 'delta', data: 'い' },
      { event: 'done', data: '' },
    ])
  })

  test('データ行の途中でチャンクが切れても継ぎ足して読める', async () => {
    const events = await collect(streamOf(['event: delta\ndata: 前半', 'と後半\n\n']))

    expect(events).toEqual([{ event: 'delta', data: '前半と後半' }])
  })

  test('event: 行の途中でチャンクが切れても読める', async () => {
    const events = await collect(streamOf(['eve', 'nt: judgement\ndata: {}\n\n']))

    expect(events).toEqual([{ event: 'judgement', data: '{}' }])
  })

  test('区切りの \\n\\n がチャンク境界をまたいで分割されても1イベントとして読める', async () => {
    // 1つ目のチャンクは最初の \n だけで終わり、2つ目のチャンクが残りの \n から始まる。
    const events = await collect(streamOf(['event: delta\ndata: x\n', '\nevent: done\ndata: \n\n']))

    expect(events).toEqual([
      { event: 'delta', data: 'x' },
      { event: 'done', data: '' },
    ])
  })

  test('区切りの \\n\\n の間、1文字ずつチャンクが分かれていても読める', async () => {
    const raw = 'event: delta\ndata: x\n\n'
    const events = await collect(streamOf(raw.split('')))

    expect(events).toEqual([{ event: 'delta', data: 'x' }])
  })

  test('マルチバイト文字（UTF-8で3バイト）がチャンク境界の真ん中で分割されても文字化けしない', async () => {
    const encoder = new TextEncoder()
    const bytes = encoder.encode('event: delta\ndata: 月見ヤチヨ\n\n')
    // "月" の3バイトのうち先頭1バイトだけを前のチャンクに残し、真ん中で分割する。
    const splitIndex = 'event: delta\ndata: '.length + 1
    const events = await collect(streamOf([bytes.slice(0, splitIndex), bytes.slice(splitIndex)]))

    expect(events).toEqual([{ event: 'delta', data: '月見ヤチヨ' }])
  })

  test('data: が空文字の done イベントを読める', async () => {
    const events = await collect(streamOf(['event: done\ndata: \n\n']))

    expect(events).toEqual([{ event: 'done', data: '' }])
  })

  test('judgement イベントのJSONペイロードをそのまま復元できる', async () => {
    const payload = JSON.stringify({
      revealedEvidences: [{ id: 'e1', label: '血痕' }],
      contradictionPointedOut: true,
      suggestedQuestions: ['アリバイは？'],
      questionCount: 3,
    })
    const events = await collect(streamOf([`event: judgement\ndata: ${payload}\n\n`]))

    expect(events).toEqual([{ event: 'judgement', data: payload }])
  })

  test('ストリーム終端まで \\n\\n が来なかった未完のブロックも取りこぼさない', async () => {
    const events = await collect(streamOf(['event: done\ndata: ']))

    expect(events).toEqual([{ event: 'done', data: '' }])
  })

  test('1バイトずつバラバラに届く現実的なストリームを最後まで正しく読める', async () => {
    const raw =
      'event: delta\ndata: 探偵\n\n' +
      'event: delta\ndata: くん、\n\n' +
      'event: judgement\ndata: {"questionCount":1}\n\n' +
      'event: done\ndata: \n\n'
    const encoder = new TextEncoder()
    const bytes = encoder.encode(raw)
    const chunks = Array.from(bytes, (byte) => Uint8Array.of(byte))
    const events = await collect(streamOf(chunks))

    expect(events).toEqual([
      { event: 'delta', data: '探偵' },
      { event: 'delta', data: 'くん、' },
      { event: 'judgement', data: '{"questionCount":1}' },
      { event: 'done', data: '' },
    ])
  })
})
