import {
  AGE_GROUP_LABELS,
  AGE_GROUP_NOTES,
  type AgeGroup,
  type Detective,
  GENDER_LABELS,
  type Gender,
} from '~/db/detective'

/**
 * 探偵の人物像を、NPCが読めるプロンプトの一片に変える。
 *
 * 目の前の相手が誰かによって呼びかけが変わるのは、聞き込みの手触りそのものなので、
 * 「相手の設定を並べる」だけでは足りない。老人が少女に向かって「お嬢さん」と言うところまで
 * 決めてやらないと、モデルはどの相手にも同じ調子で喋る。
 *
 * ただしNPC自身の年齢はキャラクターシート側にしか無い（characters に年齢の列は無く、
 * personality の文章に書かれている）。だからここでは絶対的な呼称を指定せず、
 * 「あなたのほうが年上なら」という相対的な条件で候補を渡す。判断はモデルに任せる。
 */

/**
 * 呼称は3系統に畳む。「どちらでもない」と「明かさない」で呼び分ける意味は薄く、
 * どちらも性別を決めつけない言い方に寄せたい。
 */
type Tone = 'male' | 'female' | 'neutral'

const TONE_OF: Record<Gender, Tone> = {
  male: 'male',
  female: 'female',
  other: 'neutral',
  unknown: 'neutral',
}

/** 年上のNPCから見たときと、年下のNPCから見たときの呼びかけ候補。 */
type AddressHint = { fromElder: string; fromYounger: string }

const ADDRESS: Record<AgeGroup, Record<Tone, AddressHint>> = {
  child: {
    male: { fromElder: '「坊や」「坊っちゃん」', fromYounger: '「君」「お兄ちゃん」' },
    female: { fromElder: '「お嬢ちゃん」「お嬢さん」', fromYounger: '「君」「お姉ちゃん」' },
    neutral: { fromElder: '「君」「お子さん」', fromYounger: '「君」' },
  },
  teen: {
    male: { fromElder: '「少年」「坊っちゃん」「君」', fromYounger: '「お兄さん」' },
    female: { fromElder: '「お嬢さん」「お嬢ちゃん」「君」', fromYounger: '「お姉さん」' },
    neutral: { fromElder: '「君」「若いの」', fromYounger: '「あなた」' },
  },
  young: {
    male: { fromElder: '「兄さん」「若いの」「あんた」', fromYounger: '「お兄さん」「探偵さん」' },
    female: { fromElder: '「お嬢さん」「お姉さん」', fromYounger: '「お姉さん」「探偵さん」' },
    neutral: { fromElder: '「若いの」「あんた」', fromYounger: '「あなた」「探偵さん」' },
  },
  adult: {
    male: { fromElder: '「あんた」「旦那」', fromYounger: '「おじさん」「探偵さん」' },
    female: { fromElder: '「あんた」「お姉さん」', fromYounger: '「お姉さん」「探偵さん」' },
    neutral: { fromElder: '「あんた」「そちらさん」', fromYounger: '「あなた」「探偵さん」' },
  },
  senior: {
    male: { fromElder: '「あんた」「旦那さん」', fromYounger: '「おじさん」「旦那さん」' },
    female: { fromElder: '「あんた」「奥さん」', fromYounger: '「おばさん」「奥さん」' },
    neutral: { fromElder: '「あんた」「そちらさん」', fromYounger: '「あなた」「そちらさん」' },
  },
  elder: {
    male: { fromElder: '「ご老人」「あんた」', fromYounger: '「おじいさん」「ご老人」' },
    female: { fromElder: '「ご老人」「あんた」', fromYounger: '「おばあさん」「ご婦人」' },
    neutral: { fromElder: '「ご老人」', fromYounger: '「ご老人」' },
  },
  unknown: {
    male: { fromElder: '「あなた」「探偵さん」', fromYounger: '「あなた」「探偵さん」' },
    female: { fromElder: '「あなた」「探偵さん」', fromYounger: '「あなた」「探偵さん」' },
    neutral: { fromElder: '「あなた」「そちらさん」', fromYounger: '「あなた」「探偵さん」' },
  },
}

/**
 * 年齢が読めない相手に「お嬢さん」も「ご老人」も使えない。
 * 呼びかけを候補で示す代わりに、決めつけないことを指示に変える。
 */
const UNKNOWN_AGE_RULE = '- 年ごろが読めない相手なので、年齢を決めつけた呼びかけは避ける。'

export const buildDetectiveBlock = (detective: Detective): string => {
  const hint = ADDRESS[detective.ageGroup][TONE_OF[detective.gender]]
  const ageLine = `${AGE_GROUP_LABELS[detective.ageGroup]}（${AGE_GROUP_NOTES[detective.ageGroup]}）`

  const lines = [
    'あなたの前にいるのは、この事件を調べに来た人物である。',
    '',
    `名前: ${detective.name}`,
    `年ごろ: ${ageLine}`,
    `性別: ${GENDER_LABELS[detective.gender]}`,
    // 空のまま「外見: 」と書くと、モデルが行を埋めようとして勝手に外見を作る。
    ...(detective.appearance.length > 0 ? [`外見: ${detective.appearance}`] : []),
    '',
    '呼びかけと態度:',
    `- あなたのほうが年上なら、${hint.fromElder} のように呼びかける。`,
    '- 同年代なら、名前で呼ぶか「あなた」「君」と呼ぶ。',
    `- あなたのほうが年下なら、${hint.fromYounger} のように呼びかける。`,
    ...(detective.ageGroup === 'unknown' ? [UNKNOWN_AGE_RULE] : []),
    '- 年の差・性別・身なりに応じて、敬語の度合いや距離の取り方も自然に変えてよい。',
    // ここを書かないと、若く見える相手には証言まで軽くなり、
    // 探偵の設定でゲームの難度が動いてしまう。変わってよいのは口調だけ。
    '- ただし変わるのは口調と態度だけで、答える中身（知っていること・隠すこと）は変えない。',
    '',
    'この人物が何をどこまで掴んでいるかは分からない前提で答える。',
  ]

  return lines.join('\n')
}
