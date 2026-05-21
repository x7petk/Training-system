import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import type { DdsTriggerDomain, DdsTriggerPointKind } from '../features/dds/ddsTriggerTypes'
import {
  ddsBtn,
  ddsBtnDanger,
  ddsErr,
  ddsH2,
  ddsH3,
  ddsHint,
  ddsInput,
  ddsInset,
  ddsSection,
  ddsSelect,
  ddsStack,
} from '../features/dds/ddsAdminCompactClasses'

type QuestionRow = {
  id: string
  domain: DdsTriggerDomain
  point_kind: DdsTriggerPointKind
  risk_points: string
  prompt: string
  sort_order: number
  master_cell_id: string | null
  is_active: boolean
}

const DOMAINS: { value: DdsTriggerDomain; label: string }[] = [
  { value: 'safety', label: 'Safety' },
  { value: 'quality', label: 'Quality' },
]

const RISK_OPTS = ['3', '6', '9'] as const

export function DdsAdminTriggersPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const [domain, setDomain] = useState<DdsTriggerDomain>('safety')
  const [hardQs, setHardQs] = useState<QuestionRow[]>([])
  const [softQs, setSoftQs] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newPrompt, setNewPrompt] = useState('')
  const [newRisk, setNewRisk] = useState<'3' | '6' | '9'>('3')
  const [newKind, setNewKind] = useState<DdsTriggerPointKind>('hard_point')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_trigger_questions')
      .select('id, domain, point_kind, risk_points, prompt, sort_order, master_cell_id, is_active')
      .eq('domain', domain)
      .order('sort_order')
      .order('prompt')
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const rows = (data ?? []) as QuestionRow[]
    setHardQs(rows.filter((r) => r.point_kind === 'hard_point'))
    setSoftQs(rows.filter((r) => r.point_kind === 'soft_point' && (!cellId || r.master_cell_id === cellId)))
  }, [domain, cellId])

  useEffect(() => {
    void load()
  }, [load])

  async function addQuestion() {
    const prompt = newPrompt.trim()
    if (!prompt) return
    if (newKind === 'soft_point' && !cellId) {
      setError('Select a cell in the scope bar for soft-point questions.')
      return
    }
    const maxOrder = Math.max(0, ...hardQs.map((q) => q.sort_order), ...softQs.map((q) => q.sort_order))
    const { error: insErr } = await supabase.from('dds_trigger_questions').insert({
      domain,
      point_kind: newKind,
      risk_points: newRisk,
      prompt,
      sort_order: maxOrder + 10,
      master_cell_id: newKind === 'soft_point' ? cellId : null,
    })
    if (insErr) setError(insErr.message)
    else {
      setNewPrompt('')
      await load()
    }
  }

  async function updateQuestion(id: string, patch: Partial<QuestionRow>) {
    const { error: uErr } = await supabase.from('dds_trigger_questions').update(patch).eq('id', id)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm('Delete this trigger question?')) return
    const { error: dErr } = await supabase.from('dds_trigger_questions').delete().eq('id', id)
    if (dErr) setError(dErr.message)
    else await load()
  }

  function renderList(list: QuestionRow[], editable: boolean) {
    if (list.length === 0) {
      return <p className={ddsHint}>No questions yet.</p>
    }
    return (
      <ul className="space-y-2">
        {list.map((q) => (
          <li key={q.id} className={ddsInset}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${ddsInput} min-w-[12rem] flex-1`}
                value={q.prompt}
                disabled={!editable}
                onBlur={(e) => editable && void updateQuestion(q.id, { prompt: e.target.value.trim() })}
              />
              <select
                className={ddsSelect}
                value={q.risk_points}
                disabled={!editable}
                onChange={(e) => void updateQuestion(q.id, { risk_points: e.target.value })}
              >
                {RISK_OPTS.map((r) => (
                  <option key={r} value={r}>
                    {r} pts
                  </option>
                ))}
              </select>
              <button type="button" className={ddsBtnDanger} onClick={() => void deleteQuestion(q.id)}>
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={ddsStack}>
      <h2 className={`${ddsH2} font-display text-xl font-semibold`}>Triggers — Safety & Quality</h2>
      <p className={ddsHint}>
        Hard points apply to <strong>all cells</strong>. Soft points apply to the <strong>selected cell</strong> only
        (use scope bar). Yes = risk adds points; No = 0. Score: &lt;6 green, 6–8 yellow, &gt;8 red.
      </p>

      {scopeStatus === 'error' ? <p className={ddsErr}>{scopeError}</p> : null}

      <section className={ddsSection}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-medium text-muted">Domain</label>
            <select className={ddsSelect} value={domain} onChange={(e) => setDomain(e.target.value as DdsTriggerDomain)}>
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted">New question type</label>
            <select
              className={ddsSelect}
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as DdsTriggerPointKind)}
            >
              <option value="hard_point">Hard (all cells)</option>
              <option value="soft_point">Soft (this cell)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted">Risk if Yes</label>
            <select className={ddsSelect} value={newRisk} onChange={(e) => setNewRisk(e.target.value as '3' | '6' | '9')}>
              {RISK_OPTS.map((r) => (
                <option key={r} value={r}>
                  {r} pts
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[14rem] flex-1">
            <label className="text-[10px] font-medium text-muted">Prompt</label>
            <input
              className={ddsInput}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Control question…"
            />
          </div>
          <button type="button" className={ddsBtn} onClick={() => void addQuestion()}>
            <Plus className="size-3.5" aria-hidden /> Add
          </button>
        </div>
      </section>

      {error ? <p className={ddsErr}>{error}</p> : null}
      {loading ? <p className={ddsHint}>Loading…</p> : null}

      <section className={ddsSection}>
        <h3 className={ddsH3}>Hard points (all cells)</h3>
        {renderList(hardQs, true)}
      </section>

      <section className={ddsSection}>
        <h3 className={ddsH3}>Soft points (selected cell)</h3>
        {!cellId ? (
          <p className={ddsHint}>
            <Link to="/dds-process/plan-24" className="text-accent underline">
              Select a cell
            </Link>{' '}
            in the scope bar to manage soft-point questions.
          </p>
        ) : (
          renderList(softQs, true)
        )}
      </section>
    </div>
  )
}
