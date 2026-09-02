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
})

/**
 * 被害者を指すときの ID。
 *
 * 被害者は `characters` に居ないので固有のIDを持たない。証拠や啓示の出どころとして
 * 名指しするときだけ、この決め打ちの文字列を使う。指す先は一人しか居ないので、
 * 照合すべき一覧も無い。
 */
export const VICTIM_ID = 'victim'

/**
 * 遺体と現場から分かること。
 *
 * 1件1文。人物の心情や動機の解釈は書かない——あれは `revelations` の仕事で、
 * ここに混ぜると「遺体を見ただけで動機が分かる」ことになってしまう。
 * ここに書けるのは、その場で目にできるものだけ。
 */
export const scenarioVictimFindingSchema = z.object({
  id: localIdSchema,
  statement: nonemptyTextSchema,
  /** 段階的に見せたいときだけ。形は revelation の解禁前提と同じ。 */
  requires: z
    .object({
      revelations: z.array(localIdSchema).default([]),
      evidences: z.array(localIdSchema).default([]),
    })
    .default({ revelations: [], evidences: [] }),
})

export const scenarioVictimSchema = z.object({
  name: nonemptyTextSchema.max(50),
  /** 肩書きひとつぶんの短い紹介。「青雨堂店主」のように、役割が分かれば足りる。 */
  introduction: nonemptyTextSchema.max(60),
  /*
   * ここから下は、遺体を調べて初めて画面に出るもの。
   * すべて省略可にしてあるのは、この機能より前に書かれたシナリオを落とさないため。
   * 一つも無いシナリオでは、被害者は聞き込みの相手に並ばない。
   */
  /** 発見時刻。`HH:mm` で、timeline と同じ書き方。 */
  foundAt: timelineAtSchema.optional(),
  /** 発見場所。画面にそのまま出る文字。部屋IDは `foundRoom` のほうへ。 */
  foundIn: nonemptyTextSchema.max(20).optional(),
  /** 発見場所の部屋ID。見取り図のある事件でだけ書ける。 */
  foundRoom: localIdSchema.optional(),
  /**
   * 死亡推定時刻。発見時刻（`foundAt`）とは別物で、アリバイ表を横断する刻限の線になる。
   * 時刻の偽装を核にする事件では、ここが盤面の中心になる。
   */
  estimatedDeathAt: timelineAtSchema.optional(),
  causeOfDeath: nonemptyTextSchema.max(100).optional(),
  findings: z.array(scenarioVictimFindingSchema).default([]),
})

export const scenarioFactSchema = z.object({
  id: localIdSchema,
  statement: nonemptyTextSchema,
  kind: z.enum(['observation', 'physical', 'testimony', 'motive', 'truth', 'other']).optional(),
})

export const scenarioTimelineEventSchema = z.object({
  id: localIdSchema,
  at: timelineAtSchema,
  /**
   * 在所。**画面にそのまま出る文字**なので、短い名詞句で書く。
   * 見取り図と結びつけたいときは、部屋IDを `room` のほうへ書く。
   */
  location: nonemptyTextSchema.max(20).optional(),
  /** 見取り図の部屋ID。図のある事件でだけ書ける。 */
  room: localIdSchema.optional(),
  /**
   * その時刻に **`location` に居た人**。関わった人ではない。
   * ここに載せた人の列に、アリバイ表の線が引かれる。
   */
  participants: z.array(localIdSchema).default([]),
  /**
   * 離れた場所から見ていた人。線は引かれない。
   *
   * 「AがBを目撃する」を一つの出来事にまとめると、盤面ではBまでその場所に立つ。
   * 見ていた側はここへ置き、その人自身の居場所は別の出来事として書く。
   */
  witnesses: z.array(localIdSchema).default([]),
  facts: z.array(localIdSchema).min(1),
  /**
   * その時刻を留めた記録の名前。「受付」「忘れ傘」「通報」。
   * アリバイ表の目盛りに `19:08　受付` の形で添う。裏付けのある出来事にだけ書く。
   */
  record: nonemptyTextSchema.max(12).optional(),
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
  // victim のとき id は VICTIM_ID 固定。指す先が一人しか居ないので照合先の一覧を持たない。
  type: z.enum(['character', 'location', 'victim']),
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
  type: z.enum(['character', 'location', 'victim']),
  id: localIdSchema,
})

