# コストと無料枠

> **調査時点: 2026年8月。** 各社の枠と価格は改定が速く、Gemini は2025年12月に無料枠を大幅削減しています。ここに書いた数字は見積もりの出発点であって正典ではありません。採用前に各社の公式ダッシュボードで実数を確認してください。

## 1プレイあたりのトークン消費

コードの構造から積み上げた見積もりです。

**前提**

- 12ターン（ルート `README.md` のリザルト例が「質問回数 12」）
- NPC 3人に4回ずつ質問（履歴は NPC ごとに分離されるため、この配分が入力量を左右する）
- `GAME_RULES` 約200トークン、キャラクターシート約1,000トークン
- プレイヤーの発話が平均35トークン（上限は `max(500)` 文字）
- NPCの返答が150トークン（`maxOutputTokens: 1024` だが「短く返せ」という指示があるため上限には達しない）
- Judge の rubric 約800トークン、判定出力150トークン

| | 入力 | 出力 | 計 |
| --- | --- | --- | --- |
| Actor | 18,150 | 1,800 | 19,950 |
| Judge | 11,820 | 1,800 | 13,620 |
| **1プレイ合計** | | | **約33,600トークン** |

Actor の入力が伸びるのは会話履歴が累積するためです。同じNPCに聞き続けるほど1リクエストが重くなります。逆にNPCを切り替えると履歴がリセットされるので入力は軽くなりますが、キャッシュも別物になります（[llm.md](./llm.md) 参照）。

**リクエスト回数は1プレイ24回**です（Actor 12 + Judge 12）。後述しますが、この回数が Gemini では致命的に効きます。

## OpenAI: データ共有プログラム

入出力を OpenAI と共有することに同意した組織に、日次の無料トークンが付与されます。

| 対象 | 無料枠 |
| --- | --- |
| 大型モデル（Sol クラス） | 100万トークン/日 |
| 軽量クラス（Terra / Luna） | 1,000万トークン/日 |
| Usage Tier 1〜2 の場合 | それぞれ 25万 / 250万 |

- カウンタのリセットは **UTC 0時**
- 有効化できるのは**組織オーナーのみ**。データ共有設定ページからいつでもオプトアウト可能
- 枠を超えたリクエストは、**そのリクエスト全体**が通常課金になる。部分的に無料にはならない

**機密性とのトレードオフです。** 入出力が OpenAI と共有されるため、UGC でユーザー投稿シナリオを扱う段階に入ったら、投稿者への説明と利用規約の整備が先に必要になります。

### 遊べる回数

| 構成 | 1日のプレイ数 | ボトルネック |
| --- | --- | --- |
| Actor=Terra / Judge=Luna（1,000万を共有） | **約300** | トークン量 |
| 同上（枠が別々の場合） | 約500 | Actor のトークン量 |
| Usage Tier 1〜2（250万） | 約74 | トークン量 |

Terra と Luna が枠を共有するか個別かで倍近く変わります。公式の記述はカテゴリ単位の合算に読めますが、**実測して確認してください。**

Sol（Author）の100万はプレイでは一切消費しません。シナリオ作成専用です。1本あたり5万トークンと見積もっても**1日20シナリオ**は作れるため、UGC 立ち上げ期には十分な枠です。

## Google: Gemini 無料枠

**トークン量ではなく回数で切られる**のが決定的な違いです。

| 指標 | Flash 系のおおよその値 |
| --- | --- |
| RPM（分あたりリクエスト） | 10〜15（Flash-Lite は緩め） |
| TPM（分あたりトークン） | 250,000 |
| RPD（日あたりリクエスト） | 1,000〜1,500 |

- Pro 系は2026年に無料枠から外れ、無料で使うなら **Flash 一択**
- RPD のリセットは**太平洋時間の深夜0時**。ローリング24時間ではない
- 制限は **Google Cloud プロジェクト単位**。APIキーを増やしても枠は増えない
- **課金を有効にすると、そのプロジェクトの無料枠が完全に消える。** 無料枠に収まるはずのコールも最初のトークンから課金対象になる。他のGCPサービスと挙動が違うため要注意

数字は情報源によってブレが大きいため、Google AI Studio のダッシュボードで自分のプロジェクトの実数を見るのが確実です。

### AlibAI との相性が悪い理由

**1プレイで24リクエスト飛びます。**

```text
1,500 RPD ÷ 12リクエスト（Actor） = 125プレイ/日
```

このとき TPM はまったく問題になりません。Actor 1リクエストの入力は平均1,500トークン程度で、250,000 TPM に対して1%も使わないうちに RPD が尽きます。**トークンが余っているのに回数で止まる**という形です。

さらに RPM が同時プレイ数を制限します。

```text
1プレイ = 10分 / 12ターン ≒ 1.2 リクエスト/分
10 RPM ÷ 1.2 ≒ 同時8プレイまで
```

