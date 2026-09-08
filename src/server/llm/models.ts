import { z } from 'zod'

/**
 * 互換サーバに「いま何が生えているか」を聞く。
 *
 * 手で書いた表を持たないのは、サーバの構成を変えるたびに実態とずれ、しかも
 * ずれたことに気づけないため。選択肢は必ずサーバに聞いてから並べる。
 */

/*
  余分な列は読まない。OpenAI 本家は object/created/owned_by を返し、互換実装は
  context_length や capabilities を足してくることがあるが、画面が要るのは id だけ。
  `.loose()` にしてあるのは、知らない列が来ても弾かないため。
*/
const modelListSchema = z.object({ data: z.array(z.object({ id: z.string().nonempty() }).loose()) })

/**
 * 生えているモデルIDを返す。取れなければ空配列。
 *
 * 失敗しても throw しない。一覧が出せないことと、設定が壊れていることは別なので、
 * 画面は「選択肢が出ない」だけで開き、保存済みの設定はそのまま効き続ける。
 */
export const listModels = async (baseUrl: string, apiKey: string): Promise<string[]> => {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  }).catch(() => undefined)

  if (response === undefined || !response.ok) {
    console.error('[llm] failed to list models', response?.status)

    return []
  }

  const parsed = modelListSchema.safeParse(await response.json().catch(() => undefined))

  if (!parsed.success) {
    console.error('[llm] unexpected model list shape')

    return []
  }

  return parsed.data.data.map((model) => model.id)
}
