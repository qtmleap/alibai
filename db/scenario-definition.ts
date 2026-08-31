import { z } from 'zod'
import { floorPlanSchema } from './floor-plan'

const scenarioIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/)
const localIdSchema = z.string().nonempty().max(100)
const nonemptyTextSchema = z.string().trim().nonempty()
const CLOCK_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/
const timelineAtSchema = z
  .string()
  .refine((value) => [CLOCK_TIME_RE, ISO_DATETIME_RE].some((pattern) => pattern.test(value)), {
    message: 'at は HH:mm または ISO 8601 日時で指定してください。',
  })

export const scenarioMetaSchema = z.object({
  title: nonemptyTextSchema.max(100),
  synopsis: nonemptyTextSchema.max(500),
  category: nonemptyTextSchema.max(50),
  difficulty: z.int().min(1).max(5),
  estimatedMinutes: z.int().min(5).max(30),
  tags: z.array(nonemptyTextSchema.max(50)).default([]),
})

export const scenarioVictimSchema = z.object({
  name: nonemptyTextSchema.max(50),
  /** 肩書きひとつぶんの短い紹介。「青雨堂店主」のように、役割が分かれば足りる。 */
  introduction: nonemptyTextSchema.max(60),
})

export const scenarioFactSchema = z.object({
  id: localIdSchema,
  statement: nonemptyTextSchema,
  kind: z.enum(['observation', 'physical', 'testimony', 'motive', 'truth', 'other']).optional(),
  secret: z.boolean().default(false),
})

export const scenarioTimelineEventSchema = z.object({
  id: localIdSchema,
  at: timelineAtSchema,
  location: nonemptyTextSchema.optional(),
  participants: z.array(localIdSchema).default([]),
  facts: z.array(localIdSchema).min(1),
  description: nonemptyTextSchema.optional(),
})

export const scenarioSecretSchema = z.object({
  fact: localIdSchema,
  disclosure: z.enum(['never', 'pressured', 'voluntary']),
})

export const scenarioLieSchema = z.object({
  id: localIdSchema,
  about: localIdSchema,
  claim: nonemptyTextSchema,
  strategy: z.enum(['maintain', 'maintain-until-contradicted', 'evasive']),
})

export const scenarioMemorySchema = z.object({
  id: localIdSchema,
  about: localIdSchema,
  detail: nonemptyTextSchema,
})

export const scenarioRelationshipSchema = z.object({
  character: localIdSchema,
  relation: nonemptyTextSchema,
  attitude: nonemptyTextSchema.optional(),
})

export const scenarioCharacterSchema = z.object({
  id: localIdSchema,
  name: nonemptyTextSchema.max(100),
  role: nonemptyTextSchema.max(50).optional(),
  publicIntroduction: nonemptyTextSchema.max(300),
  personality: nonemptyTextSchema,
  goals: z.array(nonemptyTextSchema),
  knowledge: z.array(localIdSchema),
  secrets: z.array(scenarioSecretSchema),
  lies: z.array(scenarioLieSchema),
  memories: z.array(scenarioMemorySchema),
  relationships: z.array(scenarioRelationshipSchema).default([]),
})

export const scenarioRevelationSourceSchema = z.object({
  type: z.enum(['character', 'location']),
  id: localIdSchema,
  revealCondition: nonemptyTextSchema,
  requires: z
    .object({
      revelations: z.array(localIdSchema).default([]),
      evidences: z.array(localIdSchema).default([]),
    })
    .default({ revelations: [], evidences: [] }),
})

export const scenarioRevelationSchema = z.object({
  id: localIdSchema,
  title: nonemptyTextSchema.max(100),
  text: nonemptyTextSchema,
  category: z.enum([
    'relationship',
    'motive',
    'alibi',
    'timeline',
    'location',
    'background',
    'other',
  ]),
  subject: z.object({
    type: z.enum(['character', 'location', 'event']),
    id: localIdSchema,
  }),
  sources: z.array(scenarioRevelationSourceSchema).min(1),
  relatedFacts: z.array(localIdSchema).default([]),
})

