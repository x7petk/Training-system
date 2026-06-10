import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { EPlanBoard } from '../features/eplan/EPlanBoard'
import { EPlanActionModal } from '../features/eplan/EPlanActionModal'
import { EPlanFilters } from '../features/eplan/EPlanFilters'
import { EPlanStatusSummary } from '../features/eplan/EPlanStatusSummary'
import { loadEPlanAdmin } from '../features/eplan/eplanAdminService'
import {
  deleteEPlanAction,
  loadEPlanActions,
  loadEPlanFilters,
  saveEPlanActions,
  saveEPlanFilters,
  updateEPlanAction,
} from '../features/eplan/eplanService'
import { createEPlanSampleActions, ensureEPlanSeeded } from '../features/eplan/eplanSeed'
import { eplanLoadJson, eplanSaveJson, eplanStorageKeys } from '../features/eplan/eplanStorage'
import type { EPlanAction, EPlanAdminStore, EPlanPageFilters, EPlanTimelineMode } from '../features/eplan/eplanTypes'
import { eplanBuildDisplayRows, eplanDefaultDateRange, eplanMatchesFilters, eplanStatusCounts } from '../features/eplan/eplanUtils'
import { localYMD } from '../lib/dueDateUtils'

function visibleSampleFilters(): EPlanPageFilters {
  const range = eplanDefaultDateRange()
  return {
    status: 'all',
    ogsmPillarId: 'all',
    forumId: 'all',
    actionOwnerId: 'all',
    labelId: 'all',
    lossTypeId: 'all',
    raisedById: 'all',
    dateFrom: range.from,
    dateTo: range.to,
    showNotRequired: false,
  }
}

