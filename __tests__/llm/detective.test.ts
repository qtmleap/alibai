import { describe, expect, test } from 'bun:test'
import { buildDetectiveBlock } from '@/server/llm/detective'
import type { Detective } from '~/db/detective'

const detective = (patch: Partial<Detective>): Detective => ({
  name: '日下部 灯',
  ageGroup: 'young',
  gender: 'female',
  appearance: '',
  ...patch,
})

describe('buildDetectiveBlock', () => {
  test('十代の少女には、年上のNPCが「お嬢さん」と呼びかける指示が出る', () => {
    const block = buildDetectiveBlock(detective({ ageGroup: 'teen', gender: 'female' }))

    expect(block).toContain('あなたのほうが年上なら、「お嬢さん」')
  })

  test('同じ十代でも男性なら呼びかけが変わる', () => {
    const block = buildDetectiveBlock(detective({ ageGroup: 'teen', gender: 'male' }))

    expect(block).toContain('「少年」')
    expect(block).not.toContain('お嬢さん')
  })

  test('老齢の探偵には、年下のNPCが「ご老人」と呼びかける', () => {
    const block = buildDetectiveBlock(detective({ ageGroup: 'elder', gender: 'male' }))

    expect(block).toContain('あなたのほうが年下なら、「おじいさん」「ご老人」')
  })

  test('性別を明かさない場合は、性別で決めつけた呼称を使わない', () => {
    const block = buildDetectiveBlock(detective({ ageGroup: 'adult', gender: 'unknown' }))

    expect(block).toContain('「そちらさん」')
    expect(block).not.toContain('旦那')
  })

  test('年ごろが不詳なら、年齢を決めつけないよう釘を刺す', () => {
    const block = buildDetectiveBlock(detective({ ageGroup: 'unknown' }))

    expect(block).toContain('年齢を決めつけた呼びかけは避ける')
  })

  test('変わるのは口調だけだと明記する（設定で難度が動かないように）', () => {
    const block = buildDetectiveBlock(detective({}))

    expect(block).toContain('答える中身（知っていること・隠すこと）は変えない')
  })

  test('容姿が空なら「外見:」の行そのものを出さない（無いと勝手に作られる）', () => {
    const filled = buildDetectiveBlock(detective({ appearance: 'くたびれたコート' }))
    const empty = buildDetectiveBlock(detective({ appearance: '' }))

    expect(filled).toContain('外見: くたびれたコート')
    expect(empty).not.toContain('外見:')
  })

  test('探偵が何を掴んでいるかは書かない（NPCが推理を先回りしないように）', () => {
    const block = buildDetectiveBlock(detective({}))

    expect(block).toContain('何をどこまで掴んでいるかは分からない前提')
  })
})
