import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localYMD } from '../lib/dueDateUtils'
import { useAuth } from '../hooks/useAuth'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  DdsP2pSummaryBody,
  type DdsP2pSummaryBodyHandle,
  type DdsP2pSummaryRosterRole,
  type DdsP2pSummaryShiftRow,
} from '../features/dds/DdsP2pSummaryBody'
import { DdsTriggerScoreTilesRow } from '../features/dds/DdsTriggerScoreTilesRow'
import { ddsErr, ddsHint, ddsInput, ddsSection, ddsSelect } from '../features/dds/ddsAdminCompactClasses'

function sortGroups<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function DdsP2pSummaryPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { user } = useAuth()
  const bodyRef = useRef<DdsP2pSummaryBodyHandle>(null)

  const [planDate, setPlanDate] = useState(() => localYMD(new Date()))
  const [shiftKind, setShiftKind] = useState('')

  const [shifts, setShifts] = useState<DdsP2pSummaryShiftRow[]>([])
  const [roles, setRoles] = useState<DdsP2pSummaryRosterRole[]>([])
  const [shellLoading, setShellLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRosterShell = useCallback(async () => {
    if (scopeStatus !== 'ready' || !cellId) {
      setShifts([])
      setRoles([])
      setShiftKind('')
      setShellLoading(false)
      return
    }
    setShellLoading(true)
    setError(null)
    const rosterRes = await supabase
      .from('plan24_rosters')
      .select('id')
      .eq('master_cell_id', cellId)
      .eq('is_active', true)
      .maybeSingle()
    if (rosterRes.error) {
      setError(rosterRes.error.message)
      setShifts([])
      setRoles([])
      setShellLoading(false)
      return
    }
    const rid = (rosterRes.data as { id: string } | null)?.id ?? null
    if (!rid) {
      setShifts([])
      setRoles([])
      setShiftKind('')
      setShellLoading(false)
      return
    }
    const [shRes, roRes] = await Promise.all([
      supabase.from('plan24_roster_shifts').select('kind, display_name, sort_order').eq('roster_id', rid).order('sort_order'),
      supabase.from('plan24_roster_roles').select('id, name, sort_order, is_active').eq('roster_id', rid).order('sort_order').order('name'),
    ])
    if (shRes.error || roRes.error) {
      setError(shRes.error?.message ?? roRes.error?.message ?? 'Load failed')
      setShellLoading(false)
      return
    }
    const shList = (shRes.data ?? []) as DdsP2pSummaryShiftRow[]
    setShifts(shList)
    setShiftKind((prev) => {
      if (prev && shList.some((s) => s.kind === prev)) return prev
      return shList[0]?.kind ?? ''
    })
    setRoles(sortGroups((roRes.data ?? []) as DdsP2pSummaryRosterRole[]))
    setShellLoading(false)
  }, [cellId, scopeStatus])

  useEffect(() => {
    void loadRosterShell()
  }, [loadRosterShell])

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }
  if (scopeStatus === 'error') {
    return <p className={ddsErr}>{scopeError ?? 'Could not load scope.'}</p>
  }
  if (!cellId) {
    return <p className={ddsHint}>Select a cell in the scope bar to use P2P Summary.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <section className={`${ddsSection} flex min-h-0 flex-1 flex-col overflow-hidden !p-2 sm:!p-2.5`}>
        <div className="flex shrink-0 flex-wrap items-end gap-1.5 border-b border-border/60 pb-1">
          <DdsTriggerScoreTilesRow
            cellId={cellId}
            planDate={planDate}
            shiftKind={shiftKind}
            shifts={shifts}
            compact
          />
          <div>
            <label className="text-[10px] font-medium text-muted">Date</label>
            <input type="date" className={ddsInput} value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted">Shift</label>
            <select className={ddsSelect} value={shiftKind} onChange={(e) => setShiftKind(e.target.value)}>
              {shifts.map((s) => (
                <option key={s.kind} value={s.kind}>
                  {s.display_name?.trim() || s.kind}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:bg-black/[0.05] hover:text-fg disabled:opacity-40"
            aria-label="View preferences"
            title="View preferences"
            disabled={!user?.id || shellLoading}
            onClick={() => bodyRef.current?.openPrefs()}
          >
            <Settings2 className="size-4" aria-hidden />
          </button>
        </div>

        <DdsP2pSummaryBody
          ref={bodyRef}
          cellId={cellId}
          userId={user?.id}
          planDate={planDate}
          shiftKind={shiftKind}
          shifts={shifts}
          roles={roles}
          shellLoading={shellLoading}
          error={error}
          setError={setError}
          prefsHelpStandalone
          className="min-h-0"
        />
      </section>
    </div>
  )
}
