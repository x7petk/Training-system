import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
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

export function ObsNewPage({ kind, embedded = false }: { kind: ObsKind; embedded?: boolean }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    status: ldrStatus,
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
  const [showTypeValidation, setShowTypeValidation] = useState(false)

  const plantsForSite = useMemo(
    () => [...allPlants].filter((p) => p.site_id === hcObsSiteId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [allPlants, hcObsSiteId],
  )
  const cellsForPlant = useMemo(
    () => [...allCells].filter((c) => c.plant_id === hcObsPlantId).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [allCells, hcObsPlantId],
  )
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
      if (!hcObsWorkspaceId) {
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
          .eq('workspace_id', hcObsWorkspaceId)
          .order('sort_order')
          .order('name'),
        supabase
          .from('obs_system_activity_links')
          .select('ldr_activity_id')
          .eq('workspace_id', hcObsWorkspaceId)
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
  }, [hcObsWorkspaceId, kind, typesTable])

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

  /** Autofill plant/cell for new observation (cell required). */
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
    if (!hcObsSiteId || !hcObsPlantId || !hcObsCellId) {
      setError('Select site, plant, and cell in the bar at the top of the page.')
      return
    }
    if (!typeId || !template) {
      setShowTypeValidation(true)
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
      master_site_id: hcObsSiteId,
      master_plant_id: hcObsPlantId,
      master_cell_id: hcObsCellId,
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
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-2xl space-y-6'}>
      {embedded ? null : (
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-200">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">New {obsLabel(kind)}</h1>
            <p className="text-sm text-muted">
              {obsTitle(kind)} — choose type, then continue on the next screen. Location comes from the site / plant / cell bar above.
            </p>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div
        className={`space-y-4 rounded-2xl border bg-surface p-5 shadow-sm ${
          showTypeValidation && !typeId ? 'border-danger/45' : 'border-border'
        }`}
      >
        <h2 className="text-sm font-semibold text-fg">Type</h2>
        {qActivityId && linkedActivityId && qActivityId !== linkedActivityId && !rosterAssignmentId ? (
          <p className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">
            This roster assignment does not belong to the linked {obsLabel(kind)} activity.
          </p>
        ) : null}
        {loadingTypes ? (
          <p className="text-sm text-muted">Loading types…</p>
        ) : (
          <select
            className={`${selectClass} ${showTypeValidation && !typeId ? 'border-danger/45' : ''}`}
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value)
              if (e.target.value) setShowTypeValidation(false)
            }}
          >
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
  return <ObsSystemNewPage />
}
export function QosNewPage() {
  return <ObsNewPage kind="qos" />
}
export function PpoNewPage() {
  return <ObsNewPage kind="ppo" />
}

export function ObsSystemNewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const osKindParam = searchParams.get('osKind')
  const selectedKind: ObsKind | null =
    osKindParam === 'sos' || osKindParam === 'qos' || osKindParam === 'ppo' ? osKindParam : null

  function setOsKind(k: ObsKind) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('osKind', k)
        return p
      },
      { replace: true },
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-800 dark:text-sky-200">
            <ClipboardList className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-sm font-semibold text-fg">Observation System</h2>
            <p className="text-xs text-muted">
              Select SOS, QOS, or PPOS, then choose Type below. Location comes from the site / plant / cell bar above.
            </p>
            <div
              className={`mt-3 inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border bg-surface p-1 shadow-sm ${
                selectedKind ? 'border-border' : 'border-danger/45 bg-danger/5'
              }`}
              role="radiogroup"
              aria-label="Observation system"
            >
              {(
                [
                  ['sos', 'S', 'SOS'],
                  ['qos', 'Q', 'QOS'],
                  ['ppo', 'PP', 'PPOS'],
                ] as const
              ).map(([k, shortLabel, longLabel]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOsKind(k)}
                  title={longLabel}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    selectedKind === k
                      ? 'bg-sky-600 text-white'
                      : 'border border-transparent text-muted hover:bg-surface-raised hover:text-fg'
                  }`}
                >
                  {shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
        {selectedKind ? (
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-semibold text-fg">{obsTitle(selectedKind)}</p>
            <ObsNewPage kind={selectedKind} embedded />
          </div>
        ) : null}
      </div>
    </div>
  )
}
