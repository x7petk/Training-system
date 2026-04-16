import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import { findSubmittedObsDuplicateSameDay, obsDuplicateSubmitMessage } from '../features/observations/obsSubmitDuplicate'
import { isMissingObsLdrAssignmentColumnError, setPendingObsLdrAssignment } from '../features/observations/obsRosterAssignmentLink'
import type { ObsKind } from '../features/observations/obsKind'
import { obsBasePath, obsLabel, obsTitle } from '../features/observations/obsKind'

type TypeRow = {
  id: string
  name: string
  description: string | null
  active: boolean
  sort_order: number
  workspace_id: string
}

type TemplateRow = { id: string; version: number; name: string; active: boolean }

export function ObsNewPage({ kind }: { kind: ObsKind }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    status: ldrStatus,
    sites,
    plants,
    cells,
    siteId,
    plantId,
    cellId,
    setSiteId,
    setPlantId,
    setCellId,
    setScopeLevel,
    workspaceId,
    masterCellJoinById,
    resolveMasterCellScope,
  } = useLdrWorkspace()

  const qActivityId = searchParams.get('activityId') ?? ''
  const qMasterCellId = searchParams.get('masterCellId') ?? ''
  const qCompletionDate = searchParams.get('completionDate') ?? ''
  const qAssignmentId = searchParams.get('assignmentId') ?? ''
  const rosterAssignmentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(qAssignmentId)
    ? qAssignmentId
    : null

  const [types, setTypes] = useState<TypeRow[]>([])
  const [linkedActivityId, setLinkedActivityId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [template, setTemplate] = useState<TemplateRow | null>(null)
  const [completionDate, setCompletionDate] = useState(() => {
    const m = qCompletionDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) return qCompletionDate
    const now = new Date()
    const y = now.getUTCFullYear()
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  })
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const plantsForSite = useMemo(() => plants.filter((p) => p.site_id === siteId), [plants, siteId])
  const cellsForPlant = useMemo(() => cells.filter((c) => c.plant_id === plantId), [cells, plantId])
  const typesTable = kind === 'sos' ? 'sos_types' : kind === 'qos' ? 'qos_types' : 'ppo_types'
  const tplTable = kind === 'sos' ? 'sos_templates' : kind === 'qos' ? 'qos_templates' : 'ppo_templates'
  const tplFk = kind === 'sos' ? 'sos_type_id' : kind === 'qos' ? 'qos_type_id' : 'ppo_type_id'
  const qTable =
    kind === 'sos' ? 'sos_template_questions' : kind === 'qos' ? 'qos_template_questions' : 'ppo_template_questions'
  const recTable = kind === 'sos' ? 'sos_records' : kind === 'qos' ? 'qos_records' : 'ppo_records'
  const recTypeFk = kind === 'sos' ? 'sos_type_id' : kind === 'qos' ? 'qos_type_id' : 'ppo_type_id'
  const ansTable = kind === 'qos' ? 'qos_answers' : kind === 'ppo' ? 'ppo_answers' : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!workspaceId) {
        setLoadingTypes(false)
        setTypes([])
        return
      }
      setLoadingTypes(true)
      const [typesRes, linkRes] = await Promise.all([
        supabase
          .from(typesTable)
          .select('id, workspace_id, name, description, active, sort_order')
          .eq('active', true)
          .eq('workspace_id', workspaceId)
          .order('sort_order')
          .order('name'),
        supabase
          .from('obs_system_activity_links')
          .select('ldr_activity_id')
          .eq('workspace_id', workspaceId)
          .eq('kind', kind)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (typesRes.error) {
        setLoadingTypes(false)
        setError(typesRes.error.message)
        setTypes([])
        return
      }
      if (linkRes.error) {
        setLoadingTypes(false)
        setError(linkRes.error.message)
        setTypes([])
        return
      }
      const list = (typesRes.data ?? []) as TypeRow[]
      const linked = ((linkRes.data as { ldr_activity_id?: string } | null)?.ldr_activity_id ?? '') as string
      setLinkedActivityId(linked)
      setTypeId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev
        if (list.length === 1) return list[0].id
        return ''
      })
      if (cancelled) return
      setLoadingTypes(false)
      setTypes(list)
    }
    queueMicrotask(() => {
      if (!cancelled) void load()
    })
    return () => {
      cancelled = true
    }
  }, [workspaceId, kind, typesTable])

  const lastRosterPrefillSig = useRef('')
  const rosterPrefillSig =
    qActivityId || qMasterCellId || qCompletionDate || rosterAssignmentId
      ? `${qActivityId}|${qMasterCellId}|${qCompletionDate}|${rosterAssignmentId ?? ''}`
      : ''

  useEffect(() => {
    if (ldrStatus !== 'ready' || !rosterPrefillSig) return
    if (lastRosterPrefillSig.current === rosterPrefillSig) return
    let cancelled = false
    queueMicrotask(() => {
      void (async () => {
        if (cancelled) return
        if (qMasterCellId) {
          const scope = resolveMasterCellScope(qMasterCellId)
          if (scope) {
            setScopeLevel('cell')
            setSiteId(scope.siteId)
            setPlantId(scope.plantId)
            setCellId(scope.cellId)
          }
        } else if (rosterAssignmentId) {
          const asg = await supabase
            .from('ldr_assignments')
            .select('master_cell_id, ldr_location_id')
            .eq('id', rosterAssignmentId)
            .maybeSingle()
          if (cancelled) return
          const asgData = (asg.data as { master_cell_id?: string | null; ldr_location_id?: string | null } | null) ?? null
          let masterCellId = asgData?.master_cell_id ?? null
          if (!masterCellId && asgData?.ldr_location_id) {
            const loc = await supabase
              .from('ldr_locations')
              .select('name')
              .eq('id', asgData.ldr_location_id)
              .maybeSingle()
            if (cancelled) return
            const locName = ((loc.data as { name?: string } | null)?.name ?? '').trim().toLowerCase()
            if (locName) {
              const match = Array.from(masterCellJoinById.entries()).find(([, c]) => {
                const cell = (c.name ?? '').trim().toLowerCase()
                const plantName = Array.isArray(c.master_plants) ? c.master_plants[0]?.name : c.master_plants?.name
                const plant = (plantName ?? '').trim().toLowerCase()
                return locName === cell || locName === `${plant} · ${cell}`
              })
              masterCellId = match?.[0] ?? null
            }
          }
          if (masterCellId) {
            const scope = resolveMasterCellScope(masterCellId)
            if (scope) {
              setScopeLevel('cell')
              setSiteId(scope.siteId)
              setPlantId(scope.plantId)
              setCellId(scope.cellId)
            }
          }
        }
        if (cancelled) return
        if (qCompletionDate && /^\d{4}-\d{2}-\d{2}$/.test(qCompletionDate)) setCompletionDate(qCompletionDate)
        if (!cancelled) lastRosterPrefillSig.current = rosterPrefillSig
      })()
    })
    return () => {
      cancelled = true
    }
  }, [
    ldrStatus,
    rosterPrefillSig,
    qActivityId,
    qMasterCellId,
    qCompletionDate,
    rosterAssignmentId,
    masterCellJoinById,
    resolveMasterCellScope,
    setScopeLevel,
    setSiteId,
    setPlantId,
    setCellId,
  ])

  const loadActiveTemplate = useCallback(
    async (tid: string) => {
      if (!tid) {
        setTemplate(null)
        return
      }
      setLoadingTemplate(true)
      setError(null)
      const res = await supabase
        .from(tplTable)
        .select('id, name, version, active')
        .eq(tplFk, tid)
        .eq('active', true)
        .maybeSingle()
      setLoadingTemplate(false)
      if (res.error) {
        setError(res.error.message)
        setTemplate(null)
        return
      }
      setTemplate((res.data as TemplateRow) ?? null)
      if (!res.data) {
        const n = obsLabel(kind)
        setError(`No active template for this type. Ask an admin to activate one in LDR Admin → ${n} Templates.`)
      }
    },
    [tplTable, tplFk, kind],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void loadActiveTemplate(typeId)
    })
  }, [typeId, loadActiveTemplate])

  const displayName =
    (user?.user_metadata?.display_name as string | undefined)?.trim() || user?.email?.split('@')[0] || 'User'

  const base = obsBasePath(kind)

  async function handleStart() {
    setError(null)
    if (!siteId || !plantId || !cellId) {
      setError('Select site, plant, and cell (use the scope bar or pickers below).')
      return
    }
    if (!typeId || !template) {
      setError('Select a type with an active template.')
      return
    }
    if (qActivityId && linkedActivityId && qActivityId !== linkedActivityId && !rosterAssignmentId) {
      setError(`This assignment is not linked to ${obsLabel(kind)}. Use “Complete ${obsLabel(kind)}” on the matching activity.`)
      return
    }
    if (!user?.id) {
      setError('You must be signed in.')
      return
    }

    setStarting(true)
    const dup = await findSubmittedObsDuplicateSameDay(supabase, kind, {
      completedByUserId: user.id,
      typeId,
      masterCellId: cellId,
      ldrAssignmentId: rosterAssignmentId,
    })
    if (dup.error) {
      setStarting(false)
      setError(dup.error)
      return
    }
    if (dup.duplicateId) {
      setStarting(false)
      setError(obsDuplicateSubmitMessage(kind))
      return
    }

    const qRes =
      kind === 'sos'
        ? { data: [] as { id: string; sort_order: number }[], error: null }
        : await supabase.from(qTable).select('id, sort_order').eq('template_id', template.id).eq('active', true).order('sort_order')

    if (kind !== 'sos' && (qRes.error || !qRes.data?.length)) {
      setStarting(false)
      setError(qRes.error?.message ?? 'This template has no active questions.')
      return
    }

    const baseRecord: Record<string, unknown> = {
      [recTypeFk]: typeId,
      template_id: template.id,
      master_site_id: siteId,
      master_plant_id: plantId,
      master_cell_id: cellId,
      completed_by_user_id: user.id,
      completed_by_name: displayName,
      operator_name: null,
    }

    let recordRes = await supabase
      .from(recTable)
      .insert(rosterAssignmentId ? { ...baseRecord, ldr_assignment_id: rosterAssignmentId } : baseRecord)
      .select('id')
      .single()

    if (recordRes.error && rosterAssignmentId && isMissingObsLdrAssignmentColumnError(recordRes.error.message)) {
      recordRes = await supabase.from(recTable).insert(baseRecord).select('id').single()
      if (!recordRes.error && recordRes.data?.id) {
        setPendingObsLdrAssignment(kind, recordRes.data.id, rosterAssignmentId)
      }
    }

    if (recordRes.error || !recordRes.data) {
      setStarting(false)
      setError(recordRes.error?.message ?? 'Could not create record.')
      return
    }

    const recordId = (recordRes.data as { id: string }).id

    if (kind !== 'sos' && ansTable && qRes.data?.length) {
      const recFk = kind === 'qos' ? 'qos_record_id' : 'ppo_record_id'
      const answerRows = qRes.data.map((row: { id: string; sort_order: number }) => ({
        [recFk]: recordId,
        template_question_id: row.id,
        sort_order: row.sort_order,
        answer: 'na',
        score_value: null,
        comment: '',
        operator_name: null,
        operator_user_id: null,
      }))
      const ansRes = await supabase.from(ansTable).insert(answerRows)
      if (ansRes.error) {
        await supabase.from(recTable).delete().eq('id', recordId)
        setStarting(false)
        setError(ansRes.error.message)
        return
      }
    }

    setStarting(false)
    const q = new URLSearchParams()
    if (completionDate) q.set('completionDate', completionDate)
    navigate(`${base}/${recordId}${q.toString() ? `?${q.toString()}` : ''}`)
  }

  const selectClass =
    'h-10 w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3 text-sm text-fg shadow-sm'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={base}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
          aria-label="Back to list"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-200">
          <ClipboardList className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">New {obsLabel(kind)}</h1>
          <p className="text-sm text-muted">{obsTitle(kind)} — choose location and type, then continue on the next screen.</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fg">Location</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-muted">
            Site
            <select className={`mt-1 ${selectClass}`} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted">
            Plant
            <select className={`mt-1 ${selectClass}`} value={plantId} onChange={(e) => setPlantId(e.target.value)}>
              <option value="">—</option>
              {plantsForSite.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted">
            Cell
            <select className={`mt-1 ${selectClass}`} value={cellId} onChange={(e) => setCellId(e.target.value)}>
              <option value="">—</option>
              {cellsForPlant.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-fg">Type</h2>
        {qActivityId && linkedActivityId && qActivityId !== linkedActivityId && !rosterAssignmentId ? (
          <p className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
            This roster assignment does not belong to the linked {obsLabel(kind)} activity.
          </p>
        ) : null}
        {loadingTypes ? (
          <p className="text-sm text-muted">Loading types…</p>
        ) : (
          <select className={selectClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">— Select type —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {loadingTemplate ? <p className="text-xs text-muted">Checking template…</p> : null}
        {template ? (
          <p className="text-xs text-muted">
            Active template: <span className="font-medium text-fg">{template.name}</span> (v{template.version})
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Link to={base} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-raised">
          Cancel
        </Link>
        <button
          type="button"
          disabled={
            starting ||
            loadingTypes ||
            Boolean(qActivityId && linkedActivityId && qActivityId !== linkedActivityId && !rosterAssignmentId)
          }
          onClick={() => void handleStart()}
          className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500"
        >
          {starting ? 'Starting…' : 'Start'}
        </button>
      </div>
    </div>
  )
}

export function SosNewPage() {
  return <ObsNewPage kind="sos" />
}
export function QosNewPage() {
  return <ObsNewPage kind="qos" />
}
export function PpoNewPage() {
  return <ObsNewPage kind="ppo" />
}
