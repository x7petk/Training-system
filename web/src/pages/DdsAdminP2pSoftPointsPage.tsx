import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  DDS_P2P_RESPONSE_KINDS,
  labelForDdsP2pResponseKind,
  type DdsP2pResponseKind,
  isDdsP2pResponseKind,
} from '../features/dds/ddsP2pResponseKind'

type StdQuestion = {
  id: string
  kpi_group_id: string
  prompt: string
  response_kind: string
  target_number: number | string | null
  sort_order: number
}

type KpiGroupRow = {
  id: string
  name: string
  sort_order: number
}

type CellQuestionRow = {
  id: string
  master_cell_id: string
  kpi_group_id: string
  prompt: string
  response_kind: string
  target_number: number | string | null
  sort_order: number
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

export function DdsAdminP2pSoftPointsPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const [stdQuestions, setStdQuestions] = useState<StdQuestion[]>([])
  const [groupNames, setGroupNames] = useState<Record<string, string>>({})
  const [loadingStd, setLoadingStd] = useState(true)

  const [kpiGroups, setKpiGroups] = useState<KpiGroupRow[]>([])
  const [loadingKpiGroups, setLoadingKpiGroups] = useState(true)
  const [groupId, setGroupId] = useState('')

  const [cellQuestions, setCellQuestions] = useState<CellQuestionRow[]>([])
  const [loadingCellQs, setLoadingCellQs] = useState(false)
  const [qDrafts, setQDrafts] = useState<
    Record<string, { prompt: string; response_kind: DdsP2pResponseKind; targetText: string }>
  >({})
  const [newPrompt, setNewPrompt] = useState('')
  const [newKind, setNewKind] = useState<DdsP2pResponseKind>('yes_no')
  const [newTargetText, setNewTargetText] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadGlobalStandard = useCallback(async () => {
    setLoadingStd(true)
    setError(null)
    const { data: qs, error: qErr } = await supabase
      .from('dds_p2p_standard_questions')
      .select('id, kpi_group_id, prompt, response_kind, target_number, sort_order')
      .order('sort_order', { ascending: true })
      .order('prompt', { ascending: true })
    if (qErr) {
      setError(qErr.message)
      setLoadingStd(false)
      return
    }
    const list = (qs ?? []) as StdQuestion[]
    setStdQuestions(list)
    const gids = [...new Set(list.map((q) => q.kpi_group_id))]
    if (gids.length === 0) {
      setGroupNames({})
      setLoadingStd(false)
      return
    }
    const { data: grps, error: gErr } = await supabase.from('dds_kpi_groups').select('id, name').in('id', gids)
    if (gErr) {
      setError(gErr.message)
      setLoadingStd(false)
      return
    }
    const map: Record<string, string> = {}
    for (const g of grps ?? []) {
      map[g.id as string] = g.name as string
    }
    setGroupNames(map)
    setLoadingStd(false)
  }, [])

  const loadKpiGroups = useCallback(async () => {
    setLoadingKpiGroups(true)
    setError(null)
    const { data, error: gErr } = await supabase
      .from('dds_kpi_groups')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoadingKpiGroups(false)
    if (gErr) {
      setError(gErr.message)
      return
    }
    const list = (data ?? []) as KpiGroupRow[]
    setKpiGroups(list)
    setGroupId((prev) => {
      if (prev && list.some((g) => g.id === prev)) return prev
      return list[0]?.id ?? ''
    })
  }, [])

  const loadCellQuestions = useCallback(async (cid: string, gid: string) => {
    if (!cid || !gid) {
      setCellQuestions([])
      setQDrafts({})
      return
    }
    setLoadingCellQs(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_p2p_cell_soft_point_questions')
      .select('id, master_cell_id, kpi_group_id, prompt, response_kind, target_number, sort_order')
      .eq('master_cell_id', cid)
      .eq('kpi_group_id', gid)
      .order('sort_order', { ascending: true })
      .order('prompt', { ascending: true })
    setLoadingCellQs(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as CellQuestionRow[]
    setCellQuestions(list)
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
    void loadGlobalStandard()
    void loadKpiGroups()
  }, [loadGlobalStandard, loadKpiGroups])

  useEffect(() => {
    if (scopeStatus !== 'ready' || !cellId || !groupId) {
      setCellQuestions([])
      setQDrafts({})
      return
    }
    void loadCellQuestions(cellId, groupId)
  }, [scopeStatus, cellId, groupId, loadCellQuestions])

  const stdGrouped = useMemo(() => {
    const map = new Map<string, StdQuestion[]>()
    for (const q of stdQuestions) {
      const g = groupNames[q.kpi_group_id] ?? 'KPI group'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(q)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [stdQuestions, groupNames])

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
    if (!cellId || !groupId) return
    if (!newPrompt.trim()) return
    setError(null)
    const payload = buildQuestionPayload({
      prompt: newPrompt,
      response_kind: newKind,
      targetText: newTargetText,
    })
    if (!payload) return
    const nextOrder = cellQuestions.length > 0 ? Math.max(...cellQuestions.map((q) => q.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_p2p_cell_soft_point_questions').insert({
      master_cell_id: cellId,
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
    await loadCellQuestions(cellId, groupId)
  }

  async function saveQuestion(id: string) {
    const d = qDrafts[id]
    if (!d || !cellId || !groupId) return
    setError(null)
    const payload = buildQuestionPayload(d)
    if (!payload) {
      if (!d.prompt.trim()) setError('Question text is required.')
      return
    }
    setSavingId(id)
    const { error: uErr } = await supabase
      .from('dds_p2p_cell_soft_point_questions')
      .update({
        prompt: payload.prompt,
        response_kind: payload.response_kind,
        target_number: payload.target_number,
      })
      .eq('id', id)
    setSavingId(null)
    if (uErr) setError(uErr.message)
    else await loadCellQuestions(cellId, groupId)
  }

  async function removeQuestion(row: CellQuestionRow) {
    if (!confirm('Remove this soft point question for this cell?')) return
    if (!cellId || !groupId) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_p2p_cell_soft_point_questions').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await loadCellQuestions(cellId, groupId)
  }

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (scopeStatus === 'error') {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {scopeError ?? 'Could not load master data.'}
      </p>
    )
  }

  return (
    <div className="space-y-10">
      <p className="max-w-2xl text-sm text-muted">
        Global P2P standard questions apply everywhere and are read-only here. Soft point questions are per cell and per
        KPI group (same groups as P2P standard), with the same answer types (yes/no or number with target).
      </p>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">Global P2P standard questions</h2>
        <p className="mt-1 text-xs text-muted">Defined under P2P standard. Read-only here.</p>
        {loadingStd ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : stdQuestions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            None yet. Add them under{' '}
            <Link to="/dds-process/admin/p2p-standard" className="font-medium text-accent underline-offset-2 hover:underline">
              P2P standard
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {stdGrouped.map(([gname, qs]) => (
              <div key={gname}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{gname}</h3>
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
                  {qs.map((q) => (
                    <li key={q.id} className="px-4 py-3">
                      <p className="text-sm text-fg">{q.prompt}</p>
                      <p className="mt-1 text-xs text-muted">
                        {labelForDdsP2pResponseKind(q.response_kind)}
                        {q.response_kind === 'number_with_target' && q.target_number != null
                          ? ` · target ${q.target_number}`
                          : null}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {scopeStatus === 'ready' && !cellId ? (
        <p className="rounded-xl border border-border bg-surface-raised/50 px-4 py-3 text-sm text-muted">
          Choose a site, plant, and cell in the scope bar to add or edit soft point questions for that cell only.
        </p>
      ) : null}

      {scopeStatus === 'ready' && cellId ? (
        <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-fg">Soft point questions for this cell</h2>
          <p className="mt-1 text-xs text-muted">
            Pick a KPI group, then manage questions for this cell only. Question text must be unique per cell and group
            (case-insensitive).
          </p>

          {loadingKpiGroups ? (
            <p className="mt-4 text-sm text-muted">Loading groups…</p>
          ) : kpiGroups.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Create a{' '}
              <Link to="/dds-process/admin/kpi-groups" className="font-medium text-accent underline-offset-2 hover:underline">
                KPI group
              </Link>{' '}
              first.
            </p>
          ) : (
            <>
              <div className="mt-4">
                <label htmlFor="cell-soft-kpi-group" className="text-xs font-medium text-muted">
                  KPI group
                </label>
                <select
                  id="cell-soft-kpi-group"
                  className={selectClass}
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  {kpiGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">New question</h3>
                <div>
                  <label htmlFor="cell-soft-new-prompt" className="text-xs font-medium text-muted">
                    Question
                  </label>
                  <textarea
                    id="cell-soft-new-prompt"
                    className={textareaClass}
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="Cell-specific soft point question"
                    rows={3}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cell-soft-new-kind" className="text-xs font-medium text-muted">
                      Answer type
                    </label>
                    <select
                      id="cell-soft-new-kind"
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
                      <label htmlFor="cell-soft-new-target" className="text-xs font-medium text-muted">
                        Target number
                      </label>
                      <input
                        id="cell-soft-new-target"
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
                  disabled={!newPrompt.trim() || !groupId}
                  onClick={() => void addQuestion()}
                >
                  <Plus className="size-4" aria-hidden />
                  Add question
                </button>
              </div>

              {loadingCellQs ? (
                <p className="mt-4 text-sm text-muted">Loading cell questions…</p>
              ) : cellQuestions.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No soft point questions for this cell in this group yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {cellQuestions.map((row) => {
                    const d = qDrafts[row.id]
                    if (!d) return null
                    return (
                      <li key={row.id} className="rounded-xl border border-border bg-surface p-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted" htmlFor={`cell-soft-prompt-${row.id}`}>
                              Question
                            </label>
                            <textarea
                              id={`cell-soft-prompt-${row.id}`}
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
                              <label className="text-xs font-medium text-muted" htmlFor={`cell-soft-kind-${row.id}`}>
                                Answer type
                              </label>
                              <select
                                id={`cell-soft-kind-${row.id}`}
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
                                <label className="text-xs font-medium text-muted" htmlFor={`cell-soft-target-${row.id}`}>
                                  Target number
                                </label>
                                <input
                                  id={`cell-soft-target-${row.id}`}
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
                                disabled={savingId === row.id}
                                onClick={() => void saveQuestion(row.id)}
                              >
                                {savingId === row.id ? 'Saving…' : 'Save'}
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
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}
