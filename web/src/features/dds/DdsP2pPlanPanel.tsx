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
  patternDayIndex,
  resolveNextShift,
  shiftWindowBounds,
  type ShiftRow,
} from '../plan24/plan24ShiftUtils'
import type {
  Plan24EventRow,
  Plan24PatternSlotRow,
  Plan24RoleAssignmentRow,
  Plan24RoleTeamDefaultRow,
  Plan24RosterRoleRow,
  Plan24RosterRow,
  Plan24TaskRow,
} from '../plan24/plan24Types'

function roleMatches(evRole: string | null, roleName: string): boolean {
  return (evRole ?? '').trim().toLowerCase() === roleName.trim().toLowerCase()
}

function personLabel(p: {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return a || p.display_name || p.id.slice(0, 8)
}

function legacyDefaultPersonId(r: Plan24RosterRoleRow, sk: string): string | null {
  if (sk === 'day') return r.default_person_day_id ?? r.default_person_id ?? null
  if (sk === 'night') return r.default_person_night_id ?? r.default_person_id ?? null
  return r.default_person_id ?? null
}

type PlanPanelShift = {
  kind: string
  display_name: string | null
  sort_order: number
  start_local: string
  end_local: string
}

type Props = {
  cellId: string
  planDate: string
  shiftKind: string
  rosterRoleId: string
  roleName: string
  userId: string
  shifts: PlanPanelShift[]
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
  userId,
  shifts,
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
  const [shiftPlanView, setShiftPlanView] = useState<'my' | 'next'>('my')
  const [adhocOpen, setAdhocOpen] = useState(false)
  const [adhocRole, setAdhocRole] = useState<string>('')
  const [adhocStart, setAdhocStart] = useState<Date | null>(null)
  const [adhocTitle, setAdhocTitle] = useState('Check')
  const [adhocEndMin, setAdhocEndMin] = useState('30')
  const [adhocSaving, setAdhocSaving] = useState(false)

  useEffect(() => {
    setShiftPlanView('my')
  }, [cellId, planDate, shiftKind])

  const nextShiftScope = useMemo(
    () => resolveNextShift(planDate, shiftKind, shifts),
    [planDate, shiftKind, shifts],
  )

  const viewPlanDate = shiftPlanView === 'next' ? nextShiftScope.planDate : planDate
  const viewShiftKind = shiftPlanView === 'next' ? nextShiftScope.shiftKind : shiftKind

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
    () => shiftWindowBounds(viewPlanDate, viewShiftKind, shiftRowsForBounds),
    [viewPlanDate, viewShiftKind, shiftRowsForBounds],
  )

  const roleCols = useMemo(
    () => [{ name: roleName, subtitle: rolePersonSubtitle }],
    [roleName, rolePersonSubtitle],
  )

  useEffect(() => {
    let cancelled = false
    async function loadRolePersonSubtitle() {
      if (!cellId || !rosterRoleId || !roleName.trim() || !viewShiftKind) {
        setRolePersonSubtitle(undefined)
        return
      }
      const rosterRes = await supabase
        .from('plan24_rosters')
        .select('id, pattern_length, pattern_start_date')
        .eq('master_cell_id', cellId)
        .eq('is_active', true)
        .maybeSingle()
      if (cancelled) return
      const roster = rosterRes.data as Plan24RosterRow | null
      if (rosterRes.error || !roster?.id) {
        setRolePersonSubtitle(undefined)
        return
      }
      const rosterId = roster.id
      const [roleRes, asRes, patRes, rtdRes] = await Promise.all([
        supabase
          .from('plan24_roster_roles')
          .select('id, name, default_person_id, default_person_day_id, default_person_night_id')
          .eq('id', rosterRoleId)
          .eq('roster_id', rosterId)
          .maybeSingle(),
        supabase
          .from('plan24_role_day_assignments')
          .select('role_name, person_id')
          .eq('roster_id', rosterId)
          .eq('plan_date', viewPlanDate)
          .eq('shift_kind', viewShiftKind),
        supabase.from('plan24_pattern_slots').select('pattern_day, shift_kind, team_id').eq('roster_id', rosterId),
        supabase.from('plan24_role_team_defaults').select('team_id, person_id').eq('role_id', rosterRoleId),
      ])
      if (cancelled) return
      if (roleRes.error || !roleRes.data) {
        setRolePersonSubtitle(undefined)
        return
      }
      const roleRow = roleRes.data as Plan24RosterRoleRow
      const assignments = (asRes.data ?? []) as Plan24RoleAssignmentRow[]
      const patternSlots = (patRes.data ?? []) as Plan24PatternSlotRow[]
      const roleTeamDefaults = (rtdRes.data ?? []) as Plan24RoleTeamDefaultRow[]

      const assignmentByRole = new Map<string, string | null>()
      for (const a of assignments) {
        assignmentByRole.set(a.role_name, a.person_id)
      }

      let personId: string | null = null
      if (assignmentByRole.has(roleRow.name)) {
        personId = assignmentByRole.get(roleRow.name) ?? null
      } else {
        const plen = roster.pattern_length != null ? roster.pattern_length : 8
        const patternDay = patternDayIndex(viewPlanDate, roster.pattern_start_date ?? null, plen)
        const slot = patternSlots.find((p) => p.pattern_day === patternDay && p.shift_kind === viewShiftKind)
        const activeTeamId = slot?.team_id ?? null
        if (activeTeamId) {
          const d = roleTeamDefaults.find((x) => x.team_id === activeTeamId)
          personId = d?.person_id ?? null
        }
        if (!personId) personId = legacyDefaultPersonId(roleRow, viewShiftKind)
      }

      if (!personId) {
        setRolePersonSubtitle(undefined)
        return
      }
      const peRes = await supabase
        .from('people')
        .select('id, display_name, first_name, last_name')
        .eq('id', personId)
        .maybeSingle()
      if (cancelled) return
      if (peRes.error || !peRes.data) {
        setRolePersonSubtitle(undefined)
        return
      }
      setRolePersonSubtitle(
        personLabel(
          peRes.data as {
            id: string
            display_name: string | null
            first_name: string | null
            last_name: string | null
          },
        ),
      )
    }
    void loadRolePersonSubtitle()
    return () => {
      cancelled = true
    }
  }, [cellId, rosterRoleId, roleName, viewShiftKind, viewPlanDate])

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
        p_from_date: viewPlanDate,
        p_to_date: viewPlanDate,
      }),
      supabase.rpc('plan24_materialize_cl_check_schedules', {
        p_master_cell_id: cellId,
        p_from_date: viewPlanDate,
        p_to_date: viewPlanDate,
      }),
      supabase.rpc('plan24_materialize_cil_check_schedules', {
        p_master_cell_id: cellId,
        p_from_date: viewPlanDate,
        p_to_date: viewPlanDate,
      }),
      supabase.rpc('plan24_materialize_quality_check_schedules', {
        p_master_cell_id: cellId,
        p_from_date: viewPlanDate,
        p_to_date: viewPlanDate,
      }),
    ])

    const [evRes, tRes] = await Promise.all([
      supabase
        .from('plan24_events')
        .select('*')
        .eq('master_cell_id', cellId)
        .eq('plan_date', viewPlanDate)
        .eq('shift_kind', viewShiftKind)
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
  }, [cellId, viewPlanDate, viewShiftKind, roleName, userId, onError])

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
    if (!cellId || !userId || !viewPlanDate || !viewShiftKind || !adhocStart) return
    const dur = Math.max(5, Number(adhocEndMin) || 30)
    const end = addMinutes(adhocStart, dur)
    setAdhocSaving(true)
    const { error } = await supabase.from('plan24_events').insert({
      master_cell_id: cellId,
      plan_date: viewPlanDate,
      shift_kind: viewShiftKind,
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
  }, [cellId, userId, viewPlanDate, viewShiftKind, adhocStart, adhocEndMin, adhocRole, adhocTitle, onError, onSuccessMsg, onPlanDataChanged, refresh])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-1.5 py-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">My plan</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="flex items-center gap-0.5 rounded-md border border-border/80 bg-surface-raised/30 p-0.5"
            role="group"
            aria-label="Plan shift"
          >
            <button
              type="button"
              onClick={() => setShiftPlanView('my')}
              className={`h-6 rounded px-2 text-[10px] font-semibold transition-colors ${
                shiftPlanView === 'my'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:bg-surface hover:text-fg'
              }`}
            >
              My shift
            </button>
            <button
              type="button"
              onClick={() => setShiftPlanView('next')}
              disabled={shifts.length === 0}
              className={`h-6 rounded px-2 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                shiftPlanView === 'next'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:bg-surface hover:text-fg'
              }`}
            >
              Next shift
            </button>
          </div>
          <div
            className="flex h-4 min-w-[4.75rem] items-center justify-end text-[10px] text-muted"
            aria-live="polite"
            aria-busy={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
                <span className="whitespace-nowrap">Loading…</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-1.5">
        {!viewShiftKind || shifts.length === 0 ? (
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
