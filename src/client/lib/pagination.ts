/**
 * 一覧のページ送り。
 *
 * ページ番号はURLから来る（手で書き換えられる）ので、範囲外は弾かずに端へ丸める。
 * 存在しないページを要求されたときにエラー画面を出しても、読み手にできることは無い。
 */

/** 1ページに並べる件数。1画面ぶんを少し超える程度に留め、送る操作が必ず一度は要るようにする。 */
export const SCENARIOS_PER_PAGE = 10

export type Page<T> = {
  items: T[]
  /** 1始まり。丸めたあとの値なので、そのまま画面の現在地として出せる。 */
  current: number
  /** 0件でも1を返す。「0 / 0ページ」という表示を作らないため。 */
  total: number
}

export const paginate = <T>(items: T[], requested: number, perPage: number): Page<T> => {
  const total = Math.max(1, Math.ceil(items.length / perPage))
  // 数として読めない要求は先頭ページ扱い。Math.max も Math.min も NaN を通すので、
  // ここで止めないと「NaN / 5」という現在地が画面に出る。
  const asked = Number.isFinite(requested) ? Math.trunc(requested) : 1
  const current = Math.min(Math.max(1, asked), total)
  const start = (current - 1) * perPage

  return { items: items.slice(start, start + perPage), current, total }
}
