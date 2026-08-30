import { useReducer, useState } from 'react'
import { FloorPlanEditorCanvas } from '@/client/components/FloorPlanEditorCanvas'
import { FloorPlanInspector } from '@/client/components/FloorPlanInspector'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import {
  editorReducer,
  initialEditorState,
  parsePastedPlan,
  planToJson,
} from '@/client/lib/floor-plan-editor'
import { type FloorPlan, parseFloorPlan, validateFloorPlan } from '~/db/floor-plan'
import { TSUKIMISOU_PLAN } from '~/db/floor-plans/tsukimisou'

const BLANK: FloorPlan = { width: 100, height: 70, north: 'up', rooms: [] }

/** 配られている図面を最初に出す。白紙より、直したい図がそこにあるほうが早い。 */
const startingPlan = (): FloorPlan => {
  const parsed = parseFloorPlan(TSUKIMISOU_PLAN)

  return parsed === undefined ? BLANK : parsed
}

const LEGEND = 'text-[10px] tracking-[0.3em] text-slate-600'

/**
 * 見取り図を作るための道具。
 *
 * プレイヤー向けの画面ではない。ゲーム側からの導線は張っていないし、
 * ここで描いた図が DB に入ることもない。書き出した JSON を
 * `db/floor-plans/` のファイルへ貼って、`bun run db:seed` で流し込む。
 *
 * 保存を持たないのは意図的。作りかけを持ち歩ける置き場を用意すると、
 * 「エディタの中の図」と「配られている図」の二つが並び立って、どちらが本物か
 * 分からなくなる。正典はいつでもリポジトリの中のファイル1枚にしておく。
 */
export const FloorPlanEditorScreen = () => {
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    initialEditorState(startingPlan()),
  )
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  const issues = validateFloorPlan(state.plan)
  const json = planToJson(state.plan)

  const load = () => {
    const parsed = parsePastedPlan(pasted)

    if (parsed === undefined) {
      setPasteError('図面として読めませんでした。JSON の形を確かめてください。')

      return
    }

    setPasteError(undefined)
    setPasted('')
    dispatch({ type: 'set-plan', plan: parsed })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 bg-slate-950 px-5 py-6 text-slate-100">
      <header className="flex items-baseline justify-between border-b border-slate-800 pb-3">
        <h1 className="text-xl font-bold">見取り図エディタ</h1>
        <p className="text-xs text-slate-600">制作用。ここでの編集は保存されません</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3">
          <FloorPlanEditorCanvas state={state} issues={issues} dispatch={dispatch} />

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>部屋 {state.plan.rooms.length}</span>
            <Button
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => dispatch({ type: 'set-plan', plan: BLANK })}
            >
              白紙から始める
            </Button>
          </div>
        </div>

        <FloorPlanInspector state={state} dispatch={dispatch} />
      </div>

      <section className="flex flex-col gap-2 border-t border-slate-800 pt-4">
        <h2 className={LEGEND}>図面の検査</h2>

        {issues.length === 0 ? (
          <p className="text-sm text-slate-400">問題はありません。</p>
        ) : (
          <ul className="flex flex-col">
            {issues.map((issue) => (
              <li
                key={`${issue.kind}-${issue.roomIds.join('-')}-${issue.message}`}
                className="border-b border-slate-800 py-2 text-sm text-red-400"
              >
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between">
          <h2 className={LEGEND}>書き出し</h2>
          <Button
            variant="link"
            size="sm"
            className="px-0 text-slate-400"
            onClick={() => {
              navigator.clipboard
                .writeText(json)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }}
          >
            {copied ? 'コピーしました' : 'JSON をコピー'}
          </Button>
        </div>
        {/* rows で決めた高さのまま置く。中身に合わせて伸びると図面ぶんの JSON で画面が埋まる。 */}
        <Textarea
          readOnly
          value={json}
          rows={10}
          className="field-sizing-fixed font-mono text-xs text-slate-300"
        />
      </section>

      <section className="flex flex-col gap-2 border-t border-slate-800 pt-4 pb-10">
        <h2 className={LEGEND}>読み込み</h2>
        <Textarea
          value={pasted}
          rows={4}
          placeholder="図面の JSON を貼り付けて読み込みます"
          className="field-sizing-fixed font-mono text-xs text-slate-300"
          onChange={(event) => setPasted(event.target.value)}
        />
        {pasteError !== undefined && <p className="text-sm text-red-400">{pasteError}</p>}
        <Button size="block" disabled={pasted === ''} onClick={load}>
          この図面を読み込む
        </Button>
      </section>
    </div>
  )
}