export function EPlanPage() {
  const { status: scopeStatus, cellId, siteId, plantId, siteCells, plants, error: scopeError } = usePlan24Workspace()
  const [admin, setAdmin] = useState<EPlanAdminStore>(() => loadEPlanAdmin())
  const [actions, setActions] = useState<EPlanAction[]>(() => loadEPlanActions())
  const [filters, setFilters] = useState<EPlanPageFilters>(() => loadEPlanFilters())
  const [timelineMode, setTimelineMode] = useState<EPlanTimelineMode>('weeks')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [ready, setReady] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editAction, setEditAction] = useState<EPlanAction | null>(null)
  const [createParentId, setCreateParentId] = useState<string | undefined>()
  const [sampleMsg, setSampleMsg] = useState<string | null>(null)

  useEffect(() => {
    if (scopeStatus !== 'ready') return
    const { admin: a, actions: seeded } = ensureEPlanSeeded(siteCells, plants)
    setAdmin(a)
    setActions(seeded)
    setReady(true)
  }, [scopeStatus, siteCells, plants])

  useEffect(() => {
    saveEPlanFilters(filters)
  }, [filters])

  const persist = useCallback((next: EPlanAction[]) => {
    setActions(next)
    saveEPlanActions(next)
  }, [])

  const todayYmd = localYMD(new Date())
  const cellActions = useMemo(() => actions.filter((a) => a.cellId === cellId), [actions, cellId])

  const matched = useMemo(
    () => cellActions.filter((a) => eplanMatchesFilters(a, filters, todayYmd)),
    [cellActions, filters, todayYmd],
  )

  const displaySource = useMemo(() => {
    const rootIds = new Set<string>()
    for (const a of matched) {
      if (a.parentActionId) rootIds.add(a.parentActionId)
      else rootIds.add(a.id)
    }
    return cellActions.filter((a) => {
      if (!a.parentActionId) return rootIds.has(a.id)
      return rootIds.has(a.parentActionId)
    })
  }, [cellActions, matched])

  const rows = useMemo(() => eplanBuildDisplayRows(displaySource, expandedIds), [displaySource, expandedIds])

  const summaryCounts = useMemo(() => {
    const base = matched.filter((a) => filters.showNotRequired || a.status !== 'NOT_REQUIRED')
    return eplanStatusCounts(base)
  }, [matched, filters.showNotRequired])

  const defaultRaisedById = admin.owners.find((o) => o.isActive)?.id ?? ''

  useEffect(() => {
    if (!ready || !siteId || !plantId || !cellId) return
    const completedCells = eplanLoadJson<string[]>(eplanStorageKeys.samplePackCells, [])
    if (completedCells.includes(cellId)) return

    const samples = createEPlanSampleActions({
      admin,
      existingActions: actions,
      siteId,
      plantId,
      cellId,
    })
    eplanSaveJson(eplanStorageKeys.samplePackCells, [...completedCells, cellId])
    if (samples.length === 0) return

    const next = [...actions, ...samples]
    persist(next)
    setFilters(visibleSampleFilters())
    setTimelineMode('weeks')
    setExpandedIds((prev) => {
      const nextExpanded = new Set(prev)
      samples.filter((a) => !a.parentActionId).forEach((a) => nextExpanded.add(a.id))
      return nextExpanded
    })
    setSampleMsg(`Added ${samples.filter((a) => !a.parentActionId).length} new sample actions.`)
  }, [actions, admin, cellId, persist, plantId, ready, siteId])

  const openCreate = useCallback((parentId?: string) => {
    setSampleMsg(null)
    setModalMode('create')
    setEditAction(null)
    setCreateParentId(parentId)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((action: EPlanAction) => {
    setSampleMsg(null)
    setModalMode('edit')
    setEditAction(action)
    setCreateParentId(undefined)
    setModalOpen(true)
  }, [])

  const handleDatesChange = useCallback(
    (actionId: string, startDate: string, endDate: string) => {
      const target = actions.find((a) => a.id === actionId)
      if (!target) return
      persist(updateEPlanAction(actions, { ...target, startDate, endDate }))
    },
    [actions, persist],
  )

  const addSampleActions = useCallback(() => {
    if (!siteId || !plantId || !cellId) return
    const samples = createEPlanSampleActions({
      admin,
      existingActions: actions,
      siteId,
      plantId,
      cellId,
    })
    if (samples.length === 0) {
      setSampleMsg('All sample actions are already loaded for this cell.')
      return
    }
    persist([...actions, ...samples])
    setFilters(visibleSampleFilters())
    setTimelineMode('weeks')
    setExpandedIds((prev) => {
      const next = new Set(prev)
      samples.filter((a) => !a.parentActionId).forEach((a) => next.add(a.id))
      return next
    })
    setSampleMsg(`Added ${samples.filter((a) => !a.parentActionId).length} actions with sub-actions.`)
  }, [actions, admin, cellId, persist, plantId, siteId])

  const handleSave = useCallback(
    (action: EPlanAction, opts?: { thenSubFor?: EPlanAction }) => {
      const exists = actions.some((a) => a.id === action.id)
      const next = exists ? updateEPlanAction(actions, action) : [...actions, action]
      persist(next)
      if (opts?.thenSubFor) {
        setExpandedIds((p) => new Set(p).add(opts.thenSubFor!.id))
        setModalMode('create')
        setEditAction(null)
        setCreateParentId(opts.thenSubFor.id)
        setModalOpen(true)
        return
      }
      setModalOpen(false)
      setCreateParentId(undefined)
    },
    [actions, persist],
  )

  if (scopeStatus === 'loading' || !ready) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading e-Plan…
      </p>
    )
  }

  if (scopeError) {
    return <p className="text-sm text-destructive">{scopeError}</p>
  }

  if (!cellId) {
    return <p className="text-sm text-muted">Select site, plant, and cell in the scope bar to view e-Plan actions.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">e-Plan</h1>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {sampleMsg ? <span className="text-[11px] text-muted">{sampleMsg}</span> : null}
          <button
            type="button"
            onClick={addSampleActions}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-sm hover:bg-surface-raised/80 hover:text-fg"
          >
            <Plus className="size-3.5" aria-hidden />
            Add samples
          </button>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-sm hover:bg-surface-raised/80"
          >
            <Plus className="size-3.5" aria-hidden />
            New action
          </button>
        </div>
      </header>

      <div className="space-y-1.5">
        <EPlanStatusSummary
          counts={summaryCounts}
          activeStatus={filters.status}
          onSelect={(status) => setFilters((f) => ({ ...f, status }))}
          hideNotRequired={!filters.showNotRequired}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <EPlanFilters filters={filters} admin={admin} onChange={setFilters} />
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-px" role="group" aria-label="Timeline view">
            {(['weeks', 'months', 'next12'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={[
                  'rounded-md px-2 py-1 text-[10px] font-semibold',
                  timelineMode === m ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06]',
                ].join(' ')}
                onClick={() => setTimelineMode(m)}
              >
                {m === 'weeks' ? 'Weeks' : m === 'months' ? 'Months' : '12 mo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <EPlanBoard
        rows={rows}
        allCellActions={cellActions}
        admin={admin}
        timelineMode={timelineMode}
        onToggleExpand={(id) =>
          setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }
        onOpen={openEdit}
        onDatesChange={handleDatesChange}
      />

      <EPlanActionModal
        open={modalOpen}
        mode={modalMode}
        action={editAction}
        admin={admin}
        siteId={siteId}
        plantId={plantId}
        cellId={cellId}
        defaultRaisedById={defaultRaisedById}
        parentActionId={createParentId}
        onClose={() => {
          setModalOpen(false)
          setCreateParentId(undefined)
        }}
        onSave={(a) => handleSave(a)}
        onSaveAndSub={(parent) => handleSave(parent, { thenSubFor: parent })}
        onMarkNotRequired={(a) => {
          persist(updateEPlanAction(actions, a))
          setModalOpen(false)
        }}
        onDelete={(id) => {
          persist(deleteEPlanAction(actions, id))
          setModalOpen(false)
        }}
      />
    </div>
  )
}
