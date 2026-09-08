import { z } from 'zod'
import type { PlaySession } from '@/server/do/play-session'
import type { RateLimiter } from '@/server/do/rate-limiter'

/**
 * Workers のバインディング。
 *
 * isolate はグローバルスコープにシークレットを持たない。環境変数もバインディングも
 * fetch ハンドラの env から降ってくるので、このモジュールで process.env を読んではいけない。
 * 「起動時に一度だけ検証する」から「リクエストに入った時点で検証する」へ移した理由がこれ。
 */
export type Bindings = {
  /** シナリオと真相、会話ログ、リザルトの正典。 */
  DB: D1Database
  /** 1プレイセッション = 1インスタンス。進行中の状態はここが持つ。 */
  PLAY_SESSION: DurableObjectNamespace<PlaySession>
  /** ユーザー（未認証ならIP）ごとのLLM使用量。 */
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>
  /** 公開シナリオとキャラクターシートの読みキャッシュ。真相は絶対に入れない。 */
  SCENARIO_CACHE: KVNamespace
  /**
   * クライアント（React）の静的ファイル。
   * 出力先は wrangler.jsonc に書かない。vite プラグインが client ビルドの
   * 成果物を assets として繋いでくれる。
   */
  ASSETS: Fetcher
} & Record<string, unknown>

/**
 * `cloudflare:workers` の env にも同じ形を与える。
 *
 * サーバ関数（SSR）は Hono のコンテキストを経由しないので、そちらからは
 * グローバルの env を読むことになる。ここで宣言をまとめておかないと、
 * 型のために `as` を書く羽目になる。
 */
declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}
  }
}

/**
 * 使わない項目は `KEY=` と空文字で置かれることが多い（.env / vars とも）。
 * 空文字は「未設定」であって「長さ0の値」ではないので、検証の前に落とす。
 */
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().nonempty().optional(),
)

/**
 * 環境変数はここで一度だけ検証する。
 * 未設定のまま動きだして、プレイ中に初めて落ちる事故を防ぐ。
 */
const schema = z.object({
  // 役割ごとに使うモデル。未設定なら db/llm-catalog.ts の既定。
  // 互換サーバ独自のモデル名もそのまま書ける（突き合わせる表を持たないため）。
  LLM_ACTOR_MODEL: optionalString,
  LLM_JUDGE_MODEL: optionalString,
  LLM_AUTHOR_MODEL: optionalString,

  /** 互換サーバの鍵。鍵を要らないサーバでも何か入れること（後述）。 */
  OPENAI_API_KEY: optionalString,

  /*
    LLMの向き先。3社ぶんではなく1つなのは、どのプロバイダのモデルも
    OpenAI互換の `/chat/completions` へ投げるため（src/server/llm/provider.ts）。
    プロバイダ名はモデルIDの区分けとして残っているだけで、宛先は分かれない。

    ここを env として明示的に持つ必要がある。AI SDK は baseURL を渡さないと
    process.env の同名変数を見にいくが、Workers の isolate に process.env は無い。
    .dev.vars に置いただけではローカルでしか効かず、デプロイした瞬間に本家へ向き直る——
    しかも例外は出ないので、請求とレイテンシが変わるまで誰も気づかない。

    パスの接頭辞まで含めた値を入れること（末尾は `/v1`）。
  */
  OPENAI_URL: optionalString,

  /** 1プレイで使えるターン数。使い切ると質問できなくなり、推理に進む。 */
  MAX_TURNS: z.coerce.number().int().positive().default(15),
  /** 1ターンに投げられる質問数。 */
  QUESTIONS_PER_TURN: z.coerce.number().int().positive().default(2),

  /** 1ウィンドウあたりに許すLLM呼び出し回数。 */
  /*
    数えるのは**モデル呼び出しの回数**であって、リクエスト数ではない。
    1回の話題で最大 `2 × 往復数 + 1` 回呼ぶので、リクエストで数えると
    往復数を増やしたプレイヤーだけが同じ予算で何倍も呼べてしまう。

    既定の 420 は「従来の 60 リクエスト × 既定往復数での 7 呼び出し」を移し替えた値。
  */
  RATE_LIMIT_MAX_CALLS: z.coerce.number().int().positive().default(420),
  /** レート制限のウィンドウ幅（秒）。 */
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),

  /**
   * プレイセッションと会話ログの保持日数。Cronがこれを過ぎた分を消す。
   * llm_usages はこの対象外（コストの履歴は保持期間に引きずらせない）。
   */
  RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  /**
   * 読み上げサーバ。未設定なら誰も喋らない（画面は今までどおり文字だけで進む）。
   * 末尾のスラッシュは有っても無くてもよい。
   */
  TTS_URL: optionalString,
})

export type Env = z.infer<typeof schema>

/**
 * 検証に失敗したら throw する。Workers に process.exit は無いし、
 * あったとしても isolate を落とすのは正しい振る舞いではない。
 */
export const parseEnv = (source: unknown): Env => {
  const result = schema.safeParse(source)

  if (!result.success) {
    throw new Error(`[env] invalid environment variables:\n${z.prettifyError(result.error)}`)
  }

  return result.data
}
