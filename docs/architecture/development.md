# 開発環境とコード品質

## Dev Container

**環境構築は Dev Container に統一します。** 手順は「VS Code で開いて Reopen in Container」だけです。

```text
.devcontainer/
├── devcontainer.json        # features、マウント、拡張機能、環境変数の受け渡し
├── Dockerfile               # ベースイメージ (oven/bun:1)
├── compose.yaml             # app のみ
├── postCreateCommand.sh     # .env生成、bun install、マイグレーション
└── postAttachCommand.sh     # git設定、マージ済みブランチの掃除、direnv
```

### compose 構成

| サービス | 内容 | ポート |
| --- | --- | --- |
| `app` | 開発コンテナ本体 | 5173 |

データベースのコンテナはありません。D1 の実体は wrangler が `.wrangler/state` に持つファイルなので、待ち合わせるヘルスチェックも接続文字列も要りません。

`node_modules` は名前付きボリュームに載せ、ホストとのバインドマウントから切り離しています。

### ツールの入り方

ルート `Dockerfile` は開発環境の土台だけを提供し、実際のツールは devcontainer features が入れます。本番は Cloudflare Workers に載るため、実行用のコンテナイメージは作りません。

| feature | 用途 |
| --- | --- |
| bun | パッケージ管理・テストランナー |
| node 26.5.0 | ツールチェーンの実行環境 |
| github-cli | `gh` |
| claude-code | Claude Code CLI |
| docker-outside-of-docker | ホストの Docker を利用 |
| act | GitHub Actions のローカル実行 |
| direnv | ディレクトリ単位の環境変数 |
| apt-packages | `git-filter-repo` |

### APIキーの受け渡し

`devcontainer.json` の `remoteEnv` でホストの環境変数をコンテナへ渡します。キーをリポジトリに置かないための仕組みです。

```json
"remoteEnv": {
  "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}",
  "OPENAI_API_KEY": "${localEnv:OPENAI_API_KEY}",
  "GOOGLE_GENERATIVE_AI_API_KEY": "${localEnv:GOOGLE_GENERATIVE_AI_API_KEY}"
}
```

ホスト側にキーが無ければ空文字が入るだけで、コンテナは問題なく起動します。使わないプロバイダのキーは設定しなくて構いません。

`~/.aws` `~/.ssh` `~/.config/gh` は読み取り専用でバインドマウントされます。

初回作成時に `.env.example` から `.env` が生成されます。**既存の `.env` は上書きしません。** 実キーを消す事故を防ぐためです。

## Biome + biome-plugins

Lint と Format は Biome に一本化しています（ESLint + Prettier の置き換え）。フォーマット設定はシングルクォート、セミコロン最小、末尾カンマあり、行幅100です。

```bash
bun run lint     # biome check
bun run format   # biome check --write
```

### GritQL プラグイン

