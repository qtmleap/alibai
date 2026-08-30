# Scenario Definition Format

AlibAI のシナリオを、人間・LLM・ゲームエンジンのどれから見ても曖昧にならない形で定義するための仕様です。

> この文書は**なぜこの形式なのか**を説明する設計文書です。
> 実際に一本書くための手順と規則は [`../scenario-authoring.md`](../scenario-authoring.md) にあります。
> あちらは Author LLM のシステムプロンプトとしてそのまま読み込まれます。

この文書では **シナリオの編集形式** と **実行時データ** を分けて考えます。

- 人間が読む・Git でレビューする形式: **YAML**
- Author LLM が生成する形式: **JSON / Structured Output**
- 厳密な構造検証: **Zod を正典にし、必要に応じて JSON Schema を生成**
- 実行時: 検証済みデータを PostgreSQL の `scenarios` / `scenario_truths` / `characters` / `evidences` に分解して保存

YAML 自体はスキーマではなく、あくまでシリアライズ形式です。YAML の見た目だけを仕様にすると、必須項目・参照整合性・列挙値などを厳密に保証できません。

## 1. 基本方針

### 1.1 Authoring Source と Runtime を分離する

シナリオ作者や Author LLM が扱う「一つの事件」は、レビューしやすい単一の論理ドキュメントとして表現します。

一方、実行時には秘匿境界を守るため、そのまま一枚の JSON として扱いません。

```text
scenario.yaml / Author の JSON
        │
        ▼
   parse + validate
        │
        ▼
 semantic validation
        │
        ▼
      compile
        │
        ├── scenarios
        ├── scenario_truths   ← Actor から隔離
        ├── characters
        └── evidences
```

この分離により、編集時の扱いやすさと、実行時の情報漏洩防止を両立します。

### 1.2 文章ではなく ID で事実を参照する

同じ事実を複数箇所へ文章としてコピーすると、修正時に食い違います。

そのため、重要な事実・時系列イベント・証拠・人物にはシナリオ内で一意なローカル ID を付け、他の要素からは ID で参照します。

```yaml
facts:
  - id: b_seen_at_corridor
    statement: 18:10 に B が美術室前の廊下にいた

characters:
  - id: a
    knowledge:
      - b_seen_at_corridor
```

DB に保存するときは UUID に変換して構いません。作者に UUID を手書きさせる必要はありません。

### 1.3 「世界の事実」と「人物の発言」を分ける

世界で実際に起きたことは `facts` / `timeline` に置きます。

人物が何を知っているかは `knowledge`、隠したいことは `secrets`、意図的に話す虚偽は `lies` に置きます。

Actor は真相全体を受け取らず、その人物に許された情報だけから発話します。

## 2. ファイル形式

### 2.1 推奨ファイル

```text
scenarios/
  stolen-painting/
    scenario.yaml
```

画像・音声などのアセットが増えた場合は同じディレクトリに置きます。

```text
scenarios/
  stolen-painting/
    scenario.yaml
    assets/
      room.webp
      evidence-note.webp
```

### 2.2 YAML を採用する理由

YAML は次の用途に向いています。

- 長い文章を `|` で自然に書ける
- Git の diff が読みやすい
- コメントを書ける
- 人間が手で修正しやすい

一方、LLM に直接 YAML の厳密な出力を要求する必要はありません。Author LLM には Structured Output で JSON を生成させ、同じ Zod スキーマで検証した後に YAML へシリアライズします。

これにより、LLM 出力では JSON Schema 系の制約を利用しつつ、人間は YAML を編集できます。

## 3. トップレベル構造

MVP では次の構造を正規形とします。

```yaml
schemaVersion: 1
id: stolen-painting

meta: {}
briefing: ""
floorPlan: null

facts: []
timeline: []
characters: []
evidences: []
solution: {}
quality: {}
```

### `schemaVersion`

必須。整数。

破壊的変更を行う場合に増やします。Importer は未知のバージョンを黙って受理してはいけません。

### `id`

必須。シナリオ内・リポジトリ内で一意な slug。

推奨形式:

```text
^[a-z0-9][a-z0-9-]{2,63}$
```

## 4. `meta`

プレイヤーへ公開してよいメタ情報です。

```yaml
meta:
  title: 消えたコンクール作品
  synopsis: 放課後の美術室から、提出直前の作品が消えた。
  category: 学園ミステリー
  difficulty: 2
  estimatedMinutes: 10
  tags:
    - theft
    - school
```

必須:

- `title`: 1〜100文字
- `synopsis`: 1〜500文字
- `category`: 短い表示用ラベル
- `difficulty`: 1〜5
- `estimatedMinutes`: 原則 5〜30

`tags` は任意です。

## 5. `briefing`

ゲーム開始時にプレイヤーへ提示する事件の記録です。

