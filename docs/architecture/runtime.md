# 実行基盤とビルド

## Cloudflare Workers

本番は Cloudflare Workers 上で動きます。エッジで実行されるため、スマホから10分遊ぶ体験に必要な低レイテンシが得られます。Durable Objects・KV・Hyperdrive といった状態管理の道具が同じプラットフォーム内で揃うことも選定理由です。

設定は `wrangler.jsonc` に集約されています。

```jsonc
{
  "main": "src/server.ts",
  "compatibility_date": "2026-08-29",
  "compatibility_flags": ["nodejs_compat"]
}
```

`nodejs_compat` は省略できません。postgres.js が TCP 接続を張るために必要で、これが無いと Postgres に到達できません。

### エントリの二層構造

```text
src/server.ts          Workers のエントリ。DOクラスを re-export し、
                       /api/* を Hono に、それ以外を TanStack Start に振り分ける
src/server/index.ts    Hono アプリ本体。cloudflare:workers を import しない
```

Durable Object のクラスは `cloudflare:workers` を import します。これを Hono アプリ本体に持ち込むと、Workers ランタイム外（`bun test` など）からアプリを読めなくなります。エントリを分離することで、テストが `app.request()` でルーティングを検証できる状態を保っています。

同時に、DO クラスはエントリから export されていないとバインディングが解決できないため、`src/server.ts` が両方の責務を担います。

画面（SSR）とAPIが1つの Worker に同居しているのは、DO バインディングを共有するためです。別 Worker に割るとサービスバインディング越しになり、聞き込みのSSEを中継する段が1つ増えます。

```typescript
export default {
  fetch: (request, env, ctx) =>
    new URL(request.url).pathname.startsWith('/api/')
      ? app.fetch(request, env, ctx)
      : handler.fetch(request),
}
```

SSR のルート loader は Hono を経由せず、`src/server/read/` の読み取り関数を直接呼びます。相対パスで自分の `/api` を叩くと、サーバ側では URL を解決できないためです。バインディングを `cloudflare:workers` の `env` から取るのは `src/server/fn/` のサーバ関数だけで、Hono 側は引き続き引数で受け取ります。

## Hono

APIフレームワークは Hono です。Workers ランタイムとの相性、そして `streamSSE` の素直さが決め手になっています。

```typescript
const app = new Hono<{ Bindings: Bindings; Variables: { env: Env } }>()
```

`Bindings` に Workers のバインディング、`Variables` に検証済み設定を型付けすることで、ハンドラ内で `c.env.PLAY_SESSION` や `c.get('env')` が型安全に引けます。

### エンドポイント

ルーターは `src/server/routes/` に2つ（`scenarios.ts` / `sessions.ts`）あり、`index.ts` が束ねます。

| メソッド・パス | 返すもの |
| --- | --- |
| `GET /api/health` | 疎通確認。バインディング不要 |
| `GET /api/scenarios` | 一覧。タイトル・カテゴリ・登場人物数・難易度・所要時間だけ |
| `GET /api/scenarios/:id` | 詳細。事件の記録・見取り図・登場人物（`personality` のみ） |
| `POST /api/sessions` | セッション開始。探偵の設定を受け取る。**ここで計時が始まる** |
| `GET /api/sessions/:id` | 進行状況。発見済みの証拠だけをラベル付きで返す |
| `POST /api/sessions/:id/ask` | NPCへの質問。SSE で `delta` → `judgement` → `done` |
| `POST /api/sessions/:id/accuse` | 犯人当て。**真相を返してよいのはここだけ** |

`/api/scenarios/:id` が返す登場人物は `personality` までです。`knowledge` / `secrets` / `lies` / `memories` はNPCのプロンプトの材料であって、プレイヤーに見せるものではありません。証拠の一覧も返しません。未発見の証拠名それ自体がネタバレになるためです。

セッション作成をシナリオ選択時ではなく「聞き込みを始める」時に行うのは、事件の記録を読んでいる時間が `solvedSeconds` に乗らないようにするためです。じっくり読む人ほどタイムで不利になるのは、ゲームとして間違っています。

### ミドルウェアの適用範囲

`withEnv` は全ルートには掛けません。掛けるのは `ask` だけで、それもルート単位のチェーン（`validateAsk` → `withEnv` → handler）で順序ごと型に落としています。