/**
 * 証拠をどこから／誰から得られるか。
 *
 * revelation の source から解禁条件と前提条件を落とした薄い形。証拠側は
 * `reveal.condition` が既に条件文の役を果たしているので、ここは「どこに紐づくか」だけ。
 * 難易度モードの「この人にあと N 件」を数えるのに使う。
 */
export const scenarioEvidenceSourceSchema = z.object({
  type: z.enum(['character', 'location']),
  id: localIdSchema,
})

export const scenarioEvidenceSchema = z.object({
  id: localIdSchema,
  label: nonemptyTextSchema.max(100),
  description: nonemptyTextSchema.optional(),
  reveal: z.object({
    mode: z.enum(['conversation']).default('conversation'),
    condition: nonemptyTextSchema,
  }),
  /**
   * 空でも通す。場所にも人物にも紐づかない証拠は、残り件数の内訳には出ないが
   * 総数には数えられる。
   */
  sources: z.array(scenarioEvidenceSourceSchema).default([]),
  supports: z.array(localIdSchema).default([]),
  contradicts: z.array(nonemptyTextSchema).default([]),
})

export const scenarioSolutionSchema = z.object({
  culprit: localIdSchema,
  summary: nonemptyTextSchema,
  /**
   * 殺害方法と動機。プレイヤーの推理を採点する的になるので、summary から
   * 読み取れるとしても独立して書く。summary は物語の文章で、採点に使うには
   * 犯人の名前や時刻など的以外の情報を抱えすぎている。
   */
  method: nonemptyTextSchema,
  motive: nonemptyTextSchema,
  requiredFacts: z.array(localIdSchema).min(1),
  secretKeywords: z.array(nonemptyTextSchema).min(1),
})

export const scenarioQualitySchema = z.object({
  expectedQuestionCount: z
    .object({
      min: z.int().min(0),
      max: z.int().min(0),
    })
    .optional(),
  requiredEvidence: z
    .object({
      min: z.int().min(0),
    })
    .optional(),
  redHerrings: z.array(localIdSchema).default([]),
  notes: nonemptyTextSchema.optional(),
})

const duplicateIndexes = (ids: string[]): number[] => {
  const counts = new Map<string, number>()

  for (const id of ids) {
    const count = counts.get(id)
    counts.set(id, count === undefined ? 1 : count + 1)
  }

  return ids.flatMap((id, index) => {
    const count = counts.get(id)
    return count !== undefined && count > 1 ? [index] : []
  })
}

/**
 * 参照整合性を見ない、構造だけのスキーマ。
 *
 * Author LLM の Structured Output に渡すのはこちら。superRefine が見ている
 * 「存在しない fact を指していないか」といった条件は JSON Schema に落ちないので、
 * 生成を拘束する役には立たない。生成は構造で縛り、意味の検査は生成後に
 * ScenarioDefinitionSchema で行って、出た issues をモデルへ差し戻す。
 *
 * 手書きの定義を読むときは常に ScenarioDefinitionSchema を使うこと。
 * こちらを直接使うと、参照が壊れたシナリオが素通りする。
 */
export const scenarioDefinitionShapeSchema = z.object({
  schemaVersion: z.literal(1),
  id: scenarioIdSchema,
  meta: scenarioMetaSchema,
  /**
   * 亡くなった人。
   *
   * characters には入れない。あちらは聞き込みの相手の一覧で、
   * knowledge や secrets を持つ前提で NPC のプロンプトになる。
   * 被害者を混ぜると、話しかけられる列に死者が並ぶ。
   *
   * 事件の記録が名前を語っているので、伏せる情報ではない。
   * 殺人以外の事件を書けるようにするため任意にしてある。
   */
  victim: scenarioVictimSchema.optional(),
  briefing: nonemptyTextSchema,
  floorPlan: floorPlanSchema.nullable(),
  facts: z.array(scenarioFactSchema).min(1),
  timeline: z.array(scenarioTimelineEventSchema).min(1),
  characters: z.array(scenarioCharacterSchema).min(2),
  revelations: z.array(scenarioRevelationSchema).default([]),
  evidences: z.array(scenarioEvidenceSchema),
  solution: scenarioSolutionSchema,
  quality: scenarioQualitySchema.default({ redHerrings: [] }),
})