```yaml
briefing: |
  放課後18時30分、美術室からコンクール提出予定の作品がなくなっていることが分かった。

  作品が最後に確認されたのは18時00分。校内に残っていた関係者は三人だった。
```

ここには犯人・真相・未発見の証拠などを書いてはいけません。

Importer の semantic validation では `solution.secretKeywords` と照合し、明白な秘匿語が含まれていないことを検査します。

## 6. `floorPlan`

現行の `db/floor-plan.ts` が定義する論理座標形式に従います。

地図が不要なシナリオでは `null` にできます。

シナリオ定義側で別の地図形式を増やさず、Runtime と同じ型を再利用します。

## 7. `facts`

事件世界において真偽が固定された、原子的な事実の一覧です。

```yaml
facts:
  - id: painting_present_at_1800
    statement: 18:00 の時点では作品は美術室にあった
    kind: observation

  - id: b_seen_at_1810
    statement: 18:10 に B は美術室前の廊下にいた
    kind: observation

  - id: b_took_painting
    statement: B が作品を持ち出した
    kind: truth
    secret: true
```

必須:

- `id`: シナリオ内一意
- `statement`: 文脈なしで意味が通る一文

任意:

- `kind`: `observation | physical | testimony | motive | truth | other`
- `secret`: プレイヤーへ直接公開してはいけない事実なら `true`

一つの `statement` に複数の独立事実を詰め込まないことを推奨します。

## 8. `timeline`

事件世界で実際に起きた出来事です。

```yaml
timeline:
  - id: artwork_last_checked
    at: "18:00"
    location: art-room
    participants:
      - teacher
    facts:
      - painting_present_at_1800

  - id: b_leaves_room
    at: "18:10"
    location: corridor
    participants:
      - b
    facts:
      - b_seen_at_1810
```

必須:

- `id`
- `at`
- `facts`

任意:

- `location`
- `participants`
- `description`

時刻は一日の事件なら `HH:mm` を基本にします。日を跨ぐ事件では ISO 8601 形式の日時を利用します。

同一事件内で時刻形式を混在させてはいけません。

## 9. `characters`

```yaml
characters:
  - id: a
    name: 美術部員 A
    role: witness

    personality: |
      真面目で慎重。断定できないことは断定しない。

    goals:
      - 自分が疑われないよう、知っていることには正直に答える

    knowledge:
      - painting_present_at_1800
      - b_seen_at_1810

    secrets: []

    lies: []

    memories:
      - id: saw_b
        about: b_seen_at_1810
        detail: 18:10ごろ、Bと廊下ですれ違った。

    relationships:
      - character: b
        relation: 同じ美術部員
        attitude: 少し競争心がある
```

### 必須フィールド

- `id`
- `name`
- `personality`
- `knowledge`
- `secrets`
- `goals`
- `lies`
- `memories`

`knowledge` は原則 `facts[].id` の参照です。

### `secrets`

人物が知っているが、自発的には話したくない情報です。

```yaml
secrets:
  - fact: b_took_painting
    disclosure: never
```

`disclosure` の候補:

- `never`: 通常の会話では認めない
- `pressured`: 十分な追及や証拠提示で話す可能性がある
- `voluntary`: 条件が揃えば自発的に話してよい

### `lies`

嘘は自由文だけでなく「何について、何と偽るか」を構造化します。

```yaml
lies:
  - id: b_alibi
    about: b_seen_at_1810
    claim: 18:10ごろは図書室にいた
    strategy: maintain-until-contradicted
```

`strategy` の候補:

- `maintain`: 最後まで維持する
- `maintain-until-contradicted`: 反証されるまでは維持する
- `evasive`: 直接の虚偽より回避を優先する

Actor に「適当に嘘をつく」裁量を渡してはいけません。嘘もシナリオの事実として作者が定義します。

## 10. `evidences`

```yaml
evidences:
  - id: security-log
    label: 廊下の入退室記録
    description: 18:08から18:12の間にBのカードが美術室前で記録されている。

    reveal:
      mode: conversation
      condition: 入退室記録や廊下の人の動きについて具体的に尋ねる

    supports:
      - b_seen_at_1810

    contradicts:
      - lie:b_alibi
```

必須:

- `id`
- `label`
- `reveal.condition`

任意:

- `description`
- `supports`
- `contradicts`

Runtime の現行 `evidences` テーブルには `label` と `revealCondition` だけを保存しています。`supports` / `contradicts` は Author・Validator がシナリオ品質を検証するための authoring metadata として扱い、MVP では DB に保存しなくても構いません。

## 11. `solution`

真相とクリア条件です。Runtime では `scenario_truths` に隔離されます。

```yaml
solution:
  culprit: b

  summary: |
    Bは自分の作品を優先して選考に出したいと考え、18:10ごろ美術室からAの作品を持ち出した。

  motive: competition

  requiredFacts:
    - b_seen_at_1810
    - b_took_painting

  secretKeywords:
    - Bが作品を持ち出した
```

