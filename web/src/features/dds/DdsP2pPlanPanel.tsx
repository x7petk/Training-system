import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Plan24Grid } from '../plan24/Plan24Grid'
import { Plan24EventDetailModal } from '../plan24/Plan24EventDetailModal'
import { plan24PersistCheckMove } from '../plan24/plan24PersistCheckMove'
import {
  addMinutes,
  formatPlan24Clock,
  minutesBetween,
  shiftWindowBounds,
  type ShiftRow,
} from '../plan24/plan24ShiftUtils'
import type {
  Plan24EventRow,
  Plan24TaskRow,
} from '../plan24/plan24Types'
import { DdsP2pScopeFilterBar } from './DdsP2pScopeFilterBar'
import { resolveRolePersonNamesForShifts, plan24ShiftScopeKey } from '../plan24/plan24RolePerson'

function roleMatches(evRole: string | null, roleName: string): boolean {
  return (evRole ?? '').trim().toLowerCase() === roleName.trim().toLowerCase()
}

type PlanPanelShift = {
  kind: string
  display_name: string | null
  sort_order: number
  start_local: string
  end_local: string
}

type PlanPanelRole = { id: string; name: string }

type Props = {
  cellId: string
  planDate: string
  shiftKind: string
  rosterRoleId: string
  roleName: string
  roles: PlanPanelRole[]
  userId: string
  shifts: PlanPanelShift[]
  onPlanDateChange: (ymd: string) => void
  onShiftKindChange: (kind: string) => void
  onRoleIdChange: (id: string) => void
  onError: (msg: string) => void
  onSuccessMsg?: (msg: string | null) => void
  /** Fired when plan events change (complete, save, move, ad-hoc) so P2P stats can refresh. */
  onPlanDataChanged?: () => void
}

