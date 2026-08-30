import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { z } from 'zod'
import { floorPlanSchema, validateFloorPlan } from './floor-plan'
import { TSUKIMISOU_PLAN } from './floor-plans/tsukimisou'
import { characters, evidences, revelations, scenarios, scenarioTruths } from './schema'

/**
 * 遊べるシナリオを1本 DB に投入するシードスクリプト。
 * `bun run db/seed.ts` で実行する。Workers ランタイムは経由しないので
 * Hyperdrive は使わず、drizzle-kit と同じく .env の DATABASE_URL に直接つなぐ。
 * db と app は別コンテナのため、接続先は `db:5432`（`localhost` では届かない）。
 */

const parsedDatabaseUrl = z.url().safeParse(process.env.DATABASE_URL)

if (!parsedDatabaseUrl.success) {
  throw new Error('DATABASE_URL が不正か未設定です。.env を確認してください。')
}

const sql = postgres(parsedDatabaseUrl.data, { max: 1 })
const db = drizzle(sql)

// 何度流しても壊れないように、同タイトルの既存シナリオを先に消す。
// characters / evidences / scenario_truths は scenarios への外部キーが
// onDelete: 'cascade' なので、scenarios の行を消すだけで芋づる式に片付く。
const SCENARIO_TITLE = '月見荘、十七回忌の夜'

/**
 * ゲームマスターが読み上げる事件の記録。段落は空行で区切り、UIが1段落ずつ開く。
 *
 * ここに書いてよいのは、プレイヤーが聞き込みを始める前に知っていて当然のことだけ。
 * 毒物の種類・入手経路・誰がいつ書斎に入ったかは書かない。読んだ時点で犯人が
 * 絞れてしまったら、この10分は聞き込みではなく答え合わせになる。
 */
const BRIEFING = `——事件の記録を読み上げます。

十月十四日、午後七時。老舗旅館「月見荘」の離れに、四人の男女が集まりました。女将の高瀬涼子が、十七年前に亡くなった夫の法要を兼ねて開いた、ごく内輪の夕食会です。招かれたのは、涼子と長く関わってきた三人でした。

夕食会は和やかに進み、午後八時三十分、書斎から悲鳴が上がります。駆けつけた者が見たのは、机に突っ伏したまま動かない涼子の姿でした。手元には、飲みかけのブランデーのグラスが一つ。後の検死で、涼子の体内からは毒物の反応が出ています。事故でも病でもありません。

その夜、離れにいたのはこの三人です。深川誠也、月見荘の経理を長年任されてきた税理士。早坂美月、涼子の従妹で、親戚の中でもとりわけ可愛がられてきた女性。桐生涼、涼子の幼なじみであり、かかりつけの医師。

三人は口をそろえて「自分は書斎に近づいていない」と言います。ですが、誰かが嘘をついています。夕食会が始まってから悲鳴が上がるまでの一時間半、誰が、いつ、どこにいたのか。証言はどこかで必ず食い違います。

あなたは、この事件を調べるために呼ばれました。三人に会い、話を聞き、矛盾を見つけてください。確信が持てたら、犯人を指し示す。それがあなたの仕事です。

——では、聞き込みを始めましょう。`

