import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  DDS_P2P_RESPONSE_KINDS,
  labelForDdsP2pResponseKind,
  type DdsP2pResponseKind,
  isDdsP2pResponseKind,
} from '../features/dds/ddsP2pResponseKind'
import {
  ddsBtn,
  ddsBtnDanger,
  ddsBtnGhostGrow,
  ddsErr,
  ddsH2,
  ddsH3,
  ddsHint,
  ddsInput,
  ddsInset,
  ddsSection,
  ddsSelect,
  ddsStack,
  ddsTextarea,
} from '../features/dds/ddsAdminCompactClasses'

type StdQuestion = {
  id: string
  kpi_group_id: string
  prompt: string
  response_kind: string
  target_number: number | string | null
  sort_order: number
  linked_kpi_id: string | null
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
  linked_kpi_id: string | null
}

type SubQuestionRow = {
  id: string
  soft_question_id: string
  prompt: string
  sort_order: number
}

type KpiOption = { id: string; label: string; kpi_group_id: string; sort_order: number }

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
    Record<string, { prompt: string; response_kind: DdsP2pResponseKind; targetText: string; linkedKpiId: string }>
  >({})
  const [kpiOptions, setKpiOptions] = useState<KpiOption[]>([])
  const [kpiLabels, setKpiLabels] = useState<Record<string, string>>({})
  const [newPrompt, setNewPrompt] = useState('')
  const [newKind, setNewKind] = useState<DdsP2pResponseKind>('yes_no')
  const [newTargetText, setNewTargetText] = useState('')
  const [newLinkedKpiId, setNewLinkedKpiId] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subQuestionsByParent, setSubQuestionsByParent] = useState<Record<string, SubQuestionRow[]>>({})
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({})
  const [newSubPromptByParent, setNewSubPromptByParent] = useState<Record<string, string>>({})
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [savingSubId, setSavingSubId] = useState<string | null>(null)

  const loadGlobalStandard = useCallback(async () => {
    setLoadingStd(true)
    setError(null)
    const { data: qs, error: qErr } = await supabase
      .from('dds_p2p_standard_questions')
      .select('id, kpi_group_id, prompt, response_kind, target_number, sort_order, linked_kpi_id')
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

  const loadKpiOptions = useCallback(async () => {
    const { data, error: kErr } = await supabase
      .from('dds_kpis')
      .select('id, label, kpi_group_id, sort_order')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })
    if (kErr) {
      setError(kErr.message)
      return
    }
    const list = (data ?? []) as KpiOption[]
    setKpiOptions(list)
    const labels: Record<string, string> = {}
    for (const k of list) labels[k.id] = k.label
    setKpiLabels(labels)
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
      .select('id, master_cell_id, kpi_group_id, prompt, response_kind, target_number, sort_order, linked_kpi_id')
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
    const next: Record<string, { prompt: string; response_kind: DdsP2pResponseKind; targetText: string; linkedKpiId: string }> = {}
    for (const q of list) {
      const kind = isDdsP2pResponseKind(q.response_kind) ? q.response_kind : 'yes_no'
      next[q.id] = {
        prompt: q.prompt,
        response_kind: kind,
        targetText: kind === 'number_with_target' ? targetToInputValue(q.target_number) : '',
        linkedKpiId: q.linked_kpi_id ?? '',
      }
    }
    setQDrafts(next)

    const qIds = list.map((q) => q.id)
    if (qIds.length === 0) {
      setSubQuestionsByParent({})
      setSubDrafts({})
      return
    }
    const { data: subRows, error: subErr } = await supabase
      .from('dds_p2p_cell_soft_point_sub_questions')
      .select('id, soft_question_id, prompt, sort_order')
      .in('soft_question_id', qIds)
      .order('sort_order', { ascending: true })
      .order('prompt', { ascending: true })
    if (subErr) {
      setError(subErr.message)
      return
    }
    const subs = (subRows ?? []) as SubQuestionRow[]
    const byParent: Record<string, SubQuestionRow[]> = {}
    const subDraftNext: Record<string, string> = {}
    for (const sq of subs) {
      if (!byParent[sq.soft_question_id]) byParent[sq.soft_question_id] = []
      byParent[sq.soft_question_id]!.push(sq)
      subDraftNext[sq.id] = sq.prompt
    }
    setSubQuestionsByParent(byParent)
    setSubDrafts(subDraftNext)
  }, [])

  useEffect(() => {
    void loadGlobalStandard()
    void loadKpiGroups()
    void loadKpiOptions()
  }, [loadGlobalStandard, loadKpiGroups, loadKpiOptions])

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
      linked_kpi_id: newKind === 'yes_no' && newLinkedKpiId ? newLinkedKpiId : null,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewPrompt('')
    setNewKind('yes_no')
    setNewTargetText('')
    setNewLinkedKpiId('')
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
    const subs = subQuestionsByParent[id] ?? []
    const { error: uErr } = await supabase
      .from('dds_p2p_cell_soft_point_questions')
      .update({
        prompt: payload.prompt,
        response_kind: payload.response_kind,
        target_number: payload.target_number,
        linked_kpi_id:
          d.response_kind === 'yes_no' && d.linkedKpiId && subs.length === 0 ? d.linkedKpiId : null,
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

  async function addSubQuestion(parentId: string) {
    const prompt = (newSubPromptByParent[parentId] ?? '').trim()
    if (!prompt || !cellId || !groupId) return
    setError(null)
    const existing = subQuestionsByParent[parentId] ?? []
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_p2p_cell_soft_point_sub_questions').insert({
      soft_question_id: parentId,
      prompt,
      sort_order: nextOrder,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewSubPromptByParent((prev) => ({ ...prev, [parentId]: '' }))
    setExpandedSubs((prev) => new Set(prev).add(parentId))
    await loadCellQuestions(cellId, groupId)
  }

  async function saveSubQuestion(subId: string, parentId: string) {
    const prompt = (subDrafts[subId] ?? '').trim()
    if (!prompt || !cellId || !groupId) return
    setError(null)
    setSavingSubId(subId)
    const { error: uErr } = await supabase
      .from('dds_p2p_cell_soft_point_sub_questions')
      .update({ prompt })
      .eq('id', subId)
    setSavingSubId(null)
    if (uErr) setError(uErr.message)
    else await loadCellQuestions(cellId, groupId)
    void parentId
  }

  async function removeSubQuestion(subId: string) {
    if (!confirm('Remove this sub-question?')) return
    if (!cellId || !groupId) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_p2p_cell_soft_point_sub_questions').delete().eq('id', subId)
    if (dErr) setError(dErr.message)
    else await loadCellQuestions(cellId, groupId)
  }

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (scopeStatus === 'error') {
    return <p className={ddsErr}>{scopeError ?? 'Could not load master data.'}</p>
  }

  return (
    <div className={ddsStack}>
      <p className="max-w-2xl text-xs leading-snug text-muted">
        Global P2P standard questions apply everywhere and are read-only here. Soft point questions are per cell and per
        KPI group (same groups as P2P standard), with the same answer types (yes/no or number with target).
      </p>

      {error ? <p className={ddsErr}>{error}</p> : null}

      <section className={ddsSection}>
        <h2 className={ddsH2}>Global P2P standard questions</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">Defined under P2P standard. Read-only here.</p>
        {loadingStd ? (
          <p className="mt-2 text-xs text-muted">Loading…</p>
        ) : stdQuestions.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            None yet. Add them under{' '}
            <Link to="/dds-process/admin/p2p-standard" className="font-medium text-accent underline-offset-2 hover:underline">
              P2P standard
            </Link>
            .
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {stdGrouped.map(([gname, qs]) => (
              <div key={gname}>
                <h3 className={ddsH3}>{gname}</h3>
                <ul className="mt-1 divide-y divide-border rounded-lg border border-border bg-surface">
                  {qs.map((q) => (
                    <li key={q.id} className="px-3 py-2">
                      <p className="text-xs leading-snug text-fg">{q.prompt}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {labelForDdsP2pResponseKind(q.response_kind)}
                        {q.response_kind === 'number_with_target' && q.target_number != null
                          ? ` · target ${q.target_number}`
                          : null}
                        {q.linked_kpi_id ? (
                          <span className="text-fg/80">
                            {' '}
                            · KPI link: {kpiLabels[q.linked_kpi_id] ?? q.linked_kpi_id}
                          </span>
                        ) : null}
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
        <p className={ddsHint}>
          Choose a site, plant, and cell in the scope bar to add or edit soft point questions for that cell only.
        </p>
      ) : null}

      {scopeStatus === 'ready' && cellId ? (
        <section className={ddsSection}>
          <h2 className={ddsH2}>Soft point questions for this cell</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            Pick a KPI group, then manage questions for this cell only. Question text must be unique per cell and group
            (case-insensitive).
          </p>

          {loadingKpiGroups ? (
            <p className="mt-2 text-xs text-muted">Loading groups…</p>
          ) : kpiGroups.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              Create a{' '}
              <Link to="/dds-process/admin/kpi-groups" className="font-medium text-accent underline-offset-2 hover:underline">
                KPI group
              </Link>{' '}
              first.
            </p>
          ) : (
            <>
              <div className="mt-2">
                <label htmlFor="cell-soft-kpi-group" className="text-[10px] font-medium text-muted">
                  KPI group
                </label>
                <select
                  id="cell-soft-kpi-group"
                  className={ddsSelect}
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

              <div className={`${ddsInset} mt-2 space-y-2`}>
                <h3 className={ddsH3}>New question</h3>
                <div>
                  <label htmlFor="cell-soft-new-prompt" className="text-[10px] font-medium text-muted">
                    Question
                  </label>
                  <textarea
                    id="cell-soft-new-prompt"
                    className={ddsTextarea}
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="Cell-specific soft point question"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cell-soft-new-kind" className="text-[10px] font-medium text-muted">
                      Answer type
                    </label>
                    <select
                      id="cell-soft-new-kind"
                      className={ddsSelect}
                      value={newKind}
                      onChange={(e) => {
                        const kind = e.target.value as DdsP2pResponseKind
                        setNewKind(kind)
                        if (kind !== 'yes_no') setNewLinkedKpiId('')
                      }}
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
                      <label htmlFor="cell-soft-new-target" className="text-[10px] font-medium text-muted">
                        Target number
                      </label>
                      <input
                        id="cell-soft-new-target"
                        className={ddsInput}
                        value={newTargetText}
                        onChange={(e) => setNewTargetText(e.target.value)}
                        inputMode="decimal"
                        placeholder="e.g. 100"
                      />
                    </div>
                  ) : null}
                  {newKind === 'yes_no' ? (
                    <div className="sm:col-span-2">
                      <label htmlFor="cell-soft-new-kpi" className="text-[10px] font-medium text-muted">
                        Roll up to KPI when answer is Yes (optional)
                      </label>
                      <select
                        id="cell-soft-new-kpi"
                        className={ddsSelect}
                        value={newLinkedKpiId}
                        onChange={(e) => setNewLinkedKpiId(e.target.value)}
                      >
                        <option value="">None</option>
                        {kpiGroups.map((g) => (
                          <optgroup key={g.id} label={g.name}>
                            {kpiOptions
                              .filter((k) => k.kpi_group_id === g.id)
                              .map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.label}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={ddsBtn}
                  disabled={!newPrompt.trim() || !groupId}
                  onClick={() => void addQuestion()}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add question
                </button>
              </div>

              {loadingCellQs ? (
                <p className="mt-2 text-xs text-muted">Loading cell questions…</p>
              ) : cellQuestions.length === 0 ? (
                <p className="mt-2 text-xs text-muted">No soft point questions for this cell in this group yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {cellQuestions.map((row) => {
                    const d = qDrafts[row.id]
                    if (!d) return null
                    const subs = subQuestionsByParent[row.id] ?? []
                    const hasSubs = subs.length > 0
                    const subsExpanded = expandedSubs.has(row.id)
                    return (
                      <li key={row.id} className={ddsInset}>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-muted" htmlFor={`cell-soft-prompt-${row.id}`}>
                              Question
                            </label>
                            <textarea
                              id={`cell-soft-prompt-${row.id}`}
                              className={ddsTextarea}
                              rows={2}
                              value={d.prompt}
                              onChange={(e) =>
                                setQDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: { ...d, prompt: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <label className="text-[10px] font-medium text-muted" htmlFor={`cell-soft-kind-${row.id}`}>
                                Answer type
                              </label>
                              <select
                                id={`cell-soft-kind-${row.id}`}
                                className={ddsSelect}
                                value={d.response_kind}
                                onChange={(e) => {
                                  const kind = e.target.value as DdsP2pResponseKind
                                  setQDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: {
                                      ...d,
                                      response_kind: kind,
                                      targetText: kind === 'number_with_target' ? d.targetText : '',
                                      linkedKpiId: kind === 'yes_no' ? d.linkedKpiId : '',
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
                                <label className="text-[10px] font-medium text-muted" htmlFor={`cell-soft-target-${row.id}`}>
                                  Target number
                                </label>
                                <input
                                  id={`cell-soft-target-${row.id}`}
                                  className={ddsInput}
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
                            {d.response_kind === 'yes_no' && !hasSubs ? (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <label className="text-[10px] font-medium text-muted" htmlFor={`cell-soft-kpi-${row.id}`}>
                                  Roll up to KPI when answer is Yes (optional)
                                </label>
                                <select
                                  id={`cell-soft-kpi-${row.id}`}
                                  className={ddsSelect}
                                  value={d.linkedKpiId}
                                  onChange={(e) =>
                                    setQDrafts((prev) => ({
                                      ...prev,
                                      [row.id]: { ...d, linkedKpiId: e.target.value },
                                    }))
                                  }
                                >
                                  <option value="">None</option>
                                  {kpiGroups.map((g) => (
                                    <optgroup key={g.id} label={g.name}>
                                      {kpiOptions
                                        .filter((k) => k.kpi_group_id === g.id)
                                        .map((k) => (
                                          <option key={k.id} value={k.id}>
                                            {k.label}
                                          </option>
                                        ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                            {d.response_kind === 'yes_no' && hasSubs ? (
                              <p className="sm:col-span-2 text-[10px] text-muted">
                                KPI rollup is disabled while sub-questions are configured.
                              </p>
                            ) : null}
                            <div className="flex items-end gap-1.5 sm:col-span-2 lg:col-span-1 lg:justify-end">
                              <button
                                type="button"
                                className={ddsBtnGhostGrow}
                                disabled={savingId === row.id}
                                onClick={() => void saveQuestion(row.id)}
                              >
                                {savingId === row.id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className={ddsBtnDanger}
                                title="Delete question"
                                onClick={() => void removeQuestion(row)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          </div>
                          <div className="rounded-md border border-border/60 bg-surface/50 p-2">
                            <button
                              type="button"
                              className="flex w-full items-center gap-1 text-left text-[10px] font-semibold text-muted hover:text-fg"
                              onClick={() =>
                                setExpandedSubs((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(row.id)) next.delete(row.id)
                                  else next.add(row.id)
                                  return next
                                })
                              }
                            >
                              {subsExpanded ? (
                                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                              ) : (
                                <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                              )}
                              Sub-questions ({subs.length})
                            </button>
                            {subsExpanded ? (
                              <div className="mt-2 space-y-2">
                                {subs.length === 0 ? (
                                  <p className="text-[10px] text-muted">No sub-questions yet.</p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {subs.map((sq) => (
                                      <li key={sq.id} className="flex flex-wrap items-end gap-1.5">
                                        <div className="min-w-0 flex-1">
                                          <label className="text-[10px] font-medium text-muted" htmlFor={`sub-prompt-${sq.id}`}>
                                            Sub-question
                                          </label>
                                          <input
                                            id={`sub-prompt-${sq.id}`}
                                            className={ddsInput}
                                            value={subDrafts[sq.id] ?? ''}
                                            onChange={(e) =>
                                              setSubDrafts((prev) => ({ ...prev, [sq.id]: e.target.value }))
                                            }
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          className={ddsBtnGhostGrow}
                                          disabled={savingSubId === sq.id}
                                          onClick={() => void saveSubQuestion(sq.id, row.id)}
                                        >
                                          {savingSubId === sq.id ? 'Saving…' : 'Save'}
                                        </button>
                                        <button
                                          type="button"
                                          className={ddsBtnDanger}
                                          title="Delete sub-question"
                                          onClick={() => void removeSubQuestion(sq.id)}
                                        >
                                          <Trash2 className="size-3.5" aria-hidden />
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <div className="flex flex-wrap items-end gap-1.5 border-t border-border/50 pt-2">
                                  <div className="min-w-0 flex-1">
                                    <label className="text-[10px] font-medium text-muted" htmlFor={`new-sub-${row.id}`}>
                                      New sub-question
                                    </label>
                                    <input
                                      id={`new-sub-${row.id}`}
                                      className={ddsInput}
                                      value={newSubPromptByParent[row.id] ?? ''}
                                      onChange={(e) =>
                                        setNewSubPromptByParent((prev) => ({ ...prev, [row.id]: e.target.value }))
                                      }
                                      placeholder="Checklist item"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className={ddsBtn}
                                    disabled={!(newSubPromptByParent[row.id] ?? '').trim()}
                                    onClick={() => void addSubQuestion(row.id)}
                                  >
                                    <Plus className="size-3.5" aria-hidden />
                                    Add
                                  </button>
                                </div>
                              </div>
                            ) : null}
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
