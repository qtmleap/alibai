# データと状態管理

AlibAI は3つのストレージを使い分けます。どこに置くかは**壊れ方**で決めています。

| ストレージ | 置くもの | 理由 |
| --- | --- | --- |
| Cloudflare D1 | シナリオ、真相、会話ログ、リザルト | 正典。失われてはいけないもの |
| Durable Objects | 進行中セッション、レート制限カウンタ | read-modify-write が直列化される必要がある |
| Workers KV | 公開シナリオ一覧、キャラクターシート | 読み主体で、数秒古くても誰も困らない |

## D1 + Drizzle

### なぜ D1 か

正典を Cloudflare の外に置かないためです。以前は Neon (PostgreSQL) を Hyperdrive 経由で見ていましたが、それだと接続プールのためのバインディングと、postgres.js が TCP を張るための `nodejs_compat`、そして Cloudflare の外にある課金対象が付いてきます。D1 はランタイムに同居する SQLite で、バインディングを1本受け取るだけで読み書きできます。

```typescript
export const createDb = (d1: D1Database) => drizzle(d1, { schema })
```

ここでは接続を張りません。D1 のバインディングはランタイムが用意した RPC のハンドルなので、プールも起動時の型カタログ取得も存在せず、リクエストごとに呼んでも実費はかかりません。それでも関数の形を残しているのは、`read/` や `cache/` の層がバインディングを知らないまま `Db` だけを引数で受け取れるようにするためです。

### SQLite であることの帰結

Postgres から移るにあたって、型の対応は `db/schema.ts` の中で吸収しています。TypeScript 側の型は移行前と同じままです。

- 主キーは `text` + `crypto.randomUUID()`。SQLite に `uuid` 型も `gen_random_uuid()` もありません
- `jsonb` と配列列は `text({ mode: 'json' })`。`secret_keywords` は物理的には JSON テキストですが、読み書きは今までどおり `string[]` です
- 時刻は `integer({ mode: 'timestamp' })` で epoch **秒**。既定値は SQL 側の `(unixepoch())` に置いています。保持期間の削除が SQL で境界を比較し、seed も SQL 文を吐くので、両方から同じ既定値が見える必要があるためです

**トランザクションはありません。** D1 は文ごとに自動コミットで、対話的トランザクションを提供しません。複数文をまとめたいときは `batch()` を使います。seed が SQL ファイルを書き出す形になっているのも、元をたどればこの制約です。

### Drizzle ORM

スキーマは `db/schema.ts` に TypeScript で定義し、`drizzle-kit` がマイグレーションを生成します。型がスキーマ定義から直接導出されるため、`characters.$inferSelect` のような形でクエリ結果の型をそのまま使えます。

```bash
bun run db:generate   # スキーマ差分からマイグレーションSQLを生成
bun run db:migrate    # ローカルのD1へ適用
bun run db:seed       # db/scenarios/*.yaml から投入用SQLを生成
bun run db:seed:apply # 生成したSQLをローカルのD1へ流す
```

生成は drizzle-kit、適用は wrangler、という分担です。`drizzle.config.ts` は接続先を持たず、資格情報も知りません。`wrangler.jsonc` の `migrations_dir` が drizzle の出力先を指しているので、ディレクトリは1つを共用します（drizzle が併置する `meta/` は wrangler が無視します）。

### テーブル構成

```text
scenarios          シナリオ本体（公開設定、難易度、想定プレイ時間、事件の記録、見取り図）
scenario_truths    真相（サーバー限定。APIレスポンスに絶対含めない）
characters         登場人物（公開紹介・人格・知識・秘密・目的・嘘・記憶）
evidences          証拠（Judgeが開示を判定するための条件文）
play_sessions      プレイセッション（匿名可。プレイヤーが演じる探偵を持つ）
messages           会話ログ（NPC別、トークン使用量・プロバイダ・モデルも記録）
discoveries        発見済み証拠（session_id + evidence_id の複合主キー）
results            結果（解決時間、質問回数、正解率）
reports            UGC通報
```

設計上の要点が3つあります。

**`scenario_truths` の分離。** 真相・犯人・時系列・秘匿キーワードを `scenarios` から切り出しています。テーブルを分けておけば、クライアント向けのクエリで誤って真相を JOIN する事故を構造的に防げます。Actor 向けのプロンプト組み立てでも参照しません。

**`characters` は公開紹介とNPC内部情報を分離する。** `public_introduction` だけがプレイヤー向けで、Actor の人物固有情報には使いません。Actor のキャラクターシートは、全員が共有する `scenarios.briefing` と、そのNPC自身の `personality` / `knowledge` / `secrets` / `goals` / `lies` / `memories` の6列から組み立てます。他人物の秘密や真相はここに入りません。

**`play_sessions.user_id` が nullable。** 匿名プレイを一級市民として扱うためです。「URLから即プレイ」を掲げる以上、ログイン壁は致命的になります。