必須:

- `culprit`
- `summary`
- `requiredFacts`
- `secretKeywords`

`culprit` は必ず `characters[].id` を参照します。

`requiredFacts` は「論理的に正解へ到達するために最低限必要な事実」です。AI プレイヤーによる解決可能性テストでも利用します。

犯人が一人ではないシナリオ形式が必要になった時点で、`culprit` を `culprits` へ変更するのではなく schemaVersion を上げます。曖昧な union を初期仕様へ持ち込まない方針です。

## 12. `quality`

ゲームとしての意図を機械評価に渡すための補助情報です。

```yaml
quality:
  expectedQuestionCount:
    min: 4
    max: 12

  requiredEvidence:
    min: 1

  redHerrings:
    - teacher_had_key

  notes: |
    Bのアリバイ崩しが主経路。鍵の紛失は補助的なミスリード。
```

この節はプレイ中の Actor には渡しません。

## 13. 完全な最小例

```yaml
schemaVersion: 1
id: stolen-painting

meta:
  title: 消えたコンクール作品
  synopsis: 放課後の美術室から、提出直前の作品が消えた。
  category: 学園ミステリー
  difficulty: 2
  estimatedMinutes: 10
  tags: [theft, school]

briefing: |
  放課後18時30分、美術室からコンクール提出予定の作品がなくなっていることが分かった。
  作品が最後に確認されたのは18時00分だった。

floorPlan: null

facts:
  - id: painting_present_at_1800
    statement: 18:00 の時点では作品は美術室にあった
    kind: observation

  - id: b_seen_at_1810
    statement: 18:10 に B は美術室前の廊下にいた
    kind: observation

  - id: b_took_painting
    statement: B が作品を持ち出した
    kind: truth
    secret: true

timeline:
  - id: last_check
    at: "18:00"
    location: art-room
    participants: [teacher]
    facts: [painting_present_at_1800]

  - id: theft
    at: "18:10"
    location: art-room
    participants: [b]
    facts: [b_took_painting, b_seen_at_1810]

characters:
  - id: a
    name: 美術部員 A
    role: witness
    personality: 真面目で慎重。
    goals:
      - 知っていることには正直に答える
    knowledge:
      - painting_present_at_1800
      - b_seen_at_1810
    secrets: []
    lies: []
    memories:
      - id: saw_b
        about: b_seen_at_1810
        detail: 18:10ごろ、Bと廊下ですれ違った。
    relationships:
      - character: b
        relation: 同じ美術部員
        attitude: 少し競争心がある

  - id: b
    name: 美術部員 B
    role: suspect
    personality: 負けず嫌い。追及されると防御的になる。
    goals:
      - 自分が作品を持ち出したことを隠す
    knowledge:
      - b_seen_at_1810
      - b_took_painting
    secrets:
      - fact: b_took_painting
        disclosure: never
    lies:
      - id: b_alibi
        about: b_seen_at_1810
        claim: 18:10ごろは図書室にいた
        strategy: maintain-until-contradicted
    memories:
      - id: took_painting
        about: b_took_painting
        detail: 作品を鞄に入れて美術室から持ち出した。
    relationships:
      - character: a
        relation: 同じ美術部員
        attitude: 強い競争心がある

evidences:
  - id: security-log
    label: 廊下の入退室記録
    description: 18:08から18:12の間にBのカードが美術室前で記録されている。
    reveal:
      mode: conversation
      condition: 入退室記録や廊下の人の動きについて具体的に尋ねる
    supports:
      - b_seen_at_1810
    contradicts:
      - lie:b_alibi

solution:
  culprit: b
  summary: Bが18:10ごろ美術室から作品を持ち出した。
  motive: competition
  requiredFacts:
    - b_seen_at_1810
    - b_took_painting
  secretKeywords:
    - Bが作品を持ち出した

quality:
  expectedQuestionCount:
    min: 4
    max: 12
  requiredEvidence:
    min: 1
  redHerrings: []
```

## 14. 検証レイヤ

検証は三段階に分けます。

### Level 1: Syntax

YAML / JSON として読み込めるか。

ここでは意味を判断しません。

### Level 2: Structural Validation

Zod で型・必須項目・列挙値・文字数・数値範囲を検証します。

例:

- `schemaVersion === 1`
- `difficulty` が 1〜5
- `estimatedMinutes` が許容範囲
- `characters` が最低2人
- `solution.culprit` が空でない

Author LLM の Structured Output も同じ構造を使います。

### Level 3: Semantic Validation

型だけでは検出できない、シナリオ固有の整合性を検査します。

最低限、次を機械的に検査します。