export const ScenarioDefinitionSchema = scenarioDefinitionShapeSchema.superRefine(
  (scenario, ctx) => {
    const factIds = new Set(scenario.facts.map((fact) => fact.id))
    const timelineIds = new Set(scenario.timeline.map((event) => event.id))
    const characterIds = new Set(scenario.characters.map((character) => character.id))
    const evidenceIds = new Set(scenario.evidences.map((evidence) => evidence.id))
    const revelationIds = new Set(scenario.revelations.map((revelation) => revelation.id))
    const locationIds = new Set(
      scenario.floorPlan === null ? [] : scenario.floorPlan.rooms.map((room) => room.id),
    )

    const addDuplicateIssues = (
      ids: string[],
      namespace: string,
      pathFor: (index: number) => (string | number)[],
    ) => {
      for (const index of duplicateIndexes(ids)) {
        ctx.addIssue({
          code: 'custom',
          path: pathFor(index),
          message: `${namespace} ID「${ids[index]}」が重複しています。`,
        })
      }
    }

    addDuplicateIssues(
      scenario.facts.map((fact) => fact.id),
      'fact',
      (index) => ['facts', index, 'id'],
    )
    addDuplicateIssues(
      scenario.timeline.map((event) => event.id),
      'timeline',
      (index) => ['timeline', index, 'id'],
    )
    addDuplicateIssues(
      scenario.characters.map((character) => character.id),
      'character',
      (index) => ['characters', index, 'id'],
    )
    addDuplicateIssues(
      scenario.evidences.map((evidence) => evidence.id),
      'evidence',
      (index) => ['evidences', index, 'id'],
    )
    addDuplicateIssues(
      scenario.revelations.map((revelation) => revelation.id),
      'revelation',
      (index) => ['revelations', index, 'id'],
    )

    const lieEntries = scenario.characters.flatMap((character, characterIndex) =>
      character.lies.map((lie, lieIndex) => ({ characterIndex, lie, lieIndex })),
    )
    const lieIds = lieEntries.map(({ lie }) => lie.id)
    const lieIdSet = new Set(lieIds)

    for (const index of duplicateIndexes(lieIds)) {
      const entry = lieEntries[index]
      if (entry === undefined) continue

      ctx.addIssue({
        code: 'custom',
        path: ['characters', entry.characterIndex, 'lies', entry.lieIndex, 'id'],
        message: `lie ID「${entry.lie.id}」が重複しています。`,
      })
    }

    scenario.characters.forEach((character, characterIndex) => {
      character.knowledge.forEach((factId, knowledgeIndex) => {
        if (!factIds.has(factId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['characters', characterIndex, 'knowledge', knowledgeIndex],
            message: `存在しない fact「${factId}」を参照しています。`,
          })
        }
      })

      character.secrets.forEach((secret, secretIndex) => {
        if (!factIds.has(secret.fact)) {
          ctx.addIssue({
            code: 'custom',
            path: ['characters', characterIndex, 'secrets', secretIndex, 'fact'],
            message: `存在しない fact「${secret.fact}」を参照しています。`,
          })
        }
      })

      character.lies.forEach((lie, lieIndex) => {
        if (!factIds.has(lie.about)) {
          ctx.addIssue({
            code: 'custom',
            path: ['characters', characterIndex, 'lies', lieIndex, 'about'],
            message: `存在しない fact「${lie.about}」を参照しています。`,
          })
        }
      })

      const memoryIds = character.memories.map((memory) => memory.id)
      for (const memoryIndex of duplicateIndexes(memoryIds)) {
        ctx.addIssue({
          code: 'custom',
          path: ['characters', characterIndex, 'memories', memoryIndex, 'id'],
          message: `memory ID「${memoryIds[memoryIndex]}」が重複しています。`,
        })
      }

      character.memories.forEach((memory, memoryIndex) => {
        if (!factIds.has(memory.about)) {
          ctx.addIssue({
            code: 'custom',
            path: ['characters', characterIndex, 'memories', memoryIndex, 'about'],
            message: `存在しない fact「${memory.about}」を参照しています。`,
          })
        }
      })

      character.relationships.forEach((relationship, relationshipIndex) => {
        if (!characterIds.has(relationship.character)) {
          ctx.addIssue({
            code: 'custom',
            path: ['characters', characterIndex, 'relationships', relationshipIndex, 'character'],
            message: `存在しない character「${relationship.character}」を参照しています。`,
          })
        }
      })
    })

    scenario.timeline.forEach((event, eventIndex) => {
      event.participants.forEach((characterId, participantIndex) => {
        if (!characterIds.has(characterId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['timeline', eventIndex, 'participants', participantIndex],
            message: `存在しない character「${characterId}」を参照しています。`,
          })
        }
      })

      event.facts.forEach((factId, factIndex) => {
        if (!factIds.has(factId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['timeline', eventIndex, 'facts', factIndex],
            message: `存在しない fact「${factId}」を参照しています。`,
          })
        }
      })
    })

    const hasClockTime = scenario.timeline.some((event) => CLOCK_TIME_RE.test(event.at))
    const hasIsoDateTime = scenario.timeline.some((event) => ISO_DATETIME_RE.test(event.at))
    if (hasClockTime && hasIsoDateTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeline'],
        message: '同一シナリオ内で HH:mm と ISO 8601 日時を混在させてはいけません。',
      })
    }

    scenario.revelations.forEach((revelation, revelationIndex) => {
      const subjectExists =
        revelation.subject.type === 'character'
          ? characterIds.has(revelation.subject.id)
          : revelation.subject.type === 'event'
            ? timelineIds.has(revelation.subject.id)
            : locationIds.has(revelation.subject.id)

      if (!subjectExists) {
        ctx.addIssue({
          code: 'custom',
          path: ['revelations', revelationIndex, 'subject', 'id'],
          message: `存在しない ${revelation.subject.type}「${revelation.subject.id}」を参照しています。`,
        })
      }

      revelation.relatedFacts.forEach((factId, factIndex) => {
        if (!factIds.has(factId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['revelations', revelationIndex, 'relatedFacts', factIndex],
            message: `存在しない fact「${factId}」を参照しています。`,
          })
        }
      })

      revelation.sources.forEach((source, sourceIndex) => {
        const sourceExists =
          source.type === 'character' ? characterIds.has(source.id) : locationIds.has(source.id)

        if (!sourceExists) {
          ctx.addIssue({
            code: 'custom',
            path: ['revelations', revelationIndex, 'sources', sourceIndex, 'id'],
            message: `存在しない ${source.type}「${source.id}」を参照しています。`,
          })
        }

        source.requires.evidences.forEach((evidenceId, evidenceIndex) => {
          if (!evidenceIds.has(evidenceId)) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'revelations',
                revelationIndex,
                'sources',
                sourceIndex,
                'requires',
                'evidences',
                evidenceIndex,
              ],
              message: `存在しない evidence「${evidenceId}」を参照しています。`,
            })
          }
        })

        source.requires.revelations.forEach((requiredId, requiredIndex) => {
          if (!revelationIds.has(requiredId)) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'revelations',
                revelationIndex,
                'sources',
                sourceIndex,
                'requires',
                'revelations',
                requiredIndex,
              ],
              message: `存在しない revelation「${requiredId}」を参照しています。`,
            })
          } else if (requiredId === revelation.id) {
            ctx.addIssue({
              code: 'custom',
              path: [
                'revelations',
                revelationIndex,
                'sources',
                sourceIndex,
                'requires',
                'revelations',
                requiredIndex,
              ],
              message: 'Revelation は自分自身を解禁条件にできません。',
            })
          }
        })
      })
    })

    // Revelation は少なくとも1本、既に到達可能な情報だけを前提にする経路が必要。
    // fixed-point で根から辿り、循環だけで閉じたカードを静的に検出する。
    const reachableRevelationIds = new Set<string>()
    const unresolved = new Set(scenario.revelations.map((revelation) => revelation.id))
    const maxPasses = scenario.revelations.length

    for (let pass = 0; pass < maxPasses; pass += 1) {
      const newlyReachable = scenario.revelations.filter(
        (revelation) =>
          unresolved.has(revelation.id) &&
          revelation.sources.some((source) =>
            source.requires.revelations.every((requiredId) =>
              reachableRevelationIds.has(requiredId),
            ),
          ),
      )

      if (newlyReachable.length === 0) break

      for (const revelation of newlyReachable) {
        reachableRevelationIds.add(revelation.id)
        unresolved.delete(revelation.id)
      }
    }

    scenario.revelations.forEach((revelation, revelationIndex) => {
      if (unresolved.has(revelation.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['revelations', revelationIndex],
          message: `Revelation「${revelation.id}」は前提条件が循環していて到達できません。`,
        })
      }
    })

    scenario.evidences.forEach((evidence, evidenceIndex) => {
      // 場所IDは見取り図の部屋IDと文字列で一致しているだけなので、
      // 片方を書き換えた瞬間に証拠がどこにも紐づかなくなる。ここで落とす。
      evidence.sources.forEach((source, sourceIndex) => {
        const sourceExists =
          source.type === 'character' ? characterIds.has(source.id) : locationIds.has(source.id)

        if (!sourceExists) {
          ctx.addIssue({
            code: 'custom',
            path: ['evidences', evidenceIndex, 'sources', sourceIndex, 'id'],
            message: `存在しない ${source.type}「${source.id}」を参照しています。`,
          })
        }
      })

      evidence.supports.forEach((factId, supportIndex) => {
        if (!factIds.has(factId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['evidences', evidenceIndex, 'supports', supportIndex],
            message: `存在しない fact「${factId}」を参照しています。`,
          })
        }
      })

      evidence.contradicts.forEach((reference, contradictIndex) => {
        const lieId = reference.startsWith('lie:') ? reference.slice(4) : undefined
        const referencesKnownLie = lieId === undefined ? false : lieIdSet.has(lieId)
        if (!referencesKnownLie) {
          ctx.addIssue({
            code: 'custom',
            path: ['evidences', evidenceIndex, 'contradicts', contradictIndex],
            message: `存在しない lie 参照「${reference}」です。`,
          })
        }
      })
    })

    if (!characterIds.has(scenario.solution.culprit)) {
      ctx.addIssue({
        code: 'custom',
        path: ['solution', 'culprit'],
        message: `存在しない character「${scenario.solution.culprit}」を犯人に指定しています。`,
      })
    }

    scenario.solution.requiredFacts.forEach((factId, factIndex) => {
      if (!factIds.has(factId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['solution', 'requiredFacts', factIndex],
          message: `存在しない fact「${factId}」を参照しています。`,
        })
      }
    })

    const publicText = [
      scenario.meta.title,
      scenario.meta.synopsis,
      scenario.meta.category,
      ...scenario.meta.tags,
      scenario.briefing,
      ...scenario.characters.map((character) => character.publicIntroduction),
    ]
      .join('\n')
      .toLocaleLowerCase()

    scenario.solution.secretKeywords.forEach((keyword, keywordIndex) => {
      if (publicText.includes(keyword.toLocaleLowerCase())) {
        ctx.addIssue({
          code: 'custom',
          path: ['solution', 'secretKeywords', keywordIndex],
          message: `秘匿キーワード「${keyword}」が公開情報に含まれています。`,
        })
      }
    })

    const expectedQuestions = scenario.quality.expectedQuestionCount
    if (expectedQuestions !== undefined && expectedQuestions.min > expectedQuestions.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['quality', 'expectedQuestionCount'],
        message: 'expectedQuestionCount.min は max 以下でなければなりません。',
      })
    }
  },
)

export type ScenarioEvidenceSource = z.infer<typeof scenarioEvidenceSourceSchema>
export type ScenarioRevelationSource = z.infer<typeof scenarioRevelationSourceSchema>
export type ScenarioRevelation = z.infer<typeof scenarioRevelationSchema>
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>
export type ScenarioDefinitionInput = z.input<typeof ScenarioDefinitionSchema>
