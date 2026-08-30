/** IDを持つ表示項目を、既存の順序を保ったまま冪等に追加する。 */
export const mergeById = <T extends { id: string }>(current: T[], additions: T[]): T[] => {
  const existingIds = new Set(current.map((item) => item.id))
  const newOnes = additions.filter((item) => !existingIds.has(item.id))

  return [...current, ...newOnes]
}
