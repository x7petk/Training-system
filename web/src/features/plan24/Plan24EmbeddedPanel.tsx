/**
 * Plan 24 day grid for embedding (e.g. Shift DDS). Date and shift are controlled by the parent.
 * Includes grid interactions, ad hoc checks, person assignment, event detail — no tasks sheet or view-prefs UI.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, PanelRightClose, PanelRightOpen, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePlan24Workspace } from './Plan24WorkspaceContext'
import { Plan24Grid, PLAN24_DRAG_MIME } from './Plan24Grid'
import { Plan24EventDetailModal } from './Plan24EventDetailModal'
import { addMinutes, formatPlan24Clock, minutesBetween, patternDayIndex, shiftWindowBounds, type ShiftRow } from './plan24ShiftUtils'
import type {
  Plan24EventRow,
  Plan24PatternSlotRow,
  Plan24RoleAssignmentRow,
  Plan24RoleTeamDefaultRow,
  Plan24RosterRoleRow,
  Plan24RosterRow,
} from './plan24Types'
import { buildDefaultViewPrefs, loadViewPrefs, mergeViewPrefs, plan24NormalizedEventType, type Plan24ViewPrefs } from './plan24ViewPrefs'
import { plan24PersistCheckMove } from './plan24PersistCheckMove'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

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

export type Plan24EmbeddedPanelProps = {
  cellId: string
  planDate: string
  shiftKind: string
}

export function Plan24EmbeddedPanel({ cellId, planDate, shiftKind }: Plan24EmbeddedPanelProps) {
  const navigate = useNavigate()
  const { status: scopeStatus } = usePlan24Workspace()
  const { user, isAdmin } = useAuth()

  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [roster, setRoster] = useState<Plan24RosterRow | null>(null)
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [roles, setRoles] = useState<Plan24RosterRoleRow[]>([])
  const [events, setEvents] = useState<Plan24EventRow[]>([])
  const [assignments, setAssignments] = useState<Plan24RoleAssignmentRow[]>([])
  const [patternSlots, setPatternSlots] = useState<Plan24PatternSlotRow[]>([])
  const [roleTeamDefaults, setRoleTeamDefaults] = useState<Plan24RoleTeamDefaultRow[]>([])
  const [people, setPeople] = useState<
    { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
  >([])

  const [viewPrefs, setViewPrefs] = useState<Plan24ViewPrefs>(() => buildDefaultViewPrefs([]))

  const [adhocOpen, setAdhocOpen] = useState(false)
  const [adhocRole, setAdhocRole] = useState<string>('')
  const [adhocStart, setAdhocStart] = useState<Date | null>(null)
  const [adhocTitle, setAdhocTitle] = useState('Check')
  const [adhocEndMin, setAdhocEndMin] = useState('30')

  const [detailEv, setDetailEv] = useState<Plan24EventRow | null>(null)
  const [rolePickOpen, setRolePickOpen] = useState(false)
  const [rolePickName, setRolePickName] = useState('')
  const [rolePickPersonId, setRolePickPersonId] = useState<string>('')
  const [rolePickQuery, setRolePickQuery] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!cellId || scopeStatus !== 'ready') return
    setLoadErr(null)
    setLoading(true)
    const [materializeChecks, materializeCl, materializeCil, materializeQuality] = await Promise.all([
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
    const materializeErr =
      materializeChecks.error ?? materializeCl.error ?? materializeCil.error ?? materializeQuality.error
    if (materializeErr) setLoadErr(materializeErr.message)
    const rosterRes = await supabase
      .from('plan24_rosters')
      .select('id, master_cell_id, name, sort_order, is_active, effective_from, pattern_length, pattern_start_date')
      .eq('master_cell_id', cellId)
      .eq('is_active', true)
      .maybeSingle()
    if (rosterRes.error) {
      setLoadErr(rosterRes.error.message)
      setLoading(false)
      return
    }
    const r = rosterRes.data as Plan24RosterRow | null
    setRoster(r)
    if (!r) {
      setShifts([])
      setRoles([])
      setEvents([])
      setAssignments([])
      setPatternSlots([])
      setRoleTeamDefaults([])
      setLoading(false)
      return
    }
    const [shRes, roleRes, evRes, asRes, peRes, patRes, teamRes] = await Promise.all([
      supabase
        .from('plan24_roster_shifts')
        .select('kind, start_local, end_local, display_name')
        .eq('roster_id', r.id)
        .order('sort_order'),
      supabase
        .from('plan24_roster_roles')
        .select('id, roster_id, name, sort_order, is_active, default_person_id, default_person_day_id, default_person_night_id')
        .eq('roster_id', r.id),
      supabase
        .from('plan24_events')
        .select('*')
        .eq('master_cell_id', cellId)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind)
        .is('deleted_at', null)
        .order('start_at'),
      supabase
        .from('plan24_role_day_assignments')
        .select('roster_id, plan_date, shift_kind, role_name, person_id')
        .eq('roster_id', r.id)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind),
      supabase.from('people').select('id, display_name, first_name, last_name').order('display_name').limit(400),
      supabase.from('plan24_pattern_slots').select('*').eq('roster_id', r.id),
      supabase.from('plan24_teams').select('*').eq('roster_id', r.id).order('sort_order'),
    ])
    if (shRes.error) setLoadErr(shRes.error.message)
    else setShifts((shRes.data ?? []) as ShiftRow[])
    if (roleRes.error) setLoadErr(roleRes.error.message)
    else setRoles((roleRes.data ?? []) as Plan24RosterRoleRow[])
    if (evRes.error) setLoadErr(evRes.error.message)
    else setEvents((evRes.data ?? []) as Plan24EventRow[])
    if (asRes.error) setLoadErr(asRes.error.message)
    else setAssignments((asRes.data ?? []) as Plan24RoleAssignmentRow[])
    if (peRes.error) setLoadErr(peRes.error.message)
    else setPeople((peRes.data ?? []) as typeof people)
    if (patRes.error) setLoadErr(patRes.error.message)
    else setPatternSlots((patRes.data ?? []) as Plan24PatternSlotRow[])
    if (teamRes.error) setLoadErr(teamRes.error.message)

    const roleRows = (roleRes.data ?? []) as Plan24RosterRoleRow[]
    const roleIds = roleRows.map((x) => x.id)
    if (roleIds.length > 0) {
      const rtdRes = await supabase.from('plan24_role_team_defaults').select('*').in('role_id', roleIds)
      if (rtdRes.error) setLoadErr(rtdRes.error.message)
      else setRoleTeamDefaults((rtdRes.data ?? []) as Plan24RoleTeamDefaultRow[])
    } else {
      setRoleTeamDefaults([])
    }

    setLoading(false)
  }, [cellId, scopeStatus, planDate, shiftKind])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!successMsg) return
    const t = window.setTimeout(() => setSuccessMsg(null), 2600)
    return () => window.clearTimeout(t)
  }, [successMsg])

  const activeRoles = useMemo(() => roles.filter((r) => r.is_active).sort((a, b) => a.sort_order - b.sort_order), [roles])

  useEffect(() => {
    if (!cellId || !user?.id) {
      setViewPrefs(buildDefaultViewPrefs([]))
      return
    }
    const roleNames = activeRoles.map((r) => r.name.trim())
    const stored = loadViewPrefs(user.id, cellId)
    setViewPrefs(mergeViewPrefs(stored, roleNames))
  }, [user?.id, cellId, activeRoles])

  const windowBounds = useMemo(() => shiftWindowBounds(planDate, shiftKind, shifts), [planDate, shiftKind, shifts])

  const assignmentByRole = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const a of assignments) m.set(a.role_name, a.person_id)
    return m
  }, [assignments])

  const patternDay = useMemo(() => {
    const plen = roster?.pattern_length != null ? roster.pattern_length : 8
    return patternDayIndex(planDate, roster?.pattern_start_date ?? null, plen)
  }, [planDate, roster])

  const activeTeamId = useMemo(() => {
    const slot = patternSlots.find((p) => p.pattern_day === patternDay && p.shift_kind === shiftKind)
    return slot?.team_id ?? null
  }, [patternSlots, patternDay, shiftKind])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const personIdByRole = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const r of activeRoles) {
      if (assignmentByRole.has(r.name)) {
        m.set(r.name, assignmentByRole.get(r.name) ?? null)
        continue
      }
      let pid: string | null = null
      if (activeTeamId) {
        const d = roleTeamDefaults.find((x) => x.role_id === r.id && x.team_id === activeTeamId)
        pid = d?.person_id ?? null
      }
      if (!pid) pid = legacyDefaultPersonId(r, shiftKind)
      m.set(r.name, pid)
    }
    return m
  }, [activeRoles, assignmentByRole, roleTeamDefaults, activeTeamId, shiftKind])

  const roleCols = useMemo(
    () =>
      activeRoles.map((r) => {
        const aid = personIdByRole.get(r.name) ?? null
        const p = aid ? peopleById.get(aid) : undefined
        const sub = p ? personLabel(p) : undefined
        return { name: r.name, subtitle: sub }
      }),
    [activeRoles, personIdByRole, peopleById],
  )

  const rosterRoleLowerSet = useMemo(
    () => new Set(activeRoles.map((r) => r.name.trim().toLowerCase())),
    [activeRoles],
  )

  const eventRoleMatchesRosterColumn = useCallback(
    (e: Plan24EventRow) => {
      const rn = (e.role_name ?? '').trim()
      if (!rn) return false
      return rosterRoleLowerSet.has(rn.toLowerCase())
    },
    [rosterRoleLowerSet],
  )

  const gridPlacedEvents = useMemo(
    () => events.filter((e) => !e.deleted_at && eventRoleMatchesRosterColumn(e)),
    [events, eventRoleMatchesRosterColumn],
  )

  const unassignedEvents = useMemo(
    () => events.filter((e) => !e.deleted_at && !eventRoleMatchesRosterColumn(e)),
    [events, eventRoleMatchesRosterColumn],
  )

  const viewPrefsPasses = useCallback(
    (e: Plan24EventRow) => {
      const tk = plan24NormalizedEventType(e.event_type)
      if (viewPrefs.eventTypes[tk] === false) return false
      const rn = (e.role_name ?? '').trim()
      if (!rn) return true
      if (viewPrefs.roles[rn] === false) return false
      return true
    },
    [viewPrefs],
  )

  const gridPlacedEventsView = useMemo(
    () => gridPlacedEvents.filter(viewPrefsPasses),
    [gridPlacedEvents, viewPrefsPasses],
  )

  const roleColsView = useMemo(
    () => roleCols.filter((c) => viewPrefs.roles[c.name] !== false),
    [roleCols, viewPrefs],
  )

  const rosterId = roster?.id

  const upsertAssignment = useCallback(
    async (roleName: string, personId: string | null) => {
      if (!rosterId) return
      const { error } = await supabase.from('plan24_role_day_assignments').upsert(
        {
          roster_id: rosterId,
          plan_date: planDate,
          shift_kind: shiftKind,
          role_name: roleName,
          person_id: personId,
        },
        { onConflict: 'roster_id,plan_date,shift_kind,role_name' },
      )
      if (error) setLoadErr(error.message)
      else void refresh()
    },
    [rosterId, planDate, shiftKind, refresh],
  )

  const onBackgroundClick = useCallback((roleName: string, startAt: Date) => {
    setAdhocRole(roleName)
    setAdhocStart(startAt)
    setAdhocTitle('Check')
    setAdhocEndMin('30')
    setAdhocOpen(true)
  }, [])

  const saveAdhoc = useCallback(async () => {
    if (!cellId || !rosterId || !adhocStart || !user?.id) return
    const dur = Math.max(5, Number(adhocEndMin) || 30)
    const end = addMinutes(adhocStart, dur)
    setBusy(true)
    const { error } = await supabase.from('plan24_events').insert({
      master_cell_id: cellId,
      roster_id: rosterId,
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
      created_by: user.id,
    })
    setBusy(false)
    if (error) setLoadErr(error.message)
    else {
      setAdhocOpen(false)
      void refresh()
    }
  }, [cellId, rosterId, planDate, shiftKind, adhocStart, adhocRole, adhocTitle, adhocEndMin, user, refresh])

  const onEventMove = useCallback(
    async (eventId: string, startAt: Date, endAt: Date, roleName: string) => {
      const ev = events.find((x) => x.id === eventId)
      if (!ev) return
      const err = await plan24PersistCheckMove(supabase, ev, eventId, startAt, endAt, roleName)
      if (err) setLoadErr(err)
      else {
        setEvents((prev) =>
          prev.map((row) =>
            row.id === eventId
              ? {
                  ...row,
                  start_at: startAt.toISOString(),
                  end_at: endAt.toISOString(),
                  role_name: roleName.trim() === '' ? null : roleName.trim(),
                  source: row.schedule_id ? 'ad_hoc' : row.source,
                  schedule_id: row.schedule_id ? null : row.schedule_id,
                  schedule_occurrence_at: row.schedule_id ? null : row.schedule_occurrence_at,
                  template_version_id: row.schedule_id ? null : row.template_version_id,
                  schedule_role_name: row.schedule_id ? '' : roleName,
                }
              : row,
          ),
        )
        void refresh()
      }
    },
    [events, refresh],
  )

  const onRoleHeaderClick = useCallback(
    (roleName: string) => {
      setRolePickName(roleName)
      const pid = personIdByRole.get(roleName) ?? ''
      setRolePickPersonId(pid || '')
      setRolePickQuery('')
      setRolePickOpen(true)
    },
    [personIdByRole],
  )

  const onDropUnassigned = useCallback(
    async (eventId: string, roleName: string, startAt: Date) => {
      const ev = events.find((e) => e.id === eventId)
      if (!ev) return
      const dur = minutesBetween(new Date(ev.start_at), new Date(ev.end_at))
      const endAt = addMinutes(startAt, Math.max(5, dur))
      const err = await plan24PersistCheckMove(supabase, ev, eventId, startAt, endAt, roleName)
      if (err) setLoadErr(err)
      else {
        setEvents((prev) =>
          prev.map((row) =>
            row.id === eventId
              ? {
                  ...row,
                  start_at: startAt.toISOString(),
                  end_at: endAt.toISOString(),
                  role_name: roleName.trim() === '' ? null : roleName.trim(),
                  source: row.schedule_id ? 'ad_hoc' : row.source,
                  schedule_id: row.schedule_id ? null : row.schedule_id,
                  schedule_occurrence_at: row.schedule_id ? null : row.schedule_occurrence_at,
                  template_version_id: row.schedule_id ? null : row.template_version_id,
                  schedule_role_name: row.schedule_id ? '' : roleName,
                }
              : row,
          ),
        )
        void refresh()
      }
    },
    [events, refresh],
  )

  const filteredPickPeople = useMemo(() => {
    const q = rolePickQuery.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => {
      const label = personLabel(p).toLowerCase()
      return label.includes(q)
    })
  }, [people, rolePickQuery])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-end gap-2">
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Updating…
          </span>
        ) : null}
        <button
          type="button"
          className={`inline-flex shrink-0 items-center rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-fg shadow-sm hover:bg-surface-raised/80 ${
            panelOpen ? 'gap-1' : ''
          }`}
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="plan24-embedded-unassigned"
          aria-label={panelOpen ? 'Close unassigned panel' : 'Open unassigned panel'}
        >
          {panelOpen ? <PanelRightClose className="size-3.5 shrink-0" aria-hidden /> : <PanelRightOpen className="size-3.5 shrink-0" aria-hidden />}
          Unassigned{unassignedEvents.length ? ` · ${unassignedEvents.length}` : ''}
        </button>
      </div>

      {loadErr ? (
        <div className="mb-2 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
          {loadErr}
        </div>
      ) : null}
      {successMsg ? (
        <div className="mb-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100" role="status">
          {successMsg}
        </div>
      ) : null}

      {!roster ? (
        <div className="rounded-xl border border-border bg-surface-raised/50 px-3 py-2 text-xs text-muted">
          No active Plan 24 roster for this cell.
        </div>
      ) : null}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          {roster && shifts.length > 0 && activeRoles.length > 0 && roleColsView.length > 0 ? (
            <Plan24Grid
              windowStart={windowBounds.start}
              windowEnd={windowBounds.end}
              roles={roleColsView}
              events={gridPlacedEventsView}
              onBackgroundClick={onBackgroundClick}
              onEventClick={(ev) => setDetailEv(ev)}
              onEventMove={onEventMove}
              onDropUnassigned={onDropUnassigned}
              onRoleHeaderClick={onRoleHeaderClick}
            />
          ) : roster && shifts.length > 0 && activeRoles.length > 0 && roleColsView.length === 0 ? (
            <div className="flex min-h-[10rem] flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted">
              <p className="text-fg/80">All roles are hidden in Plan 24 view preferences.</p>
              <p className="max-w-md">Open Plan 24 and use the preferences control to show at least one role.</p>
            </div>
          ) : roster ? (
            <div className="flex min-h-[10rem] flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted">
              <p>{shifts.length === 0 ? 'No shifts configured for this roster.' : 'No active roles yet.'}</p>
            </div>
          ) : (
            <div className="min-h-[10rem] flex-1" />
          )}

          {panelOpen ? (
            <div
              role="presentation"
              className="absolute inset-0 z-10 rounded-xl bg-black/25 transition-opacity"
              onClick={() => setPanelOpen(false)}
            />
          ) : null}

          <aside
            id="plan24-embedded-unassigned"
            className={`absolute inset-y-0 right-0 z-20 flex w-[min(18rem,calc(100vw-2rem))] max-w-full min-w-0 flex-col rounded-l-xl border border-border-strong border-r-0 bg-surface shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
              panelOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
            }`}
            aria-hidden={!panelOpen}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg/70">Unassigned</span>
              <button
                type="button"
                className="inline-flex rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
                aria-label="Close"
                onClick={() => setPanelOpen(false)}
              >
                <PanelRightClose className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2">
              {unassignedEvents.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">No unassigned checks.</p>
              ) : (
                unassignedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PLAN24_DRAG_MIME, ev.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="cursor-grab rounded-lg border border-dashed border-sky-900/40 bg-sky-950/90 px-2 py-2 text-xs font-medium text-sky-50 active:cursor-grabbing dark:border-sky-700/50"
                  >
                    <div className="font-semibold">{ev.title}</div>
                    <div className="mt-0.5 text-[10px] font-normal opacity-90">
                      {formatPlan24Clock(new Date(ev.start_at))}–{formatPlan24Clock(new Date(ev.end_at))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      {adhocOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan24-emb-adhoc-title"
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void saveAdhoc()
              }}
            >
              <h2 id="plan24-emb-adhoc-title" className="font-display text-lg font-semibold">
                Ad hoc check
              </h2>
              <p className="text-xs text-muted">
                Role <strong className="text-fg">{adhocRole}</strong> · starts {adhocStart ? formatPlan24Clock(adhocStart) : '—'}
              </p>
              <label className="block text-xs font-medium text-muted">
                Title
                <input className={`${inputClass} mt-1`} value={adhocTitle} onChange={(e) => setAdhocTitle(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-muted">
                Duration (minutes)
                <input
                  className={`${inputClass} mt-1`}
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
                  disabled={busy}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailEv ? (
        <Plan24EventDetailModal
          event={detailEv}
          cellId={cellId}
          windowEnd={windowBounds.end}
          userId={user?.id}
          isAdmin={isAdmin}
          navigate={navigate}
          onClose={() => setDetailEv(null)}
          onSaved={() => void refresh()}
          onLoadError={setLoadErr}
          onSuccessMsg={setSuccessMsg}
        />
      ) : null}

      {rolePickOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl" role="dialog" aria-modal="true">
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Person on {rolePickName}</h2>
              <p className="text-xs text-muted">Applies to this day and shift only.</p>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  autoFocus
                  className={`${inputClass} pl-9`}
                  placeholder="Search people"
                  value={rolePickQuery}
                  onChange={(e) => setRolePickQuery(e.target.value)}
                  aria-label="Search people"
                />
              </label>
              <ul className="max-h-64 overflow-y-auto rounded-xl border border-border" role="listbox" aria-label="People">
                <li>
                  <button
                    type="button"
                    role="option"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent-dim/50 ${
                      rolePickPersonId === '' ? 'bg-accent-dim text-accent' : 'text-muted'
                    }`}
                    onClick={() => setRolePickPersonId('')}
                  >
                    <span>— None —</span>
                  </button>
                </li>
                {filteredPickPeople.map((p) => {
                  const sel = rolePickPersonId === p.id
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        className={`flex w-full items-center justify-between border-t border-border px-3 py-2 text-left text-sm hover:bg-accent-dim/40 ${
                          sel ? 'bg-accent-dim text-accent' : 'text-fg'
                        }`}
                        onClick={() => setRolePickPersonId(p.id)}
                      >
                        <span>{personLabel(p)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]" onClick={() => setRolePickOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    void upsertAssignment(rolePickName, rolePickPersonId || null)
                    setRolePickOpen(false)
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