export function DdsP2pPlanPanel({
  cellId,
  planDate,
  shiftKind,
  rosterRoleId,
  roleName,
  roles,
  userId,
  shifts,
  onPlanDateChange,
  onShiftKindChange,
  onRoleIdChange,
  onError,
  onSuccessMsg,
  onPlanDataChanged,
}: Props) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [events, setEvents] = useState<Plan24EventRow[]>([])
  const [tasks, setTasks] = useState<Plan24TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailEv, setDetailEv] = useState<Plan24EventRow | null>(null)
  const [rolePersonSubtitle, setRolePersonSubtitle] = useState<string | undefined>(undefined)
  const [adhocOpen, setAdhocOpen] = useState(false)
  const [adhocRole, setAdhocRole] = useState<string>('')
  const [adhocStart, setAdhocStart] = useState<Date | null>(null)
  const [adhocTitle, setAdhocTitle] = useState('Check')
  const [adhocEndMin, setAdhocEndMin] = useState('30')
  const [adhocSaving, setAdhocSaving] = useState(false)

  const shiftRowsForBounds: ShiftRow[] = useMemo(
    () =>
      shifts.map((s) => ({
        kind: s.kind,
        start_local: s.start_local,
        end_local: s.end_local,
        display_name: s.display_name,
      })),
    [shifts],
  )

  const windowBounds = useMemo(
    () => shiftWindowBounds(planDate, shiftKind, shiftRowsForBounds),
    [planDate, shiftKind, shiftRowsForBounds],
  )

  const roleCols = useMemo(
    () => [{ name: roleName, subtitle: rolePersonSubtitle }],
    [roleName, rolePersonSubtitle],
  )

  useEffect(() => {
    let cancelled = false
    async function loadRolePersonSubtitle() {
      if (!cellId || !rosterRoleId || !roleName.trim() || !shiftKind) {
        setRolePersonSubtitle(undefined)
        return
      }
      const names = await resolveRolePersonNamesForShifts(cellId, rosterRoleId, roleName, [{ planDate, shiftKind }])
      if (cancelled) return
      const label = names.get(plan24ShiftScopeKey(planDate, shiftKind))
      setRolePersonSubtitle(label && label !== '—' ? label : undefined)
    }
    void loadRolePersonSubtitle()
    return () => {
      cancelled = true
    }
  }, [cellId, rosterRoleId, roleName, shiftKind, planDate])

  const refresh = useCallback(async () => {
    if (!cellId || !roleName) {
      setEvents([])
      setTasks([])
      return
    }
    setLoading(true)
    await Promise.all([
      supabase.rpc('plan24_materialize_check_schedules', {
        p_master_cell_id: cellId,
        p_from_date: planDate,
        p_to_date: planDate,
      }),
      supabase.rpc('plan24_materialize_cl_check_schedules', {
        p_master_cell_id: cellId,
        p_from_date: planDate,
        p_to_date: planDate,
      }),
      supabase.rpc('plan24_materialize_cil_check_schedules', {
        p_master_cell_id: cellId,
        p_from_date: planDate,
        p_to_date: planDate,
      }),
      supabase.rpc('plan24_materialize_quality_check_schedules', {
        p_master_cell_id: cellId,
        p_from_date: planDate,
        p_to_date: planDate,
      }),
    ])

    const [evRes, tRes] = await Promise.all([
      supabase
        .from('plan24_events')
        .select('*')
        .eq('master_cell_id', cellId)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind)
        .is('deleted_at', null)
        .order('start_at'),
      supabase
        .from('plan24_tasks')
        .select('id, master_cell_id, role_name, owner_id, title, done, sort_order')
        .eq('master_cell_id', cellId)
        .eq('owner_id', userId)
        .order('sort_order'),
    ])
    setLoading(false)
    if (evRes.error) {
      onError(evRes.error.message)
      setEvents([])
      return
    }
    if (tRes.error) {
      onError(tRes.error.message)
      setTasks([])
      return
    }
    const evs = (evRes.data ?? []) as Plan24EventRow[]
    setEvents(evs.filter((e) => roleMatches(e.role_name, roleName)))
    const ts = (tRes.data ?? []) as Plan24TaskRow[]
    setTasks(ts.filter((t) => roleMatches(t.role_name, roleName)))
  }, [cellId, planDate, shiftKind, roleName, userId, onError])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onEventMove = useCallback(
    async (eventId: string, startAt: Date, endAt: Date, rn: string) => {
      const ev = events.find((x) => x.id === eventId)
      if (!ev) return
      const err = await plan24PersistCheckMove(supabase, ev, eventId, startAt, endAt, rn)
      if (err) onError(err)
      else {
        setEvents((prev) =>
          prev.map((row) =>
            row.id === eventId
              ? {
                  ...row,
                  start_at: startAt.toISOString(),
                  end_at: endAt.toISOString(),
                  role_name: rn.trim() === '' ? null : rn.trim(),
                  source: row.schedule_id ? 'ad_hoc' : row.source,
                  schedule_id: row.schedule_id ? null : row.schedule_id,
                  schedule_occurrence_at: row.schedule_id ? null : row.schedule_occurrence_at,
                  template_version_id: row.schedule_id ? null : row.template_version_id,
                  schedule_role_name: row.schedule_id ? '' : rn,
                }
              : row,
          ),
        )
        void refresh()
        onPlanDataChanged?.()
      }
    },
    [events, onError, refresh, onPlanDataChanged],
  )

  const onDropUnassigned = useCallback(
    async (eventId: string, rn: string, startAt: Date) => {
      const ev = events.find((e) => e.id === eventId)
      if (!ev) return
      const dur = minutesBetween(new Date(ev.start_at), new Date(ev.end_at))
      const endAt = addMinutes(startAt, Math.max(5, dur))
      const err = await plan24PersistCheckMove(supabase, ev, eventId, startAt, endAt, rn)
      if (err) onError(err)
      else {
        setEvents((prev) =>
          prev.map((row) =>
            row.id === eventId
              ? {
                  ...row,
                  start_at: startAt.toISOString(),
                  end_at: endAt.toISOString(),
                  role_name: rn.trim() === '' ? null : rn.trim(),
                  source: row.schedule_id ? 'ad_hoc' : row.source,
                  schedule_id: row.schedule_id ? null : row.schedule_id,
                  schedule_occurrence_at: row.schedule_id ? null : row.schedule_occurrence_at,
                  template_version_id: row.schedule_id ? null : row.template_version_id,
                  schedule_role_name: row.schedule_id ? '' : rn,
                }
              : row,
          ),
        )
        void refresh()
        onPlanDataChanged?.()
      }
    },
    [events, onError, refresh, onPlanDataChanged],
  )

  async function toggleTask(t: Plan24TaskRow) {
    setBusyId(t.id)
    const { error } = await supabase.from('plan24_tasks').update({ done: !t.done }).eq('id', t.id)
    setBusyId(null)
    if (error) onError(error.message)
    else {
      void refresh()
      onPlanDataChanged?.()
    }
  }

  const gridEvents = events

  const handleModalLoadError = useCallback(
    (msg: string | null) => {
      onError(msg ?? '')
    },
    [onError],
  )

  const handleModalSuccess = useCallback(
    (msg: string | null) => {
      onSuccessMsg?.(msg)
      onPlanDataChanged?.()
    },
    [onSuccessMsg, onPlanDataChanged],
  )

  const handleModalSaved = useCallback(() => {
    void refresh()
    onPlanDataChanged?.()
  }, [refresh, onPlanDataChanged])

  const onBackgroundClick = useCallback((rn: string, startAt: Date) => {
    setAdhocRole(rn)
    setAdhocStart(startAt)
    setAdhocTitle('Check')
    setAdhocEndMin('30')
    setAdhocOpen(true)
  }, [])

  const saveAdhoc = useCallback(async () => {
    if (!cellId || !userId || !planDate || !shiftKind || !adhocStart) return
    const dur = Math.max(5, Number(adhocEndMin) || 30)
    const end = addMinutes(adhocStart, dur)
    setAdhocSaving(true)
    const { error } = await supabase.from('plan24_events').insert({
      master_cell_id: cellId,
      plan_date: planDate,
      shift_kind: shiftKind,
      role_name: adhocRole,
      schedule_role_name: adhocRole || '',
      title: adhocTitle.trim() || 'Check',
      event_type: 'check',
      source: 'ad_hoc',
      start_at: adhocStart.toISOString(),
      end_at: end.toISOString(),
      status: 'scheduled',
      sub_tasks: [],
      created_by: userId,
    })
    setAdhocSaving(false)
    if (error) {
      onError(error.message)
      return
    }
    setAdhocOpen(false)
    onSuccessMsg?.('Ad-hoc check added to Plan 24.')
    void refresh()
    onPlanDataChanged?.()
  }, [cellId, userId, planDate, shiftKind, adhocStart, adhocEndMin, adhocRole, adhocTitle, onError, onSuccessMsg, onPlanDataChanged, refresh])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-1.5 py-1">
        <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">My plan</h2>
        <DdsP2pScopeFilterBar
          planDate={planDate}
          shiftKind={shiftKind}
          roleId={rosterRoleId}
          shifts={shifts}
          roles={roles}
          onPlanDateChange={onPlanDateChange}
          onShiftKindChange={onShiftKindChange}
          onRoleIdChange={onRoleIdChange}
          disabled={roles.length === 0}
        />
        {loading ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted" aria-live="polite">
            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
            Loading…
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-1.5">
        {!shiftKind || shifts.length === 0 ? (
          <p className="text-[11px] text-muted">Select a shift to show the Plan 24-style timeline.</p>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border/70 bg-surface-raised/20">
            {gridEvents.length === 0 && !loading ? (
              <p className="shrink-0 px-1.5 py-0.5 text-[10px] text-muted">No checks on the plan for this role, date, and shift.</p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">
              <Plan24Grid
                className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent shadow-none"
                windowStart={windowBounds.start}
                windowEnd={windowBounds.end}
                roles={roleCols}
                events={gridEvents}
                onBackgroundClick={onBackgroundClick}
                onEventClick={(ev) => setDetailEv(ev)}
                onEventMove={onEventMove}
                onDropUnassigned={onDropUnassigned}
              />
            </div>
          </div>
        )}
        {tasks.length > 0 ? (
          <div className="shrink-0 border-t border-border/60 pt-1">
            <p className="mb-0.5 text-[9px] font-semibold uppercase text-muted">My tasks</p>
            <ul className="max-h-20 space-y-0 overflow-y-auto">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3 rounded border-border accent-accent"
                    checked={t.done}
                    disabled={busyId === t.id}
                    onChange={() => void toggleTask(t)}
                  />
                  <span className={t.done ? 'text-muted line-through' : ''}>{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {detailEv ? (
        <Plan24EventDetailModal
          event={detailEv}
          cellId={cellId}
          windowEnd={windowBounds.end}
          userId={userId}
          isAdmin={isAdmin}
          navigate={navigate}
          onClose={() => setDetailEv(null)}
          onSaved={handleModalSaved}
          onLoadError={handleModalLoadError}
          onSuccessMsg={handleModalSuccess}
        />
      ) : null}

      {adhocOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="p2p-plan-adhoc-title"
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void saveAdhoc()
              }}
            >
              <h2 id="p2p-plan-adhoc-title" className="font-display text-lg font-semibold">
                New ad-hoc check
              </h2>
              <p className="text-xs text-muted">
                Role <strong className="text-fg">{adhocRole}</strong> · starts {adhocStart ? formatPlan24Clock(adhocStart) : '—'}
              </p>
              <label className="block text-xs font-medium text-muted">
                Title
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-1"
                  value={adhocTitle}
                  onChange={(e) => setAdhocTitle(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Duration (minutes)
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-1"
                  type="number"
                  min={5}
                  step={5}
                  value={adhocEndMin}
                  onChange={(e) => setAdhocEndMin(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]"
                  onClick={() => setAdhocOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adhocSaving}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {adhocSaving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