**`messages.usage` にトークン使用量を記録。** LLMを使うサービスはコスト可視化を後回しにすると事故ります。`provider` / `model` も併記し、プロバイダ別・シナリオ別に集計できるようにしています。

**`scenarios.briefing` と `scenarios.floor_plan` は一覧に載せない。** 前者はゲームマスターが読み上げる事件の記録（空行区切りの段落）、後者は UI が SVG で描くための論理座標です。どちらも `GET /api/scenarios/:id` でだけ返します。選ぶ画面に長文と図が並ぶと、遊び始める前に読み疲れるためです。一覧が返すのはタイトル・カテゴリ・登場人物数・難易度・所要時間だけです。

**`play_sessions.detective` は開始時に決めたら変えない。** プレイヤーが演じる探偵（名前・年ごろ・性別・容姿）で、Actor のプロンプトに入ります。年ごろと性別は `db/detective.ts` の列挙が正典で、自由記述ではありません。NPC の呼びかけ（老人が十代の少女に「お嬢さん」と話しかける類）をこの2つから引くため、「28」「三十路」と書き方が割れると引けなくなります。会話の途中で変わるとキャッシュのプレフィックスが崩れるうえ、NPC から見て相手が別人になります。名乗らずに始めることもできるので nullable です。

## Durable Objects

DO は SQLite バックエンドで作成しています（`wrangler.jsonc` の `new_sqlite_classes`）。

### PlaySession

1プレイセッション = 1インスタンス。`idFromName(sessionId)` で引きます。

保持するのは、開始時刻・質問数・発見済み証拠ID・終了フラグ、そして**NPCごとに分離された会話履歴**です。

```typescript
const historyKey = (characterId: string) => `history:${characterId}`
```

キーの形で「他NPCとの会話を混ぜない」という設計を強制しています。Aへの質問がBの履歴に混ざると、Bが知らないはずのことを知っている状態になり、推理ゲームの整合性が崩れます。

`finish()` は冪等です。すでに終了済みなら `finished: true` をそのまま返すため、リトライや二重送信でリザルトが重複しません。

DO はあくまで**進行中の作業領域**であり、正典は D1 です。DO が失われても復元できるよう、DB への書き出しは Worker 側が担当します。書き出しが済んだセッションは `dispose()` で明示的に捨てます（DO のストレージは消さない限り残り続けます）。

### RateLimiter

ユーザー（未認証なら `cf-connecting-ip`）ごとの LLM 使用量カウンタです。固定ウィンドウ方式で、`consume()` が1回分を消費して可否を返します。

上限とウィンドウ幅を引数で受け取るのは意図的です。値の出どころは環境変数であり、DO 自身が env を検証する責務を持ちません。設定の解釈は Worker 側に一本化しています。

既定は1時間あたり60回（`RATE_LIMIT_MAX_CALLS` / `RATE_LIMIT_WINDOW_SECONDS`）。超過時は `resetAt` を含む 429 を返します。

### なぜ KV ではないか

どちらも read-modify-write です。KV は結果整合で、同一キーへの高頻度な書き込みが期待通りに反映されません。カウンタなら「上限を超えた分だけ静かに漏れる」、履歴なら「数が合わない」という、**エラーを出さずに壊れる**形になります。

DO は1インスタンスへの操作が直列化されるため、この競合が原理的に起きません。

## Workers KV

読み主体で、数秒古くても誰も困らないものだけを置きます。

| キー | 内容 | TTL |
| --- | --- | --- |
| `character:v2:{id}` | 公開事件記録を含む組み立て済みキャラクターシート | 3600秒 |
| `scenarios:published` | 公開シナリオ一覧（JSON） | 60秒 |

キャラクターシートは会話中まったく変化しないので、毎ターン DB を叩くのは無駄です。`loadCharacterSheet()` が KV → DB の順に引き、DB から取った場合は Markdown に組み立てて KV へ書き戻します。

シナリオを編集したら `invalidateScenario()` で明示的に消します。TTL 任せにすると、直したはずの誤字が最大1分残り続けます。

**この層に `scenario_truths` を持ち込まないこと。** テーブルを分離した防御が、キャッシュ層で並べ直した瞬間に無意味になります。`src/server/cache/scenario.ts` が触ってよいのは `scenarios` / `characters` までです。

## ローカル開発時の接続

**接続先はありません。** wrangler が `.wrangler/state` 配下に SQLite の実体を持ち、`bun run dev`（vite dev の workerd）も `bun run db:*`（wrangler CLI）も同じファイルを見ます。データベースのコンテナも接続文字列も要りません。

初回に遊べる状態を作るには:

```bash
bun run db:migrate                    # .wrangler/state にテーブルを作る
bun run db:seed && bun run db:seed:apply
```

本番用のIDは `wrangler d1 create alibai` で発行し、`wrangler.jsonc` の `REPLACE_WITH_D1_DATABASE_ID` を置き換えます。KV も同様に `wrangler kv namespace create SCENARIO_CACHE` で発行します。リモートへ流すときは `db:migrate:remote` / `db:seed:apply:remote` を使います。