1. すべてのローカル ID が同一 namespace 内で一意
2. `knowledge` / `about` / `supports` / `requiredFacts` の参照先が存在する
3. `solution.culprit` が存在する人物を指す
4. `timeline.participants` が存在する人物を指す
5. `lie:*` が存在する嘘を指す
6. `briefing` / 公開メタ情報に `secretKeywords` が含まれない
7. Actor 用キャラクターシートへ他人物の秘密や `solution.summary` が混入しない
8. `requiredFacts` の各要素に、プレイヤーが到達できる情報経路が最低一つ存在する
9. 互いに両立しない truth fact が存在しない
10. 時系列に明らかな自己矛盾がない

8〜10 は静的検査だけで完全には判定できないため、Author/Critic LLM によるレビューも併用します。

## 15. Author エージェントの生成手順

Author は一発で完成 YAML を書くのではなく、段階的に生成します。

```text
1. Premise
   事件の種類、舞台、想定プレイ時間、難易度を決める

2. Ground Truth
   犯人・動機・実際の時系列・決定的な事実を先に固定する

3. Information Distribution
   各人物がどの事実を知るか、何を隠すか、どんな嘘をつくか決める

4. Evidence Graph
   requiredFacts にプレイヤーが到達できる経路を作る

5. Public Layer
   synopsis / briefing を作る。真相は含めない

6. Structural Validation
   Zod で検証

7. Semantic Critic
   別の推論パスで矛盾・情報漏洩・一本道すぎる箇所を検査

8. AI Playtest
   真相を知らない Player エージェントに実際に解かせる

9. Finalize
   合格したものだけ YAML と DB に保存する
```

この順番で重要なのは、**真相を先に固定してから会話可能な情報を配る**ことです。

登場人物を先に自由生成して後から辻褄を合わせると、LLM がもっとも苦手な長距離整合性問題になります。

## 16. AI Playtest の合格条件

最低限、次を計測します。

- 正答できるか
- `requiredFacts` のうち何個に到達したか
- 正答までの質問数
- 所要ターン数
- 重要証拠を一つも得ずに当てずっぽうで正解できていないか
- 複数回プレイして、特定の偶然の発話に依存していないか

10分想定のシナリオなら、Author が狙った質問数レンジを `quality.expectedQuestionCount` に持たせ、極端に長い・短いケースを落とします。

## 17. 現行 DB へのコンパイル

初期実装では authoring model の情報を次のように変換します。

| Authoring | Runtime |
| --- | --- |
| `meta.title` | `scenarios.title` |
| `meta.synopsis` | `scenarios.synopsis` |
| `briefing` | `scenarios.briefing` |
| `floorPlan` | `scenarios.floor_plan` |
| `meta.category` | `scenarios.category` |
| `meta.difficulty` | `scenarios.difficulty` |
| `meta.estimatedMinutes` | `scenarios.estimated_minutes` |
| `solution.culprit` | `scenario_truths.culprit_character_id` |
| `solution.summary` | `scenario_truths.truth` |
| `timeline` | `scenario_truths.timeline` |
| `solution.secretKeywords` | `scenario_truths.secret_keywords` |
| `characters[].personality` | `characters.personality` |
| compiled `knowledge` | `characters.knowledge` |
| compiled `secrets` | `characters.secrets` |
| compiled `goals` | `characters.goals` |
| compiled `lies` | `characters.lies` |
| compiled `memories` | `characters.memories` |
| `evidences[].label` | `evidences.label` |
| `evidences[].reveal.condition` | `evidences.reveal_condition` |

`facts`、`relationships`、`supports`、`contradicts`、`quality` は当面 Authoring/Validation 用の情報です。必要になった段階で Runtime schema を拡張します。

## 18. 秘匿境界

Authoring ファイルには一つの事件として真相も含まれますが、**Runtime では必ず分離**します。

Actor に渡してよいのは、その人物自身についてコンパイルされた次の情報までです。

- personality
- knowledge
- secrets
- goals
- lies
- memories
- 必要な範囲の relationship

次は Actor に渡してはいけません。

- `solution.summary`
- 他人物だけが知る fact
- 他人物の secrets / lies / memories
- `quality`
- シナリオ全体の真相 timeline

「プロンプトで見ないよう指示する」ではなく、「最初から渡さない」を基本防御にします。

## 19. 正典の扱い

実装時には同じルールを三箇所へ手書きしません。

推奨:

1. `ScenarioDefinitionSchema` を Zod で定義
2. TypeScript 型は `z.infer` から生成
3. Author の Structured Output もこのスキーマを利用
4. 外部ツール用 JSON Schema が必要なら Zod から生成
5. YAML importer も同じ Zod schema で検証

これにより、YAML 用仕様・LLM 用仕様・TypeScript 型がずれる事故を避けます。

この Markdown は設計意図を説明する文書であり、実装後の最終的な機械可読な正典は Zod schema とします。