`biome-plugins` は git submodule（[qtmleap/biome-plugins](https://github.com/qtmleap/biome-plugins)）で、GritQL で書かれた独自ルールを提供します。Zod ファーストの TypeScript スタイルを機械的に強制するのが目的です。

| プラグイン | 禁止／強制するもの |
| --- | --- |
| `no-type-assertion` | `as` による型アサーション |
| `no-let` | `let`（再代入を排除） |
| `no-while-loop` | `while` ループ |
| `no-nullish-coalescing` | `??` |
| `no-or-fallback` | `\|\|` によるフォールバック |
| `no-new-date` | `new Date()`（`Date.now()` を使う） |
| `no-bare-z-string` | 制約のない `z.string()` |
| `prefer-z-safe-parse` | `parse` より `safeParse` |
| `prefer-z-nonempty` | `z.string().nonempty()` |
| `prefer-z-url` / `prefer-z-uuid` | `z.url()` / `z.uuid()` |
| `no-tri-state-z-boolean` / `no-tri-state-z-array` | `boolean \| undefined` になるスキーマ |

最初は窮屈ですが、**LLMの出力を扱うコードでは `as` の禁止がそのまま安全性になります。** 返ってきた JSON を型アサーションで押し通す誘惑を、ツールが機械的に止めてくれるからです。

`??` と `||` の禁止は、コードベース全体で `x === undefined ? fallback : x` という明示的な形を強制します。実際に `provider.ts` や `cache/scenario.ts` がこの書き方で統一されているのはこのためです。

### submodule の取得

`biome.json` が `./biome-plugins/*.grit` を参照しているため、ファイルが無いと `biome check` が失敗します。

```bash
git clone --recursive <repo>
# 取り忘れたとき
git submodule update --init --recursive
```

CI は `submodules: recursive` で取得済みです。

## テスト

`bun test`（Bun 内蔵ランナー）で完結します。追加のテストランナー依存はありません。

```typescript
import app from '@/server/index'

test('GET /api/health responds ok', async () => {
  const res = await app.request('/api/health')
  expect(res.status).toBe(200)
})
```

`app.request()` でルーティングを検証できるのは、`index.ts` が `cloudflare:workers` を import していないからです（[runtime.md](./runtime.md) のエントリ二層構造を参照）。この分離を壊すとテストが Workers ランタイム外で動かなくなります。

### LLM 特有の評価

通常のテストに加えて、以下が必要です（未実装）。

| 対象 | 手法 |
| --- | --- |
| E2E | Playwright |
| プロンプトインジェクション | 攻撃プロンプト集を用意し、秘匿情報の漏洩を自動検査 |
| キャラクター一貫性 | 同一質問を複数回投げ、回答のブレと設定違反を LLM-as-judge で採点 |
| シナリオ解決可能性 | AIプレイヤーに解かせ、正答率と所要ターン数を計測 |

## CI / CD

`.github/workflows/` に3本入っています。

| ワークフロー | トリガ | 内容 |
| --- | --- | --- |
| `integration.yaml` | push（main以外）/ PR | commitlint / Biome check / 型チェック / ビルド / テストを並列ジョブで実行 |
| `deployment.yaml` | main・master への PR マージ / 手動 | `wrangler-action` で Cloudflare Workers へデプロイ |
| `update_dependencies.yaml` | 毎週月曜 | 依存と Node/Bun を更新して PR を作る |

全ジョブが `~/.bun/install/cache` をキャッシュし、`bun install --frozen-lockfile --ignore-scripts` で入れます。

デプロイに必要な GitHub Secrets は `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` です。**LLM の APIキーは渡しません。** `wrangler secret put ANTHROPIC_API_KEY` で登録済みである前提です。`wrangler.jsonc` の `vars` にはプロバイダ選択とレート制限値だけを置き、シークレットは入れません。

コミットメッセージは Conventional Commits です（`.commitlintrc.yaml`）。ローカルで CI を動かしたいときは Dev Container に入っている `act` が使えます（`.actrc` あり）。

## コマンド一覧

```bash
bun run dev          # Vite 開発サーバ（workerd 上で動く。DO も KV もそのまま使える）
bun run build        # tsc --noEmit + vite build
bun run deploy       # vite build + wrangler deploy

bun run typecheck    # 型チェックのみ
bun run lint         # Biome check
bun run format       # Biome check --write
bun test             # テスト

bun run db:generate   # マイグレーション生成（drizzle-kit）
bun run db:migrate    # ローカルのD1へ適用（wrangler）
bun run db:seed       # db/scenarios/*.yaml から投入用SQLを生成
bun run db:seed:apply # 生成したSQLをローカルのD1へ流す
```

## 観測（未実装）

LLMを使うサービスは、コスト可視化を後回しにすると必ず事故ります。README では以下が構想として挙げられています。

| 項目 | 候補 |
| --- | --- |
| エラー監視 | Sentry |
| LLMトレース | Langfuse または Braintrust |
| プロダクト分析 | PostHog |

現状 Workers の `observability.enabled: true` によるログのみで、`messages.usage` にトークン使用量を記録する土台だけが入っています。
