/**
 * 1段落の目安の長さ。
 *
 * スマホの幅で3〜4行にあたる。文字送りは1文字65ミリ秒なので、これを超えると
 * 1段落を出し切るのに4秒以上かかり、読むより待つ時間のほうが長くなる。
 * クロールでも、1段落が画面の高さを埋めると「流れている」感じが消える。
 */
const MAX_PARAGRAPH_CHARS = 60

/** 文字数は符号位置で数える（絵文字や結合文字を1文字と見る）。 */
const lengthOf = (text: string): number => Array.from(text).length

/**
 * 句点で文に切る。
 *
 * 閉じ括弧は文末に付いてくるので、その手前では切らず、括弧を閉じ切った後ろで切る。
 * 「……そうですか。」を『「……そうですか。』と『」』に割らないため。
 */
const splitSentences = (paragraph: string): string[] =>
  paragraph
    .split(/(?<=[。！？][」』）】]*)(?![」』）】])/)
    .filter((sentence) => sentence.length > 0)

/**
 * 長い段落を、文の切れ目で読める大きさに割る。
 *
 * 文の途中では絶対に切らない。目安を超える一文はそのまま1段落として残す。
 * 語りの途中で改行が入ると、読み手はそこで一度息を止めることになる。
 * 長すぎる段落より、そちらのほうが読みにくい。
 */
const chunkParagraph = (paragraph: string): string[] => {
  // reduce で新しい配列を作り直していくと、段落ごとに配列を積み直すことになる。
  // ここは手元の配列を伸ばすだけでよいので、素直に push する。
  const chunks: string[] = []

  for (const sentence of splitSentences(paragraph)) {
    const last = chunks[chunks.length - 1]

    if (last === undefined || lengthOf(last) + lengthOf(sentence) > MAX_PARAGRAPH_CHARS) {
      chunks.push(sentence)
    } else {
      chunks[chunks.length - 1] = last + sentence
    }
  }

  return chunks
}

/** 文が書き終わっているか。閉じ括弧は句点の後ろに付いてくるので、そこまで見る。 */
const isComplete = (sentence: string): boolean => /[。！？][」』）】]*$/.test(sentence)

/**
 * 流れてくる発言を、画面に置ける一文の並びに変える。
 *
 * 聞き込みの返答は一字ずつ届くが、届いたそばから出すと読むより先に目が字を追いはじめ、
 * 追いつくための時間になる。文が出来上がるまで待って、出来た一文をまとめて置く。
 * 置く側は現れた瞬間だけ淡く浮かせる（`line-in`）。
 *
 * `streaming` が false なら全部返す。書き終わった発言は、句点で終わらない喋り方
 * （「……」で切るなど）でも、そこで待たせる理由がない。
 */
export const settledSentences = (text: string, streaming: boolean): string[] => {
  const sentences = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap(splitSentences)

  const last = sentences[sentences.length - 1]

  return streaming && last !== undefined && !isComplete(last) ? sentences.slice(0, -1) : sentences
}

/**
 * ブリーフィング本文を、画面に出す段落の並びに変える。
 *
 * まず空行で区切る。空行が2行以上続いても1つの区切りとして扱い、前後の空白だけの
 * 段落（先頭・末尾の余分な空行由来）は捨てる。段落内部の単一改行は区切りにしない。
 *
 * そのうえで、長すぎる段落だけを文の切れ目で割る。書き手が置いた空行は
 * 呼吸なのでそのまま残し、割るのは「1段落が長すぎて読み進められない」ときだけ。
 * ここで整えておけば、シナリオを書く人が端末の幅を気にして改行を入れずに済む。
 */
export const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .flatMap(chunkParagraph)
    .map((paragraph) => paragraph.trim())
