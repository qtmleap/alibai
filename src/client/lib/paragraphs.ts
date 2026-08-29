/**
 * ブリーフィング本文を空行区切りの段落に分割する。
 *
 * 段落間の空行が2行以上連続していても1つの区切りとして扱い、
 * 前後の空白だけの段落（先頭・末尾の余分な空行由来）は捨てる。
 * 段落内部の単一改行（1行の中の改行）は区切りとみなさない。
 */
export const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
