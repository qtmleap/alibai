import { describe, expect, test } from 'bun:test'
import {
  type AuthorGenerateRequest,
  authoringWarnings,
  describeIssues,
  runAuthor,
} from '~/db/author'
import { validateScenario } from '~/db/compile-scenario'
import { loadScenarioYaml } from '~/db/scenario-file'

/*
  検証を通る定義の実物として月見荘を使う。合成の最小シナリオでも回るが、
  実物を使っておけば「検証器が通す形」がテストの前提からずれない。
*/
const valid = await loadScenarioYaml('tsukimisou')

/*
  警告の出る定義は、月見荘から record を剥がして作る。実物が警告を持つのを
  当てにしない——持っていない状態が正しいので、当てにすると穴が埋まった日に
  このテストが落ちる（実際に一度そうなった）。
*/
const withWarning = (() => {
  const definition = structuredClone(valid)

  if (
    definition === null ||
    typeof definition !== 'object' ||
    !('timeline' in definition) ||
    !Array.isArray(definition.timeline)
  ) {
    throw new Error('月見荘の定義を読めませんでした')
  }

  const event = definition.timeline.find(({ id }) => id === 'ryoko-drinks')

  if (event === undefined) throw new Error('ryoko-drinks が見当たりません')

  event.record = undefined

  return definition
})()

/** 参照を1本壊した定義。構造は合っているが superRefine が落とす。 */
const brokenReference = () => {
  const definition = structuredClone(valid)

  if (
    definition === null ||
    typeof definition !== 'object' ||
    !('characters' in definition) ||
    !Array.isArray(definition.characters)
  ) {
    throw new Error('月見荘の定義を読めませんでした')
  }

  const [first] = definition.characters
  first.knowledge = ['does-not-exist']

  return definition
}

/** 呼ばれた回数ぶん、渡された順に返す generate。受け取った request も記録する。 */
const scriptedGenerate = (outputs: unknown[]) => {
  const seen: AuthorGenerateRequest[] = []

  return {
    seen,
    generate: async (request: AuthorGenerateRequest) => {
      seen.push(request)
      const output = outputs[seen.length - 1]
      if (output === undefined) throw new Error('用意した出力より多く呼ばれました')
      return output
    },
  }
}

describe('runAuthor', () => {
  test('一度で検証を通れば、そのまま採用する', async () => {
    const { generate, seen } = scriptedGenerate([valid])
    const result = await runAuthor({ premise: '題材', generate, maxAttempts: 3 })

    expect(result.ok).toBe(true)
    expect(seen).toHaveLength(1)
    expect(result.attempts).toEqual([])
    if (!result.ok) return

    // 既定値を埋めた形も一緒に返る。ファイル名やタイトルはこちらから読む。
    expect(result.validated.id).toBe('tsukimisou-17th-anniversary')
    expect(result.definition).toEqual(valid)
  })

  test('落ちたら指摘を添えて再生成させ、通ったところで止まる', async () => {
    const { generate, seen } = scriptedGenerate([brokenReference(), valid])
    const result = await runAuthor({ premise: '題材', generate, maxAttempts: 3 })

    expect(result.ok).toBe(true)
    expect(seen).toHaveLength(2)

    // 1回目には前回が無く、2回目には前回の出力と指摘が渡る。
    expect(seen[0]?.previous).toBeUndefined()
    expect(seen[1]?.previous?.definition).toEqual(brokenReference())
    expect(seen[1]?.previous?.issues.join('\n')).toContain('does-not-exist')

    expect(result.attempts).toHaveLength(1)
    expect(result.attempts[0]?.attempt).toBe(1)
  })

  test('回数を使い切ったら諦め、経過を全部返す', async () => {
    const { generate, seen } = scriptedGenerate([
      brokenReference(),
      brokenReference(),
      brokenReference(),
    ])
    const result = await runAuthor({ premise: '題材', generate, maxAttempts: 3 })

    expect(result.ok).toBe(false)
    expect(seen).toHaveLength(3)
    expect(result.attempts.map((attempt) => attempt.attempt)).toEqual([1, 2, 3])

    for (const attempt of result.attempts) {
      expect(attempt.issues.length).toBeGreaterThan(0)
    }
  })

  test('題材は毎回そのまま渡る', async () => {
    const { generate, seen } = scriptedGenerate([brokenReference(), valid])
    await runAuthor({ premise: '昭和の温泉旅館', generate, maxAttempts: 3 })

    expect(seen.map((request) => request.premise)).toEqual(['昭和の温泉旅館', '昭和の温泉旅館'])
  })

  /*
    生成が構造の段で外れて object にすらならなかった場合。
    generateObject に検証をさせていないので、この形はループの中で普通に扱われ、
    例外にはならない。
  */
  test('オブジェクトですらない出力も、例外にせず指摘に変える', async () => {
    const { generate } = scriptedGenerate(['ただの文字列', valid])
    const result = await runAuthor({ premise: '題材', generate, maxAttempts: 3 })

    expect(result.ok).toBe(true)
    expect(result.attempts).toHaveLength(1)
    expect(result.attempts[0]?.issues.length).toBeGreaterThan(0)
  })
})

describe('runAuthor: 警告', () => {
  test('警告だけでも差し戻し、直れば採用する', async () => {
    const { generate, seen } = scriptedGenerate([withWarning, valid])
    const result = await runAuthor({ premise: '題材', generate, maxAttempts: 3 })

    expect(result.ok).toBe(true)
    expect(seen).toHaveLength(2)
    expect(seen[1]?.previous?.issues.join('\n')).toContain('record')

    expect(result.attempts).toHaveLength(1)
    if (!result.ok) return
    expect(result.warnings).toEqual([])
  })

  /*
    警告は検証の失敗ではないので、最後の一回で捨ててはいけない。
    捨てると、通る定義が手元にあるのに手ぶらで終わる。
  */
  test('最後の一回まで残った警告は、付けたまま採用する', async () => {
    const { generate, seen } = scriptedGenerate([withWarning])
    const result = await runAuthor({ premise: '題材', generate, maxAttempts: 1 })

    expect(result.ok).toBe(true)
    expect(seen).toHaveLength(1)
    if (!result.ok) return
    expect(result.warnings).toHaveLength(1)
  })
})

describe('authoringWarnings', () => {
  const definitionOf = (input: unknown) => {
    const validated = validateScenario(input)

    if (!validated.ok) throw new Error(`検証を通りませんでした:\n${validated.issues.join('\n')}`)

    return validated.definition
  }

  test('物証で裏付けられた出来事に record が無ければ、その出来事を名指しする', () => {
    const warnings = authoringWarnings(definitionOf(withWarning))

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('ryoko-drinks')
  })

  test('record が埋まっていれば何も言わない', () => {
    expect(authoringWarnings(definitionOf(valid))).toEqual([])
  })

  test('崩せる嘘が時刻表に繋がっていなければ、印が立たないと言う', () => {
    const definition = definitionOf(valid)
    const severed = {
      ...definition,
      evidences: definition.evidences.map((evidence) => ({ ...evidence, contradicts: [] })),
    }

    expect(authoringWarnings(severed).join('\n')).toContain('食い違い')
  })
})

describe('describeIssues', () => {
  test('件数を先に出し、指摘を箇条書きで並べる', () => {
    expect(describeIssues(['a が壊れています', 'b が足りません'])).toBe(
      `直前の出力には 2 件の問題があります。すべて修正した完全な定義を出力してください。

- a が壊れています
- b が足りません`,
    )
  })
})
