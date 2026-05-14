import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DDS_P2P_RESPONSE_KINDS, type DdsP2pResponseKind, isDdsP2pResponseKind } from '../features/dds/ddsP2pResponseKind'

type KpiGroupRow = {
  id: string
  name: string
  sort_order: number
  display_sections: string[] | null
}

type QuestionRow = {
  id: string
  kpi_group_id: string
  prompt: string
  sort_order: number
  response_kind: string
  target_number: number | string | null
}

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

const textareaClass =
  'mt-1 min-h-[4.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

const selectClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

function parseTargetNumber(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function targetToInputValue(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function groupShowsP2p(g: KpiGroupRow): boolean {
  return (g.display_sections ?? []).includes('p2p')
}

export function DdsAdminP2pStandardPage() {
  const [groups, setGroups] = useState<KpiGroupRow[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [groupId, setGroupId] = useState('')
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [qDrafts, setQDrafts] = useState<
    Record<string, { prompt: string; response_kind: DdsP2pResponseKind; targetText: string }>
  >({})
  const [loadingQs, setLoadingQs] = useState(false)
  const [newPrompt, setNewPrompt] = useState('')
  const [newKind, setNewKind] = useState<DdsP2pResponseKind>('yes_no')
  const [newTargetText, setNewTargetText] = useState('')
  const [qSavingId, setQSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_kpi_groups')
      .select('id, name, sort_order, display_sections')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoadingGroups(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as KpiGroupRow[]
    setGroups(list)
    setGroupId((prev) => {
      if (prev && list.some((g) => g.id === prev)) return prev
      return list[0]?.id ?? ''
    })
  }, [])

  const loadQuestions = useCallback(async (gid: string) => {
    if (!gid) {
      setQuestions([])
      setQDrafts({})
      return
    }
    setLoadingQs(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_p2p_standard_questions')
      .select('id, kpi_group_id, prompt, sort_order, response_kind, target_number')
      .eq('kpi_group_id', gid)
      .order('sort_order', { ascending: true })
      .order('prompt', { ascending: true })
    setLoadingQs(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as QuestionRow[]
    setQuestions(list)
    const next: Record<string, { prompt: string; response_kind: DdsP2pResponseKind; targetText: string }> = {}
    for (const q of list) {
      const kind = isDdsP2pResponseKind(q.response_kind) ? q.response_kind : 'yes_no'
      next[q.id] = {
        prompt: q.prompt,
        response_kind: kind,
        targetText: kind === 'number_with_target' ? targetToInputValue(q.target_number) : '',
      }
    }
    setQDrafts(next)
  }, [])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  useEffect(() => {
    void loadQuestions(groupId)
  }, [groupId, loadQuestions])

  function buildQuestionPayload(d: { prompt: string; response_kind: DdsP2pResponseKind; targetText: string }): {
    prompt: string
    response_kind: DdsP2pResponseKind
    target_number: number | null
  } | null {
    const prompt = d.prompt.trim()
    if (!prompt) return null
    if (d.response_kind === 'yes_no') {
      return { prompt, response_kind: 'yes_no', target_number: null }
    }
    const target = parseTargetNumber(d.targetText)
    if (target === null) {
      setError('Number questions need a target value.')
      return null
    }
    return { prompt, response_kind: 'number_with_target', target_number: target }
  }

  async function addQuestion() {
    if (!groupId) return
    if (!newPrompt.trim()) return
    setError(null)
    const payload = buildQuestionPayload({
      prompt: newPrompt,
      response_kind: newKind,
      targetText: newTargetText,
    })
    if (!payload) return
    const nextOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_p2p_standard_questions').insert({
      kpi_group_id: groupId,
      prompt: payload.prompt,
      response_kind: payload.response_kind,
      target_number: payload.target_number,
      sort_order: nextOrder,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewPrompt('')
    setNewKind('yes_no')
    setNewTargetText('')
    await loadQuestions(groupId)
  }

  async function saveQuestion(id: string) {
    const d = qDrafts[id]
    if (!d) return
    setError(null)
    const payload = buildQuestionPayload(d)
    if (!payload) {
      if (!d.prompt.trim()) setError('Question text is required.')
      return
    }
    setQSavingId(id)
    const { error: uErr } = await supabase
      .from('dds_p2p_standard_questions')
      .update({
        prompt: payload.prompt,
        response_kind: payload.response_kind,
        target_number: payload.target_number,
      })
      .eq('id', id)
    setQSavingId(null)
    if (uErr) setError(uErr.message)
    else await loadQuestions(groupId)
  }

  async function removeQuestion(row: QuestionRow) {
    if (!confirm('Remove this question?')) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_p2p_standard_questions').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await loadQuestions(groupId)
  }

  if (loadingGroups) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-raised/50 px-4 py-3 text-sm text-muted">
        Create{' '}
        <Link to="/dds-process/admin/kpi-groups" className="font-medium text-accent underline-offset-2 hover:underline">
          KPI groups
        </Link>{' '}
        first, then add P2P standard questions for each group here.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted">
        Questions are global (every cell). Pick a KPI group, then define the standard questions for that group. Turn on
        P2P for a group under KPI groups if those questions should appear on the P2P screen.
      </p>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">P2P standard questions</h2>
        <p className="mt-1 text-xs text-muted">KPI group comes from Admin → KPI groups. Names must be unique per group.</p>

        <div className="mt-4">
          <label htmlFor="p2p-q-group" className="text-xs font-medium text-muted">
            KPI group
          </label>
          <select
            id="p2p-q-group"
            className={selectClass}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {!groupShowsP2p(g) ? ' (P2P display off)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">New question</h3>
          <div>
            <label htmlFor="p2p-new-q-prompt" className="text-xs font-medium text-muted">
              Question
            </label>
            <textarea
              id="p2p-new-q-prompt"
              className={textareaClass}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="What do you ask on the line?"
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="p2p-new-q-kind" className="text-xs font-medium text-muted">
                Answer type
              </label>
              <select
                id="p2p-new-q-kind"
                className={selectClass}
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as DdsP2pResponseKind)}
              >
                {DDS_P2P_RESPONSE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            {newKind === 'number_with_target' ? (
              <div>
                <label htmlFor="p2p-new-q-target" className="text-xs font-medium text-muted">
                  Target number
                </label>
                <input
                  id="p2p-new-q-target"
                  className={inputClass}
                  value={newTargetText}
                  onChange={(e) => setNewTargetText(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 100"
                />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            disabled={!newPrompt.trim()}
            onClick={() => void addQuestion()}
          >
            <Plus className="size-4" aria-hidden />
            Add question
          </button>
        </div>

        {loadingQs ? (
          <p className="mt-4 text-sm text-muted">Loading questions…</p>
        ) : questions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No questions for this group yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {questions.map((row) => {
              const d = qDrafts[row.id]
              if (!d) return null
              return (
                <li key={row.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted" htmlFor={`p2p-q-prompt-${row.id}`}>
                        Question
                      </label>
                      <textarea
                        id={`p2p-q-prompt-${row.id}`}
                        className={textareaClass}
                        rows={3}
                        value={d.prompt}
                        onChange={(e) =>
                          setQDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...d, prompt: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-xs font-medium text-muted" htmlFor={`p2p-q-kind-${row.id}`}>
                          Answer type
                        </label>
                        <select
                          id={`p2p-q-kind-${row.id}`}
                          className={selectClass}
                          value={d.response_kind}
                          onChange={(e) => {
                            const kind = e.target.value as DdsP2pResponseKind
                            setQDrafts((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...d,
                                response_kind: kind,
                                targetText: kind === 'number_with_target' ? d.targetText : '',
                              },
                            }))
                          }}
                        >
                          {DDS_P2P_RESPONSE_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {d.response_kind === 'number_with_target' ? (
                        <div>
                          <label className="text-xs font-medium text-muted" htmlFor={`p2p-q-target-${row.id}`}>
                            Target number
                          </label>
                          <input
                            id={`p2p-q-target-${row.id}`}
                            className={inputClass}
                            value={d.targetText}
                            onChange={(e) =>
                              setQDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...d, targetText: e.target.value },
                              }))
                            }
                            inputMode="decimal"
                          />
                        </div>
                      ) : null}
                      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                        <button
                          type="button"
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06] lg:flex-none"
                          disabled={qSavingId === row.id}
                          onClick={() => void saveQuestion(row.id)}
                        >
                          {qSavingId === row.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                          title="Delete question"
                          onClick={() => void removeQuestion(row)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
