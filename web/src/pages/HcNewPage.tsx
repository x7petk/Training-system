import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import type { HcTemplateRow, HcTypeRow } from '../features/health-checks/types'
import {
  findSubmittedHcDuplicateSameDay,
  HC_DUPLICATE_SUBMIT_MESSAGE,
} from '../features/health-checks/hcSubmitDuplicate'
import {
  isMissingHcLdrAssignmentColumnError,
  setPendingHcLdrAssignment,
} from '../features/health-checks/hcRosterAssignmentLink'

export function HcNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    status: ldrStatus,
    sites,
    allPlants,
    allCells,
    hcObsSiteId,
    hcObsPlantId,
    hcObsCellId,
    setHcObsSiteId,
    setHcObsPlantId,
    setHcObsCellId,
    hcObsWorkspaceId,
    masterCellJoinById,
    resolveMasterCellScope,
  } = useLdrWorkspace()

  const qActivityId = searchParams.get('activityId') ?? ''
  const qMasterCellId = searchParams.get('masterCellId') ?? ''
  const qCompletionDate = searchParams.get('completionDate') ?? ''
  const qAssignmentId = searchParams.get('assignmentId') ?? ''
  const rosterAssignmentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    qAssignmentId,
  )
    ? qAssignmentId
    : null

  const [types, setTypes] = useState<HcTypeRow[]>([])
  const [hcTypeId, setHcTypeId] = useState('')
  const [template, setTemplate] = useState<HcTemplateRow | null>(null)
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

  const plantsForSite = useMemo(
    () => [...allPlants].filter((p) => p.site_id === hcObsSiteId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [allPlants, hcObsSiteId],
  )
  const cellsForPlant = useMemo(
    () => [...allCells].filter((c) => c.plant_id === hcObsPlantId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [allCells, hcObsPlantId],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!hcObsWorkspaceId) {
        setLoadingTypes(false)
        setTypes([])
        return
      }
      setLoadingTypes(true)
      setError(null)

      const selectHcTypes = () =>
        supabase
          .from('hc_types')
          .select('id, name, description, active, sort_order, ldr_activity_id, ldr_activities!inner(workspace_id)')
          .eq('active', true)
          .order('sort_order')
          .order('name')

      let list: HcTypeRow[] = []

      if (hcObsCellId && hcObsSiteId) {
        const { data: siteWsRaw, error: siteWsErr } = await supabase.rpc('ldr_ensure_workspace_site', {
          p_master_site_id: hcObsSiteId,
        })
        if (cancelled) return
        if (siteWsErr) {
          setLoadingTypes(false)
          setError(siteWsErr.message)
          setTypes([])
          return
        }
        const siteWorkspaceId = typeof siteWsRaw === 'string' ? siteWsRaw : null
        const workspaceIds =
          siteWorkspaceId && siteWorkspaceId !== hcObsWorkspaceId
            ? [hcObsWorkspaceId, siteWorkspaceId]
            : [hcObsWorkspaceId]

        const results = await Promise.all(
          workspaceIds.map((wid) => selectHcTypes().eq('ldr_activities.workspace_id', wid)),
        )
        if (cancelled) return
        const err = results.find((r) => r.error)?.error
        if (err) {
          setLoadingTypes(false)
          setError(err.message)
          setTypes([])
          return
        }
        const byId = new Map<string, HcTypeRow>()
        for (const r of results) {
          for (const row of (r.data ?? []) as HcTypeRow[]) {
            byId.set(row.id, row)
          }
        }
        list = [...byId.values()].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      } else {
        const res = await selectHcTypes().eq('ldr_activities.workspace_id', hcObsWorkspaceId)
        if (cancelled) return
        if (res.error) {
          setLoadingTypes(false)
          setError(res.error.message)
          setTypes([])
          return
        }
        list = (res.data ?? []) as HcTypeRow[]
      }

      /** Roster link: activity may live in site workspace while HC page uses cell workspace — merge type by activity id. */
      if (qActivityId) {
        const extraRes = await supabase
          .from('hc_types')
          .select('id, name, description, active, sort_order, ldr_activity_id')
          .eq('ldr_activity_id', qActivityId)
          .eq('active', true)
          .maybeSingle()
        if (cancelled) return
        if (extraRes.data) {
          const row = extraRes.data as HcTypeRow
          if (!list.some((t) => t.id === row.id)) {
            list = [...list, row].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          }
          setHcTypeId(row.id)
        }
      }
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
  }, [hcObsWorkspaceId, qActivityId, hcObsCellId, hcObsSiteId])

  const lastRosterPrefillSig = useRef('')
  const rosterPrefillSig =
    qActivityId || qMasterCellId || qCompletionDate || rosterAssignmentId
      ? `${qActivityId}|${qMasterCellId}|${qCompletionDate}|${rosterAssignmentId ?? ''}`
      : ''

  /** Prefill from roster deep link: ?activityId=&masterCellId=&completionDate= */
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
            setHcObsSiteId(scope.siteId)
            setHcObsPlantId(scope.plantId)
            setHcObsCellId(scope.cellId)
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
              setHcObsSiteId(scope.siteId)
              setHcObsPlantId(scope.plantId)
              setHcObsCellId(scope.cellId)
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
    setHcObsSiteId,
    setHcObsPlantId,
    setHcObsCellId,
  ])

  /** Autofill plant/cell for new HC (cell required); not when roster deep link handles scope. */
  useEffect(() => {
    if (ldrStatus !== 'ready') return
    if (rosterPrefillSig) return
    if (!hcObsSiteId || hcObsCellId) return
    if (hcObsPlantId) {
      const c = cellsForPlant[0]
      if (c) setHcObsCellId(c.id)
      return
    }
    const firstPlant = plantsForSite[0]
    if (!firstPlant) return
    const firstCell = allCells.find((c) => c.plant_id === firstPlant.id)
    if (!firstCell) return
    setHcObsPlantId(firstPlant.id)
    setHcObsCellId(firstCell.id)
  }, [
    ldrStatus,
    rosterPrefillSig,
    hcObsSiteId,
    hcObsPlantId,
    hcObsCellId,
    plantsForSite,
    cellsForPlant,
    allCells,
    setHcObsPlantId,
    setHcObsCellId,
  ])

  const loadActiveTemplate = useCallback(async (typeId: string) => {
    if (!typeId) {
      setTemplate(null)
      return
    }
    setLoadingTemplate(true)
    setError(null)
    const res = await supabase
      .from('hc_templates')
      .select('id, hc_type_id, name, version, description, active, threshold_score')
      .eq('hc_type_id', typeId)
      .eq('active', true)
      .maybeSingle()
    setLoadingTemplate(false)
    if (res.error) {
      setError(res.error.message)
      setTemplate(null)
      return
    }
    setTemplate((res.data as HcTemplateRow) ?? null)
    if (!res.data) {
      setError('No active template for this type. Ask an admin to activate one in LDR Admin → HC Templates.')
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void loadActiveTemplate(hcTypeId)
    })
  }, [hcTypeId, loadActiveTemplate])

  const displayName =
    (user?.user_metadata?.display_name as string | undefined)?.trim() ||
    user?.email?.split('@')[0] ||
    'User'

  async function handleStart() {
    setError(null)
    if (!hcObsSiteId || !hcObsPlantId || !hcObsCellId) {
      setError('Select site, plant, and cell (use the location bar or pickers below).')
      return
    }
    if (!hcTypeId || !template) {
      setError('Select a health check type with an active template.')
      return
    }
    if (!user?.id) {
      setError('You must be signed in.')
      return
    }

    setStarting(true)
    const dup = await findSubmittedHcDuplicateSameDay(supabase, {
      completedByUserId: user.id,
      hcTypeId,
      masterCellId: hcObsCellId,
      ldrAssignmentId: rosterAssignmentId,
    })
    if (dup.error) {
      setStarting(false)
      setError(dup.error)
      return
    }
    if (dup.duplicateId) {
      setStarting(false)
      setError(HC_DUPLICATE_SUBMIT_MESSAGE)
      return
    }

    const qRes = await supabase
      .from('hc_template_questions')
      .select('id, sort_order')
      .eq('template_id', template.id)
      .eq('active', true)
      .order('sort_order')
      .order('question_text')

    if (qRes.error || !qRes.data?.length) {
      setStarting(false)
      setError(qRes.error?.message ?? 'This template has no active questions.')
      return
    }

    const baseRecord = {
      hc_type_id: hcTypeId,
      template_id: template.id,
      master_site_id: hcObsSiteId,
      master_plant_id: hcObsPlantId,
      master_cell_id: hcObsCellId,
      completed_by_user_id: user.id,
      completed_by_name: displayName,
      operator_name: null,
    }

    const insertPayload = rosterAssignmentId
      ? { ...baseRecord, ldr_assignment_id: rosterAssignmentId }
      : baseRecord
    let recordRes = await supabase
      .from('hc_records')
      .insert(insertPayload as never)
      .select('id')
      .single()

    if (
      recordRes.error &&
      rosterAssignmentId &&
      isMissingHcLdrAssignmentColumnError(recordRes.error.message)
    ) {
      recordRes = await supabase.from('hc_records').insert(baseRecord).select('id').single()
      if (!recordRes.error && recordRes.data?.id) {
        setPendingHcLdrAssignment(recordRes.data.id, rosterAssignmentId)
      }
    }

    if (recordRes.error || !recordRes.data) {
      setStarting(false)
      setError(recordRes.error?.message ?? 'Could not create record.')
      return
    }

    const recordId = recordRes.data.id
    const answerRows = qRes.data.map((row) => ({
      hc_record_id: recordId,
      template_question_id: row.id,
      sort_order: row.sort_order,
    }))

    const ansRes = await supabase.from('hc_answers').insert(answerRows)
    if (ansRes.error) {
      await supabase.from('hc_records').delete().eq('id', recordId)
      setStarting(false)
      setError(ansRes.error.message)
      return
    }

    setStarting(false)
    const q = new URLSearchParams()
    if (completionDate) q.set('completionDate', completionDate)
    navigate(`/ldr-tools/health-checks/${recordId}${q.toString() ? `?${q.toString()}` : ''}`)
  }

  const selectClass =
    'h-10 w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3 text-sm text-fg shadow-sm'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/ldr-tools/health-checks"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-raised"
          aria-label="Back to list"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
          <ClipboardList className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">New health check</h1>
          <p className="text-sm text-muted">Choose location, type, then start answering on the next screen.</p>
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
            <select className={`mt-1 ${selectClass}`} value={hcObsSiteId} onChange={(e) => setHcObsSiteId(e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted">
            Plant
            <select className={`mt-1 ${selectClass}`} value={hcObsPlantId} onChange={(e) => setHcObsPlantId(e.target.value)}>
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
            <select className={`mt-1 ${selectClass}`} value={hcObsCellId} onChange={(e) => setHcObsCellId(e.target.value)}>
              <option value="">—</option>
              {cellsForPlant.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h2 className="pt-2 text-sm font-semibold text-fg">Check</h2>
        <label className="block text-xs font-medium text-muted">
          HC type (from LDR activities)
          <select
            className={`mt-1 ${selectClass}`}
            value={hcTypeId}
            onChange={(e) => setHcTypeId(e.target.value)}
            disabled={loadingTypes || !hcObsWorkspaceId}
          >
            <option value="">— Select —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {hcObsCellId && hcObsWorkspaceId ? (
          <p className="text-xs text-muted">
            Types include activities linked to the site workspace and this cell’s workspace when both apply.
          </p>
        ) : null}
        {!hcObsWorkspaceId ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Pick a location in the bar above until the workspace loads — HC types are tied to activities in that
            workspace.
          </p>
        ) : null}
        {loadingTemplate ? (
          <p className="text-sm text-muted">Loading template…</p>
        ) : template ? (
          <p className="text-sm text-fg/80">
            Active template: <strong className="font-medium text-fg">{template.name}</strong> (v{template.version})
          </p>
        ) : hcTypeId ? null : (
          <p className="text-sm text-muted">Select a type to load its active template.</p>
        )}

        <label className="block text-xs font-medium text-muted">
          Completion date
          <input
            type="date"
            className={`mt-1 ${selectClass}`}
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={starting || loadingTemplate || !template}
          className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-600"
        >
          {starting ? 'Starting…' : 'Start check'}
        </button>
        <Link
          to="/ldr-tools/health-checks"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-fg hover:bg-surface-raised"
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}