const seed = async () => {
  // 図面は投入前に検査する。重なった矩形や枠外の部屋は、DBに入ってしまうと
  // 画面が崩れて初めて気づくことになる。ここで落としておけば直す場所が明確。
  //
  // 先に safeParse を通すのは、検査も描画も既定値の埋まった形を前提にしているから。
  // 埋めた結果をそのまま投入するので、新しく入る行には扉も種別も揃っている。
  const parsedPlan = floorPlanSchema.safeParse(TSUKIMISOU_PLAN)

  if (!parsedPlan.success) {
    throw new Error(
      `見取り図の形が不正です:\n${parsedPlan.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    )
  }

  const issues = validateFloorPlan(parsedPlan.data)

  if (issues.length > 0) {
    throw new Error(
      `見取り図が図面として成立していません:\n${issues.map((issue) => `  - ${issue.message}`).join('\n')}`,
    )
  }

  await db.delete(scenarios).where(eq(scenarios.title, SCENARIO_TITLE))

  const [scenario] = await db
    .insert(scenarios)
    .values({
      title: SCENARIO_TITLE,
      synopsis:
        '老舗旅館「月見荘」の女将・高瀬涼子は、亡き夫の十七回忌を兼ねた内輪の夕食会を開いた。集まったのは涼子と縁の深い3人。会がお開きになって間もなく、涼子は書斎で冷たくなっているのが見つかった。手元には飲みかけのブランデー。夕食会の間、誰が、いつ、どこにいたのか——3人の証言を突き合わせ、真犯人を見つけ出そう。',
      briefing: BRIEFING,
      floorPlan: parsedPlan.data,
      category: '館もの',
      isPublished: true,
      difficulty: 2,
      estimatedMinutes: 10,
    })
    .returning()

  if (scenario === undefined) {
    throw new Error('scenarios への insert に失敗しました。')
  }

  // 3人の証言だけで矛盾が浮かぶように、各人の knowledge には
  // 自分が直接見聞きしたことだけを書く。他人の秘密や動機は書かない。
  const insertedCharacters = await db
    .insert(characters)
    .values([
      {
        scenarioId: scenario.id,
        name: '深川誠也',
        personality:
          '気弱で愛想笑いが多い税理士。人当たりは柔らかいが、追い詰められるとしどろもどろになり目が泳ぐ。涼子には昔から頭が上がらない。',
        knowledge:
          '「月見荘」の経理を長年任されている。19時からの夕食会に同席していたが、19時15分ごろ電話のため一時的に席を外し、19時45分ごろ食堂に戻った。涼子は19時20分ごろ書斎に移動して一人で仕事をしていたのを見ている。20時ごろ、美月がブランデーのグラスを持って書斎に向かうのを見かけた。20時30分、美月の悲鳴で涼子の死を知った。',
        secrets:
          '旅館の運転資金からおよそ300万円を無断で流用し、愛人への貢ぎに充てていた。前日、涼子に硬い声で「明日、ちゃんと話しましょう」と横領の件を問い詰められかけている。19時15分から19時45分の間、実際には書斎ではなく旅館の外にある電話ボックスで愛人と電話していた。',
        goals:
          '横領が誰にもバレないまま今夜をやり過ごしたい。自分への疑いをそらすため、19時30分に書斎で涼子と会計の話をしたと思わせたい。',
        lies: '「19時30分に書斎で涼子さんと会計の件を話した。その時はまだ元気だった」と証言する。実際には書斎には一度も行っておらず、その時間は電話ボックスにいた。',
        memories:
          '前日の夜、涼子に呼び止められて「明日、ちゃんと話しましょう」と言われたときの、心臓が縮み上がるような感覚をまだ覚えている。夕食会の間もずっと上の空で、料理の味もよく覚えていない。',
      },
      {
        scenarioId: scenario.id,
        name: '早坂美月',
        personality:
          '明るく気配り上手で場の空気をよく読む。涼子の親戚の中でも一番可愛がられてきた自覚がある。内心は打算的で、追い詰められると笑顔の下で早口になる。',
        knowledge:
          '涼子の従妹。数ヶ月前、涼子から「月見荘を継いでほしい」と言われ、後継者・遺産の受取人に指定されている。19時からの夕食会に同席していた。20時ごろ、自分がブランデーのグラスを書斎に運び、涼子に渡してすぐ食堂に戻った。20時30分、様子を見に書斎へ行き、涼子が倒れているのを見つけて悲鳴を上げた。',
        secrets:
          '実際には19時50分ごろ、誰にも見られていないつもりで一度書斎に忍び込み、あらかじめ持っていたトリカブトの粉末をブランデーの瓶に混ぜている。20時に運んだのは、その毒入りのブランデーだった。トリカブトは、以前桐生が旅館裏庭の薬草園で育てていたものから少量持ち出した。',
        goals:
          '月見荘と遺産を確実に手に入れたい。最近涼子が「深川さんのこともあるし、後継者のことはもう一度ちゃんと考え直したい」と言い出し、指定が覆るのではと焦っていた。',
        lies: '「書斎に行ったのは20時に一度きり」と証言する。19時50分に廊下ですれ違ったはずだと指摘されても「人違いじゃないですか」ととぼける。',
        memories:
          '涼子に「あなたに継いでほしいの」と言われたときの誇らしさと、その後「考え直したい」と言われたときに胸の奥がすっと冷えた感覚を覚えている。',
      },
      {
        scenarioId: scenario.id,
        name: '桐生涼',
        personality:
          '落ち着いた物腰で観察力が鋭い医師。淡々と話すが、涼子への想いだけは昔から変わらず深い。',
        knowledge:
          '涼子の幼なじみでかかりつけ医。旅館裏庭の薬草園でトリカブトを含む薬草を研究用に栽培している。19時15分ごろ、深川が電話のため席を外すのを廊下で見て、19時45分ごろ食堂に戻ってくるのも見ている。19時50分ごろ、書斎に向かう美月と廊下ですれ違った。美月はそのとき手ぶらだった。20時30分、美月の悲鳴を聞いて書斎に駆けつけ、涼子の死を知った。',
        secrets:
          '実は19時35分ごろ、自分も短時間だけ書斎に入り涼子と二人で話している。旅館の経営方針を巡って口論になり、涼子から「あなたの薬草園、そろそろ整理してほしい」と言われて気まずい思いをした。この件は誰にも話していない。',
        goals:
          '涼子への想いを誰にも知られたくない。19時35分の口論のことは、できれば誰にも聞かれずに済ませたい。',
        lies: '「夕食会の19時からずっと食堂か廊下にいて、書斎には近づいていない」と証言する。実際は19時35分ごろ短時間、書斎で涼子と口論している。',
        memories:
          '若い頃からずっと涼子を支えてきた。今回「薬草園を整理してほしい」と言われたときの、静かなショックをまだ引きずっている。',
      },
    ])
    .returning()

  const fukagawa = insertedCharacters.find((character) => character.name === '深川誠也')
  const mizuki = insertedCharacters.find((character) => character.name === '早坂美月')
  const kiryu = insertedCharacters.find((character) => character.name === '桐生涼')

  if (fukagawa === undefined || mizuki === undefined || kiryu === undefined) {
    throw new Error('characters への insert に失敗しました。')
  }

  const insertedEvidences = await db
    .insert(evidences)
    .values([
      {
        scenarioId: scenario.id,
        label: '深川の携帯電話の発着信履歴',
        revealCondition:
          'プレイヤーが深川に「19時30分、本当に書斎で涼子さんと会ったのか」のように問い詰め、深川が動揺して言い訳を始めたら開示する。または桐生に「19時15分から19時45分の間、深川さんはどこにいたか」と尋ね、桐生が「廊下の電話ボックスにいた深川を見た」と答えたら開示する。',
        sources: [
          { type: 'character', id: fukagawa.id },
          { type: 'character', id: kiryu.id },
          { type: 'location', id: 'phone' },
        ],
      },
      {
        scenarioId: scenario.id,
        label: '桐生が見た、書斎前の廊下ですれ違った人物',
        revealCondition:
          'プレイヤーが桐生に「19時50分ごろ、廊下で誰かを見なかったか」または「書斎に近づいた人はいたか」と尋ね、桐生が「手ぶらの美月さんとすれ違った」と答えたら開示する。',
        sources: [
          { type: 'character', id: kiryu.id },
          { type: 'location', id: 'corridor' },
        ],
      },
      {
        scenarioId: scenario.id,
        label: '旅館裏庭の薬草園とトリカブトの管理記録',
        revealCondition:
          'プレイヤーが桐生に薬草園やトリカブトの栽培について尋ね、桐生が研究用に育てていたことを認めたら開示する。または美月に毒の入手経路について尋ね、美月が薬草園の存在を口にしたら開示する。',
        sources: [
          { type: 'character', id: kiryu.id },
          { type: 'character', id: mizuki.id },
          { type: 'location', id: 'garden' },
        ],
      },
      {
        scenarioId: scenario.id,
        label: '涼子の遺言書に記された後継者指定',
        revealCondition:
          'プレイヤーが美月に「月見荘の跡継ぎについて涼子さんと何か話していたか」と尋ね、美月が後継者に指定されていたことを認めたら開示する。',
        sources: [{ type: 'character', id: mizuki.id }],
      },
      {
        scenarioId: scenario.id,
        label: '書斎に残されたブランデーの瓶とグラス',
        revealCondition:
          'プレイヤーが美月に「20時に書斎へ運んだブランデーの様子」を尋ねるか、桐生に「涼子さんが倒れていた時、手元に何があったか」を尋ねたら開示する。',
        sources: [
          { type: 'character', id: mizuki.id },
          { type: 'character', id: kiryu.id },
          { type: 'location', id: 'study' },
        ],
      },
      {
        scenarioId: scenario.id,
        label: '涼子と桐生が交わした口論の記憶',
        revealCondition:
          'プレイヤーが桐生に「事件前に涼子さんと何か揉め事はなかったか」と繰り返し尋ね、桐生が根負けして19時35分の口論を認めたら開示する。',
        sources: [
          { type: 'character', id: kiryu.id },
          { type: 'location', id: 'study' },
        ],
      },
    ])
    .returning()

  const inheritanceEvidence = insertedEvidences.find(
    (evidence) => evidence.label === '涼子の遺言書に記された後継者指定',
  )

  if (inheritanceEvidence === undefined) {
    throw new Error('後継者指定の証拠 insert に失敗しました。')
  }

  const [inheritanceRevelation] = await db
    .insert(revelations)
    .values({
      scenarioId: scenario.id,
      title: '美月は月見荘の後継者',
      text: '涼子は数ヶ月前、美月を月見荘の後継者・遺産の受取人に指定していた。',
      category: 'relationship',
      subjectType: 'character',
      subjectId: mizuki.id,
      sources: [
        {
          type: 'character',
          id: mizuki.id,
          revealCondition:
            '美月に月見荘の後継者や遺産について尋ね、美月自身が後継者・受取人に指定されていたと認めた。',
          requires: { revelations: [], evidences: [] },
        },
      ],
      relatedFacts: [],
    })
    .returning({ id: revelations.id })

  if (inheritanceRevelation === undefined) {
    throw new Error('後継者Revelation の insert に失敗しました。')
  }

  await db.insert(revelations).values({
    scenarioId: scenario.id,
    title: '後継者指定への焦り',
    text: '涼子は最近、後継者の指定を考え直す可能性を口にしており、美月は指定が覆ることを恐れていた。',
    category: 'motive',
    subjectType: 'character',
    subjectId: mizuki.id,
    sources: [
      {
        type: 'character',
        id: mizuki.id,
        revealCondition:
          '後継者指定が見直される可能性や、美月がそれをどう受け止めたかを追及し、美月の焦りが明確に伝わった。',
        requires: {
          revelations: [inheritanceRevelation.id],
          evidences: [inheritanceEvidence.id],
        },
      },
    ],
    relatedFacts: [],
  })

  await db.insert(scenarioTruths).values({
    scenarioId: scenario.id,
    culpritCharacterId: mizuki.id,
    truth:
      '犯人は早坂美月。月見荘と遺産の後継者指定が覆るかもしれないという焦りから、19時50分ごろ書斎に忍び込み、旅館裏庭の薬草園にあったトリカブトの粉末をブランデーの瓶に混入した。20時に何食わぬ顔でそのブランデーを涼子に届け、20時15分ごろ涼子が口にして中毒死した。美月は「書斎に行ったのは20時の一度きり」と嘘をついているが、19時50分に廊下で桐生とすれ違っており、この目撃証言と美月自身の証言の間に矛盾が生まれる。もう一つ、深川は「19時30分に書斎で涼子と話した」と嘘の証言をしているが、桐生は19時15分から19時45分まで深川が電話ボックスにいたのを見ており、こちらも証言同士が食い違う。',
    timeline: [
      { time: '19:00', event: '夕食会が始まる。涼子・深川・美月・桐生の4人が同席。' },
      { time: '19:15', event: '深川が電話のため一時的に席を外す。桐生が廊下でこれを見ている。' },
      { time: '19:20', event: '涼子が書斎に移動し、一人で仕事を始める。' },
      { time: '19:35', event: '桐生が短時間書斎に入り、涼子と経営方針を巡って口論になる。' },
      { time: '19:45', event: '深川が食堂に戻る。桐生がこれを見ている。' },
      {
        time: '19:50',
        event:
          '美月が書斎に忍び込み、ブランデーの瓶にトリカブトの粉末を混ぜる。書斎に向かう途中、廊下で桐生とすれ違う。',
      },
      {
        time: '20:00',
        event: '美月が毒入りのブランデーを書斎に運び、涼子に渡してすぐ食堂に戻る。',
      },
      { time: '20:15', event: '涼子がブランデーを口にする。' },
      { time: '20:30', event: '美月が様子を見に書斎へ行き、涼子の死を発見して悲鳴を上げる。' },
    ],
    // ここに登場人物名や「トリカブト」のような単語をそのまま入れてはいけない。
    // 美月が名乗っただけ、桐生が薬草園の研究について答えただけで返答が遮断され、
    // 正当な聞き込みが成立しなくなる（薬草園の管理記録はそもそも証拠の一つ）。
    // 秘匿すべきは単語ではなく「真相を断定する言い回し」なので、そちらを並べる。
    secretKeywords: [
      '犯人は美月',
      '犯人は早坂',
      '美月が犯人',
      '美月が毒',
      '美月さんが毒',
      '私が毒を入れ',
      '私が毒を盛',
      'トリカブトを混ぜ',
      'トリカブトの粉末を混',
      'ブランデーに毒',
    ],
  })

  console.log(`シード完了: ${scenario.title} (${scenario.id})`)
  /*
    投入し直すとシナリオのIDが変わるが、一覧は KV に最大60秒キャッシュされている
    （src/server/cache/scenario.ts の SCENARIO_LIST_TTL_SECONDS）。その間に開くと、
    一覧には消えたほうのIDが並び、選んだ先が404になって「事件がない」ように見える。
    シードはWorkersの外で走るのでKVを消せない。待てば直る、と伝えるだけにしておく。
  */
  console.log('  ※ 一覧のキャッシュが切れるまで最大60秒、古い事件が表示されることがあります')
  console.log(`  深川誠也: ${fukagawa.id}`)
  console.log(`  早坂美月: ${mizuki.id} (犯人)`)
  console.log(`  桐生涼: ${kiryu.id}`)
}

try {
  await seed()
} finally {
  await sql.end()
}