`/api/health` はバインディングが無くても答えられるべきです。疎通確認が設定の不備で落ちると、障害の切り分けをする足場を失います。

同じ理由で、入力のバリデーションは env の検証より先に走らせます。逆にすると、不正なUUIDや長すぎる発話が 400 ではなく 500 に化け、「設定不備なのか、リクエストが不正なのか」を切り分けられなくなります。

### env の検証とメモ化

`src/server/env.ts` が Zod スキーマで環境変数を検証します。バインディングは isolate の中で不変なので、`src/server/middleware/env.ts` が一度検証した結果を使い回します。リクエストごとに parse をやり直すと、10分の体験の中で何十回も同じ検証を繰り返すことになります。

APIキーは全て `optional` です。3社のうち使うプロバイダの分だけあればよく、未使用プロバイダのキーが無くても起動します。

## ストリーミング

NPCの返答は SSE で逐次配信します。双方向通信が不要なので WebSocket は使いません。

```typescript
return streamSSE(c, async (stream) => {
  for await (const chunk of result.textStream) {
    chunks.push(chunk)
    await stream.writeSSE({ event: 'delta', data: chunk })
  }
  // ストリーム完了後に DO と Postgres へ永続化
  await stream.writeSSE({ event: 'done', data: '' })
})
```

永続化は `try/catch` で囲み、失敗しても流し終えた会話は返します。記録の取りこぼしでプレイを止めないという判断です。

## ビルドパイプライン

開発も本番も `@cloudflare/vite-plugin` に集約しています。

| 用途 | ツール | コマンド |
| --- | --- | --- |
| 開発 | Vite + `@cloudflare/vite-plugin` | `bun run dev` |
| 本番ビルド | `tsc --noEmit` + Vite | `bun run build` |
| デプロイ | Vite + wrangler | `bun run deploy` |

このプラグインは Vite の Environment API を使い、Worker のコードを Node ではなく **workerd の上で** 実行します。そのため dev サーバでも Durable Object・Hyperdrive・KV が本番と同じ形で解決され、`wrangler dev` を別に立てる必要がありません。エントリ（`main`）もバインディングも `wrangler.jsonc` をそのまま読むので、設定を二重に持つ場所はありません。

`vite build` は `dist/alibai/` に Worker バンドルと deploy 用の `wrangler.json` を出力します。`wrangler deploy` は `.wrangler/deploy/config.json` のリダイレクトを辿ってそちらを使うため、`src/server.ts` が re-export している DO クラスもそのまま載ります。

画面のルーティングは TanStack Start（`@tanstack/react-start`）が担い、`src/routes/` のディレクトリ構造から `src/routeTree.gen.ts` を生成します。生成物は手で触らず、`biome.json` の `!**/*.gen.ts` で検査からも外してあります。アセットに一致しないパスは Worker に落ちて SSR で応答するので、`not_found_handling`（SPAフォールバック）は使いません。

dev サーバは `.env` を読んでシークレットとして Worker に渡します。未使用のプロバイダのキーを `KEY=` と空文字で残しても落ちないよう、`env.ts` 側で空文字は未設定として扱っています。

### TypeScript

`tsconfig.json` は厳しめの設定です。

- `strict` に加えて `noUncheckedIndexedAccess` — 配列アクセスが `T | undefined` になる
- `verbatimModuleSyntax` — 型 import を明示させる
- `noImplicitOverride` / `noFallthroughCasesInSwitch`
- `noEmit` — 型検査専用。出力は Vite が行う

パスエイリアスは `@/*` → `src/*`、`~/db/*` → `db/*` の2つで、`tsconfig.json` と `vite.config.ts` の両方に同じ定義を置いています。

`noUncheckedIndexedAccess` は LLM 出力を扱うコードで特に効きます。配列の先頭要素が必ずあると仮定したコードをコンパイラが止めてくれます。

## フロントエンド

React 19 + Tailwind CSS v4 で、スマホ縦画面のチャットUIを組む想定です。Vite プラグインは `@vitejs/plugin-react-swc`（SWC による高速変換）と `@tailwindcss/vite`（v4 の Vite ネイティブ統合、PostCSS 設定不要）を使います。

現時点でクライアント実装はまだ入っていません。実装時には `Bindings` に `ASSETS: Fetcher` を足し、`wrangler.jsonc` にも `assets` 設定を追加します。配る資産が無い状態で宣言すると deploy が落ちるため、意図的に保留されています。