export const scenarioEvidenceSchema = z.object({
  id: localIdSchema,
  label: nonemptyTextSchema.max(100),
  description: nonemptyTextSchema.optional(),
  reveal: z.object({ condition: nonemptyTextSchema }),
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
  secretKeywords: z.array(nonemptyTextSchema).min(1),
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

    /**
     * 出どころが実在するか。駄目なら理由を返す。
     *
     * 被害者だけは照合すべき一覧を持たない（事件に一人しか居ない）ので、
     * 「その事件に被害者が居るか」と「決め打ちのIDか」の二点だけを見る。
     */
    const sourceIssue = (source: { type: string; id: string }): string | undefined => {
      if (source.type === 'victim') {
        if (scenario.victim === undefined) {
          return '被害者の居ない事件で type: victim は使えません。'
        }

        return source.id === VICTIM_ID
          ? undefined
          : `type: victim の id は「${VICTIM_ID}」で固定です。`
      }

      const exists =
        source.type === 'character' ? characterIds.has(source.id) : locationIds.has(source.id)

      return exists ? undefined : `存在しない ${source.type}「${source.id}」を参照しています。`
    }

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

    const findings = scenario.victim === undefined ? [] : scenario.victim.findings

    addDuplicateIssues(
      findings.map((finding) => finding.id),
      'finding',
      (index) => ['victim', 'findings', index, 'id'],
    )

    // 所見の解禁前提。証拠や啓示を書き換えたときに、遺体側だけ古い ID が残るのを防ぐ。
    findings.forEach((finding, findingIndex) => {
      finding.requires.evidences.forEach((evidenceId, at) => {
        if (!evidenceIds.has(evidenceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['victim', 'findings', findingIndex, 'requires', 'evidences', at],
            message: `存在しない evidence「${evidenceId}」を参照しています。`,
          })
        }
      })

      finding.requires.revelations.forEach((revelationId, at) => {
        if (!revelationIds.has(revelationId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['victim', 'findings', findingIndex, 'requires', 'revelations', at],
            message: `存在しない revelation「${revelationId}」を参照しています。`,
          })
        }
      })
    })

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

      event.witnesses.forEach((characterId, witnessIndex) => {
        if (!characterIds.has(characterId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['timeline', eventIndex, 'witnesses', witnessIndex],
            message: `存在しない character「${characterId}」を参照しています。`,
          })
        }

        /*
          同じ人を両方に載せると、その人はその場に居たのか離れて見ていたのか決まらない。
          決まらないまま線を引くと、盤面に「居なかった場所に立っている人」が現れる。
        */
        if (event.participants.includes(characterId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['timeline', eventIndex, 'witnesses', witnessIndex],
            message: `「${characterId}」が participants と witnesses の両方にいます。居た場所はどちらか一方です。`,
          })
        }
      })

      if (event.room !== undefined && !locationIds.has(event.room)) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeline', eventIndex, 'room'],
          message: `存在しない部屋「${event.room}」を参照しています。`,
        })
      }

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

    if (scenario.victim?.foundRoom !== undefined && !locationIds.has(scenario.victim.foundRoom)) {
      ctx.addIssue({
        code: 'custom',
        path: ['victim', 'foundRoom'],
        message: `存在しない部屋「${scenario.victim.foundRoom}」を参照しています。`,
      })
    }

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
        const issue = sourceIssue(source)

        if (issue !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['revelations', revelationIndex, 'sources', sourceIndex, 'id'],
            message: issue,
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
        const issue = sourceIssue(source)

        if (issue !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['evidences', evidenceIndex, 'sources', sourceIndex, 'id'],
            message: issue,
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

    const publicText = [
      scenario.meta.title,
      scenario.meta.synopsis,
      scenario.meta.category,
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
  },
)

export type ScenarioEvidenceSource = z.infer<typeof scenarioEvidenceSourceSchema>
export type ScenarioRevelationSource = z.infer<typeof scenarioRevelationSourceSchema>
export type ScenarioRevelation = z.infer<typeof scenarioRevelationSchema>
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>
export type ScenarioDefinitionInput = z.input<typeof ScenarioDefinitionSchema>
