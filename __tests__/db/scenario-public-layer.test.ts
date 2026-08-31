import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { ScenarioDefinitionSchema } from '../../db/scenario-definition'

const SCENARIO_DIR = path.resolve(import.meta.dir, '../../db/scenarios')

const spoilerInstructionPattern =
  /(しかし|ただし|ところが|ではなく|とは限らない|別問題|本当に|確かめてください|調べてください|見極めて|見極めろ|暴け|崩せ|疑って|分けて考えて|同一視して|変換してから|前提から確認)/

const titleSpoilerPattern =
  /(アリバイ|存在しない|位置タグ|借り物の記憶|署名|四十二人目|提灯|鍵|扉|額縁|夜明け|水の流れ|契約書|十一分|磨りガラス|遅延証明書|返事|声だけ|時計が|名札|レシート|複写伝票|足跡|連続写真|朝支度|密室|無音|キューランプ|給餌灯|水位線|送信者|外套|歩く杖|目撃者|作業艇|目撃証言|一人乗り|保守窓|自律飛行|日没の鐘|最後の電信)/

const publicIntroductionSpoilerPattern =
  /(アリバイ|秘密|隠し|不正|証拠として|人物識別|思い込み|標準時|時系列|休憩延長|記録から外|機器表示|杖の音|絶対視|バッジ)/

const scenarioFiles = async (): Promise<string[]> =>
  (await readdir(SCENARIO_DIR)).filter((name) => name.endsWith('.yaml')).sort()

describe('scenario public layer', () => {
  test('title / synopsis / briefing / publicIntroduction は解法や疑うべき証拠を直接案内しない', async () => {
    const violations: string[] = []

    for (const file of await scenarioFiles()) {
      const source = await Bun.file(path.join(SCENARIO_DIR, file)).text()
      const parsed = ScenarioDefinitionSchema.safeParse(YAML.parse(source))
      if (!parsed.success) {
        violations.push(`${file}: invalid scenario schema`)
        continue
      }

      const scenario = parsed.data
      const title = scenario.meta.title
      const synopsis = scenario.meta.synopsis
      const briefing = scenario.briefing

      if (titleSpoilerPattern.test(title)) violations.push(`${file}: title`)
      if (spoilerInstructionPattern.test(synopsis)) violations.push(`${file}: synopsis`)
      if (spoilerInstructionPattern.test(briefing)) violations.push(`${file}: briefing`)

      for (const character of scenario.characters) {
        if (publicIntroductionSpoilerPattern.test(character.publicIntroduction)) {
          violations.push(`${file}: publicIntroduction:${character.name}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  test('briefing は被害者の公開人物像を含む', async () => {
    const violations: string[] = []
    const reputationPattern =
      /(慕われ|信頼され|尊敬され|人望|評判|面倒見|厳格|穏やか|気難し|実直|誠実|熱心|頼られ|親しまれ|愛され|恐れられ|世話焼き|頑固|温厚|寡黙|豪胆|几帳面|情熱|気さく|公正|融通|辛口)/

    for (const file of await scenarioFiles()) {
      const source = await Bun.file(path.join(SCENARIO_DIR, file)).text()
      const parsed = ScenarioDefinitionSchema.safeParse(YAML.parse(source))
      if (!parsed.success || parsed.data.victim === undefined) {
        violations.push(`${file}: invalid scenario or missing victim`)
        continue
      }

      const victimName = parsed.data.victim.name
      const profileParagraph = parsed.data.briefing
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .find((paragraph) => paragraph.includes(victimName) && reputationPattern.test(paragraph))

      if (profileParagraph === undefined) violations.push(`${file}: victim profile missing`)
    }

    expect(violations).toEqual([])
  })

  test('briefing は背景を含む十分な長さと段落数を持つ', async () => {
    const violations: string[] = []

    for (const file of await scenarioFiles()) {
      const source = await Bun.file(path.join(SCENARIO_DIR, file)).text()
      const parsed = ScenarioDefinitionSchema.safeParse(YAML.parse(source))
      if (!parsed.success) {
        violations.push(`${file}: invalid scenario schema`)
        continue
      }

      const briefing = parsed.data.briefing.trim()
      const paragraphs = briefing
        .split(/\n\s*\n/)
        .filter((paragraph) => paragraph.trim().length > 0)
      if ([...briefing].length < 300) violations.push(`${file}: briefing too short`)
      if (paragraphs.length < 5) violations.push(`${file}: briefing has too few paragraphs`)
    }

    expect(violations).toEqual([])
  })
})
