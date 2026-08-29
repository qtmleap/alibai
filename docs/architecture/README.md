# AlibAI アーキテクチャ

このディレクトリは AlibAI が採用している技術スタックと、その選定理由をまとめたものです。

ルートの `README.md` がプロダクトの**構想**を書いているのに対し、ここは**現在リポジトリに実装されている構成**を正典として記述します。両者が食い違う場合はこちらが実装に忠実です（差分は [構想と実装の差分](#構想と実装の差分) にまとめています）。

## ドキュメント一覧

| ファイル | 内容 |
| --- | --- |
| [runtime.md](./runtime.md) | 実行基盤・APIレイヤ・ビルドパイプライン |
| [data.md](./data.md) | 永続化・キャッシュ・状態管理の役割分担 |
| [llm.md](./llm.md) | LLMの役割分割、プロバイダ抽象、プロンプトキャッシュ |
| [cost.md](./cost.md) | 1プレイあたりのトークン消費、各社の無料枠、推奨構成 |
| [development.md](./development.md) | 開発環境・コード品質・CI/CD・テスト |

## 全体像

```text
           [ Client (React 19 / スマホ縦画面) ]
   シナリオ選択 → 探偵の設定 → 事件の記録 → 聞き込み → 推理 → リザルト
                              │  SSE
                              ▼
  ┌──────────────── Cloudflare Workers ────────────────┐
  │                                                     │
  │   Hono (src/server/index.ts)                        │
  │     ├─ withEnv ミドルウェア（Zodで env を検証）      │
  │     │                                               │
  │     ├─► RATE_LIMITER (DO)    使用量カウンタ          │
  │     ├─► SCENARIO_CACHE (KV)  キャラシート／一覧      │
  │     ├─► PLAY_SESSION (DO)    会話履歴・発見済み証拠   │
  │     └─► HYPERDRIVE ──► Neon (PostgreSQL 18)         │
  │                                                     │
  │   Vercel AI SDK                                     │
  │     ├─ Actor  streamText     NPCを演じる            │
  │     ├─ Judge  generateObject 証拠開示・矛盾判定      │
  │     └─ Author（未実装）      シナリオ作成支援        │
  └─────────────────────────────────────────────────────┘
```

## 技術スタック一覧

| レイヤ | 採用技術 | バージョン |
| --- | --- | --- |
| 実行基盤 | Cloudflare Workers | wrangler `^4` |
| APIフレームワーク | Hono | `^4` |
| UI | React + Tailwind CSS | `^19` / `^4` |
| ビルド | Vite（開発）/ wrangler（本番） | `^8` / `^4` |
| 言語 | TypeScript | `^7` |
| パッケージ管理・テスト | Bun | `^1` |
| DB | PostgreSQL (Neon) + Hyperdrive | 18 |
| ORM | Drizzle ORM / drizzle-kit | `^0.44` / `^0.31` |
| セッション状態・レート制限 | Durable Objects (SQLite backend) | — |
| 読みキャッシュ | Workers KV | — |
| LLM | Vercel AI SDK (Anthropic / OpenAI / Google) | `ai@^5` |
| バリデーション | Zod | `^4` |
| Lint / Format | Biome + biome-plugins (GritQL) | `^2` |

## 設計上の中心原則

### 1. 真実はサーバーにしか存在しない

シナリオの真相・犯人・秘匿キーワードは `scenario_truths` テーブルに隔離し、クライアントにも他NPCのプロンプトにも渡しません。テーブルを物理的に分けることで、クライアント向けクエリが誤って真相を JOIN する事故を構造的に防ぎます。

この原則はキャッシュ層にも適用され、`src/server/cache/scenario.ts` が触ってよいのは `scenarios` / `characters` までと明記されています。

### 2. 役者と審判を分ける

1つのモデルに「キャラを演じつつゲーム進行も管理して」と頼むと、演技が崩れるか判定が曖昧になります。Actor はストリーミングで演技に徹し、進行判定は Judge が構造化出力で返します。詳細は [llm.md](./llm.md)。

### 3. 状態は整合性モデルで置き場所を決める

会話履歴も証拠の発見も read-modify-write です。結果整合で同一キーへの書き込みが制限される KV では、エラーを出さないまま数が合わなくなります。Durable Object なら1インスタンスへの操作が直列化されるため、この競合が原理的に起きません。

一方で公開シナリオ一覧やキャラクターシートは読み主体で数秒古くても困らないため KV に置きます。判断基準は「壊れ方が静かかどうか」です。詳細は [data.md](./data.md)。

### 4. 設定はリクエストスコープで検証する

Workers の isolate はグローバルスコープにシークレットを持ちません。モジュールのトップレベルで env を読むとデプロイした瞬間に起動しなくなります。そのため環境変数の検証は `withEnv` ミドルウェアでリクエストに入ってから行い、isolate 内でメモ化します。

## 構想と実装の差分

ルート `README.md` は構想段階で書かれており、以下の点が現在の実装と異なります。ドキュメントを読む際はこちらを優先してください。

| 項目 | README（構想） | 現在の実装 |
| --- | --- | --- |
| デプロイ先 | GHCR へコンテナイメージを push | Cloudflare Workers へ `wrangler deploy` |
| KV / キャッシュ | Redis 8 | Workers KV + Durable Objects（compose に Redis なし） |
| 本番ビルド | `@hono/vite-build` | `@cloudflare/vite-plugin`（`vite build` → `dist/alibai/`） |
| Vite の役割 | サーバ・クライアント両方のビルド | 同じ（dev も workerd 上で動く） |
| Dev Container | app + PostgreSQL + Redis | app + PostgreSQL のみ |

Sentry / Langfuse / PostHog / Satori / Playwright は README に構想として挙げられていますが、まだ依存にも実装にも入っていません。