SNS で共有されて瞬間的にアクセスが来る、という AlibAI が狙っている流入の形と正面から衝突します。

## 推奨構成

無料枠で回す前提なら、**トークン量を OpenAI 側に寄せる**のが最適です。

| 優先度 | 構成 | 1日のプレイ数 |
| --- | --- | --- |
| 1 | Actor=Terra / Judge=Luna（OpenAI に統一） | 約300 |
| 2 | 上記を使い切ったら Gemini Flash 系へフォールバック | 約420 |
| 3 | Gemini のみ | 約125 |

Gemini を単独で使うより、**OpenAI の枠を使い切ってからのフォールバック先**として位置づけるほうが総量が伸びます。

ただしフォールバック機構は現在のコードに入っていません。`resolveModel` は env の設定を返すだけなので、実装するなら `resolveModel` の外側に「枠を使い切ったら別プロバイダで再試行する」層が必要です。使用量の判断材料は `messages.usage` に揃っています。

### Judge を毎ターン呼ばない選択肢

回数がボトルネックになる構成では、Judge の起動条件を絞ると効きます。

- 証拠の開示条件に関係しそうなキーワードが会話に出たときだけ起動する
- 数ターンまとめて判定する

ただし `suggestedQuestions`（次の質問候補）は毎ターン更新したいUI要素なので、体験とのトレードオフになります。

## 無料枠ではプロンプトキャッシュが効かない

**これは見落としやすい罠です。**

プロンプトキャッシュが下げるのは**単価**であって**トークン量**ではありません。無料枠が数えているのは量のほうです。キャッシュ読み込みトークンも量として計上されるなら、「1日300プレイ」という上限はキャッシュ設計をどれだけ丁寧にやっても動きません。

つまり、[llm.md](./llm.md) に書いたブレークポイント設計は、**無料枠で回している間は体感ゼロ**です。効き始めるのは課金に移行した瞬間からです。

無料枠のフェーズで追うべき指標は、キャッシュヒット率ではなく**総トークン量**です。ここを取り違えると「キャッシュを効かせたのにプレイ可能数が増えない」という誤った悩み方をします。見るべき数字がフェーズで変わる、と覚えておいてください。

## 課金移行後の見積もり

参考として、GPT-5.6 の価格です（2026年7月30日の値下げ後、100万トークンあたり）。

| モデル | 入力 | 出力 |
| --- | --- | --- |
| Sol | $5.00 | $30.00 |
| Terra | $2.00 | $12.00 |
| Luna | $0.20 | $1.20 |

出力は入力の6倍単価です。Actor の出力を短く保つ設計（`maxOutputTokens: 1024` と「返答は短く」という指示）は、体感テンポだけでなくコストにも直接効いています。

キャッシュ**なし**での1プレイ概算:

- Actor (Terra): 入力 18,150 × $2 + 出力 1,800 × $12 = **約 $0.058**
- Judge (Luna): 入力 11,820 × $0.2 + 出力 1,800 × $1.2 = **約 $0.0045**
- 合計 **約 $0.06 / プレイ**

ここでキャッシュが効き始めます。Actor の入力18,150のうち、`GAME_RULES` + キャラクターシートの約1,200トークンは毎ターン同一です。12ターン分で約14,400トークン、入力全体の8割弱がキャッシュ対象になります。プレフィックスを壊さない限り、この部分の単価が大きく下がります。

**ローンチ前に必ず実測してください。** キャッシュ設計が効いているかどうかで一桁変わります。

## 出典

- [Previewing GPT-5.6 Sol | OpenAI](https://openai.com/index/previewing-gpt-5-6-sol/)
- [GPT-5.6 Pricing 2026: Sol, Terra & Luna API Costs | CometAPI](https://www.cometapi.com/gpt-5-6-pricing/)
- [Sharing feedback, evaluation and fine-tuning data, and API inputs and outputs with OpenAI | OpenAI Help Center](https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai)
- [OpenAI Data Sharing and Complimentary Tokens Program | cloudcredits.io](https://cloudcredits.io/providers/openai/programs/openai-data-sharing-and-complimentary-tokens-program)
- [Good News! Extended: Free tokens on traffic shared with OpenAI | OpenAI Developer Community](https://community.openai.com/t/good-news-extended-free-tokens-on-traffic-shared-with-openai/1241322)
- [Gemini API Free Tier Rate Limits: Complete Guide for 2026 | AI Free API](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits)
- [Gemini API Rate Limits 2026: Complete Per-Tier Guide with All Models | AI Free API](https://www.aifreeapi.com/en/posts/gemini-api-rate-limits-per-tier)
- [Gemini API Free Tier Limits 2026: the Billing Trap That Deletes Them | UsageBox](https://usagebox.com/articles/gemini-api-billing-free-tier-confusion)
