import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localYMD } from '../lib/dueDateUtils'
import { useAuth } from '../hooks/useAuth'
import { Plan24Grid, PLAN24_DRAG_MIME } from '../features/plan24/Plan24Grid'
import { shiftWindowBounds, type ShiftRow } from '../features/plan24/plan24ShiftUtils'
import type {
  Plan24EventRow,
  Plan24RosterRoleRow,
  Plan24RosterRow,
  Plan24RoleAssignmentRow,
  Plan24ShiftKind,
  Plan24SubTask,
  Plan24TaskRow,
} from '../features/plan24/plan24Types'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { addMinutes, minutesBetween } from '../features/plan24/plan24ShiftUtils'

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

function shiftDefaultPersonId(r: Plan24RosterRoleRow, sk: Plan24ShiftKind): string | null {
  const day = r.default_person_day_id ?? r.default_person_id ?? null
  const night = r.default_person_night_id ?? r.default_person_id ?? null
  return sk === 'day' ? day : night
}

function parseSubTasks(raw: unknown): Plan24SubTask[] {
  if (!Array.isArray(raw)) return []
  const out: Plan24SubTask[] = []
  for (const x of raw) {
    if (x && typeof x === 'object' && 'id' in x && 'label' in x) {
      const o = x as { id: string; label: string; done?: boolean }
      out.push({ id: String(o.id), label: String(o.label), done: Boolean(o.done) })
    }
  }
  return out
}

export function Plan24Page() {
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const { user, isAdmin } = useAuth()
  const [planDate, setPlanDate] = useState(() => localYMD(new Date()))
  const [shiftKind, setShiftKind] = useState<Plan24ShiftKind>('day')
  const [panelOpen, setPanelOpen] = useState(true)
  const [taskBarOpen, setTaskBarOpen] = useState(false)
  const [taskRoleName, setTaskRoleName] = useState<string>('')

  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [roster, setRoster] = useState<Plan24RosterRow | null>(null)
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [roles, setRoles] = useState<Plan24RosterRoleRow[]>([])
  const [events, setEvents] = useState<Plan24EventRow[]>([])
  const [assignments, setAssignments] = useState<Plan24RoleAssignmentRow[]>([])
  const [people, setPeople] = useState<
    { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
  >([])
  const [tasks, setTasks] = useState<Plan24TaskRow[]>([])

  const [adhocOpen, setAdhocOpen] = useState(false)
  const [adhocRole, setAdhocRole] = useState<string>('')
  const [adhocStart, setAdhocStart] = useState<Date | null>(null)
  const [adhocTitle, setAdhocTitle] = useState('Check')
  const [adhocEndMin, setAdhocEndMin] = useState('30')

  const [detailEv, setDetailEv] = useState<Plan24EventRow | null>(null)
  const [detailSubs, setDetailSubs] = useState<Plan24SubTask[]>([])
  const [detailOverride, setDetailOverride] = useState(false)

  const [deleteEv, setDeleteEv] = useState<Plan24EventRow | null>(null)
  const [deleteComment, setDeleteComment] = useState('')

  const [rolePickOpen, setRolePickOpen] = useState(false)
  const [rolePickName, setRolePickName] = useState('')
  const [rolePickPersonId, setRolePickPersonId] = useState<string>('')

  const [newTaskTitle, setNewTaskTitle] = useState('')

  const windowBounds = useMemo(
    () => shiftWindowBounds(planDate, shiftKind, shifts),
    [planDate, shiftKind, shifts],
  )

  const activeRoles = useMemo(() => roles.filter((r) => r.is_active).sort((a, b) => a.sort_order - b.sort_order), [roles])

  const assignmentByRole = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const a of assignments) m.set(a.role_name, a.person_id)
    return m
  }, [assignments])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const roleCols = useMemo(
    () =>
      activeRoles.map((r) => {
        const aid = assignmentByRole.get(r.name) ?? shiftDefaultPersonId(r, shiftKind)
        const p = aid ? peopleById.get(aid) : undefined
        const sub = p ? personLabel(p) : undefined
        return { name: r.name, subtitle: sub }
      }),
    [activeRoles, assignmentByRole, peopleById, shiftKind],
  )

  const assignedEvents = useMemo(() => events.filter((e) => e.role_name && !e.deleted_at), [events])
  const unassignedEvents = useMemo(() => events.filter((e) => !e.role_name && !e.deleted_at), [events])

  const pixelsPerMinute = 1.65

  const refresh = useCallback(async () => {
    if (!cellId || scopeStatus !== 'ready') return
    setLoadErr(null)
    const rosterRes = await supabase
      .from('plan24_rosters')
      .select('id, master_cell_id, name, sort_order, is_active, effective_from')
      .eq('master_cell_id', cellId)
      .eq('is_active', true)
      .maybeSingle()
    if (rosterRes.error) {
      setLoadErr(rosterRes.error.message)
      return
    }
    const r = rosterRes.data as Plan24RosterRow | null
    setRoster(r)
    if (!r) {
      setShifts([])
      setRoles([])
      setEvents([])
      setAssignments([])
      return
    }
    const [shRes, roleRes, evRes, asRes, peRes] = await Promise.all([
      supabase.from('plan24_roster_shifts').select('kind, start_local, end_local').eq('roster_id', r.id).order('sort_order'),
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

    if (user?.id) {
      const tRes = await supabase
        .from('plan24_tasks')
        .select('id, master_cell_id, role_name, owner_id, title, done, sort_order')
        .eq('master_cell_id', cellId)
        .eq('owner_id', user.id)
        .order('sort_order')
      if (!tRes.error) setTasks((tRes.data ?? []) as Plan24TaskRow[])
    }
  }, [cellId, scopeStatus, planDate, shiftKind, user?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const first = activeRoles[0]?.name ?? ''
    if (!taskRoleName && first) setTaskRoleName(first)
    else if (taskRoleName && !activeRoles.some((r) => r.name === taskRoleName) && first) setTaskRoleName(first)
  }, [activeRoles, taskRoleName])

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

  const onBackgroundClick = useCallback(
    (roleName: string, startAt: Date) => {
      setAdhocRole(roleName)
      setAdhocStart(startAt)
      setAdhocTitle('Check')
      setAdhocEndMin('30')
      setAdhocOpen(true)
    },
    [],
  )

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
  }, [cellId, rosterId, planDate, shiftKind, adhocStart, adhocRole, adhocTitle, adhocEndMin, user?.id, refresh])

  const onEventMove = useCallback(
    async (eventId: string, startAt: Date, endAt: Date, roleName: string) => {
      const { error } = await supabase
        .from('plan24_events')
        .update({
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          role_name: roleName,
        })
        .eq('id', eventId)
      if (error) setLoadErr(error.message)
      else void refresh()
    },
    [refresh],
  )

  const onRoleHeaderClick = useCallback((roleName: string) => {
    setRolePickName(roleName)
    const row = activeRoles.find((r) => r.name === roleName)
    const pid = assignmentByRole.get(roleName) ?? (row ? shiftDefaultPersonId(row, shiftKind) : null) ?? ''
    setRolePickPersonId(pid || '')
    setRolePickOpen(true)
  }, [activeRoles, assignmentByRole, shiftKind])

  const onDropUnassigned = useCallback(
    async (eventId: string, roleName: string, startAt: Date) => {
      const ev = events.find((e) => e.id === eventId)
      if (!ev) return
      const dur = minutesBetween(new Date(ev.start_at), new Date(ev.end_at))
      const endAt = addMinutes(startAt, Math.max(5, dur))
      const { error } = await supabase
        .from('plan24_events')
        .update({ role_name: roleName, start_at: startAt.toISOString(), end_at: endAt.toISOString() })
        .eq('id', eventId)
      if (error) setLoadErr(error.message)
      else void refresh()
    },
    [events, refresh],
  )

  const openDetail = useCallback((ev: Plan24EventRow) => {
    setDetailEv(ev)
    setDetailSubs(parseSubTasks(ev.sub_tasks))
    setDetailOverride(false)
  }, [])

  const saveDetail = useCallback(async () => {
    if (!detailEv) return
    let status = detailEv.status
    let opened_at = detailEv.opened_at
    if (status === 'scheduled') {
      status = 'in_progress'
      opened_at = new Date().toISOString()
    }
    const { error } = await supabase
      .from('plan24_events')
      .update({
        title: detailEv.title,
        sub_tasks: detailSubs,
        status,
        opened_at,
      })
      .eq('id', detailEv.id)
    if (error) setLoadErr(error.message)
    else {
      setDetailEv(null)
      void refresh()
    }
  }, [detailEv, detailSubs, refresh])

  const markComplete = useCallback(async () => {
    if (!detailEv || !user?.id) return
    const subsOk = detailSubs.length === 0 || detailSubs.every((s) => s.done)
    if (!subsOk && !(isAdmin && detailOverride)) {
      setLoadErr('Complete all sub-tasks, or use admin override.')
      return
    }
    setLoadErr(null)
    const { error } = await supabase
      .from('plan24_events')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        opened_at: detailEv.opened_at ?? new Date().toISOString(),
        sub_tasks: detailSubs,
      })
      .eq('id', detailEv.id)
    if (error) setLoadErr(error.message)
    else {
      setDetailEv(null)
      void refresh()
    }
  }, [detailEv, detailSubs, detailOverride, isAdmin, user?.id, refresh])

  const confirmDelete = useCallback(async () => {
    if (!deleteEv || !user?.id || !deleteComment.trim()) return
    setBusy(true)
    const { error } = await supabase
      .from('plan24_events')
      .update({
        deleted_at: new Date().toISOString(),
        delete_comment: deleteComment.trim(),
        deleted_by: user.id,
      })
      .eq('id', deleteEv.id)
    setBusy(false)
    if (error) setLoadErr(error.message)
    else {
      setDeleteEv(null)
      setDeleteComment('')
      setDetailEv(null)
      void refresh()
    }
  }, [deleteEv, deleteComment, user?.id, refresh])

  const addTask = useCallback(async () => {
    if (!cellId || !user?.id || !taskRoleName || !newTaskTitle.trim()) return
    const nextSort = tasks.filter((t) => t.role_name === taskRoleName).length
    const { error } = await supabase.from('plan24_tasks').insert({
      master_cell_id: cellId,
      role_name: taskRoleName,
      owner_id: user.id,
      title: newTaskTitle.trim(),
      sort_order: nextSort,
    })
    if (error) setLoadErr(error.message)
    else {
      setNewTaskTitle('')
      void refresh()
    }
  }, [cellId, user?.id, taskRoleName, newTaskTitle, tasks, refresh])

  const toggleTask = useCallback(
    async (t: Plan24TaskRow) => {
      const { error } = await supabase.from('plan24_tasks').update({ done: !t.done }).eq('id', t.id)
      if (error) setLoadErr(error.message)
      else void refresh()
    },
    [refresh],
  )

  const shiftLabel = useMemo(() => {
    const a = windowBounds.start
    const b = windowBounds.end
    if (shiftKind === 'night') {
      return `Night · ${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${formatClock(a)} → ${b.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${formatClock(b)}`
    }
    return `Day · ${a.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
  }, [shiftKind, windowBounds])

  if (scopeStatus !== 'ready') {
    return <div className="text-sm text-muted">Loading scope…</div>
  }

  if (!cellId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Select a <strong className="font-medium">cell</strong> in the scope bar above to open Plan 24.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="shrink-0 space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Plan 24</h1>
        <p className="max-w-3xl text-sm text-muted">{shiftLabel}</p>
        <p className="max-w-3xl text-xs text-muted">
          Time grid shows <strong className="font-medium text-fg/80">hourly</strong> lines; you can still place checks at any minute. Drag checks to move time or to another role; click a person name under a role to set who is on that role for this day and shift.
        </p>
      </header>

      {loadErr ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {loadErr}
        </div>
      ) : null}

      {!roster ? (
        <div className="rounded-2xl border border-border bg-surface-raised/50 px-4 py-3 text-sm text-muted">
          No active Plan 24 roster for this cell yet. An admin can add one under{' '}
          <strong className="font-medium text-fg">RTT systems → Admin</strong>.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-1 py-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg"
            aria-label="Previous day"
            onClick={() => {
              const d = new Date(planDate + 'T12:00:00')
              d.setDate(d.getDate() - 1)
              setPlanDate(localYMD(d))
            }}
          >
            <ChevronLeft className="size-4" />
          </button>
          <input
            type="date"
            className="rounded-lg border-0 bg-transparent px-2 py-1 text-sm font-medium text-fg outline-none"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg"
            aria-label="Next day"
            onClick={() => {
              const d = new Date(planDate + 'T12:00:00')
              d.setDate(d.getDate() + 1)
              setPlanDate(localYMD(d))
            }}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Shift">
          {(['day', 'night'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                shiftKind === k ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
              }`}
              onClick={() => setShiftKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-fg shadow-sm hover:bg-surface-raised/80 lg:hidden"
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          Unassigned
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 gap-2 pb-28">
        {roster ? (
          <Plan24Grid
            windowStart={windowBounds.start}
            windowEnd={windowBounds.end}
            roles={roleCols}
            events={assignedEvents}
            pixelsPerMinute={pixelsPerMinute}
            onBackgroundClick={onBackgroundClick}
            onEventClick={openDetail}
            onEventMove={onEventMove}
            onDropUnassigned={onDropUnassigned}
            onRoleHeaderClick={onRoleHeaderClick}
          />
        ) : (
          <div className="min-h-[12rem] flex-1 rounded-2xl border border-dashed border-border bg-surface-raised/30" />
        )}

        <aside
          className={`min-h-0 flex-col rounded-2xl border border-border-strong bg-surface shadow-sm transition-[width,opacity] ${
            panelOpen ? 'flex w-72 shrink-0' : 'hidden w-0 overflow-hidden lg:flex lg:w-0 lg:shrink-0 lg:border-transparent lg:opacity-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg/70">Unassigned</span>
            <button
              type="button"
              className="hidden rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg lg:inline-flex"
              aria-label="Toggle unassigned panel"
              onClick={() => setPanelOpen((o) => !o)}
            >
              {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {unassignedEvents.length === 0 ? (
              <p className="px-1 text-xs text-muted">No unassigned checks.</p>
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
                    {formatClock(new Date(ev.start_at))}–{formatClock(new Date(ev.end_at))}
                    {ev.source === 'ad_hoc' ? ' · Ad hoc' : ''}
                  </div>
                  <p className="mt-1 text-[10px] text-sky-200/90">Drag onto a role column to assign.</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Bottom task bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.08)] transition-[max-height] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35) ${
          taskBarOpen ? 'max-h-[40vh]' : 'max-h-11'
        }`}
      >
        <button
          type="button"
          className="flex h-11 w-full items-center justify-between px-4 text-left text-xs font-semibold uppercase tracking-wide text-fg/80"
          onClick={() => setTaskBarOpen((o) => !o)}
        >
          Tasks
          <span className="text-[10px] font-normal text-muted">{taskBarOpen ? 'Hide' : 'Show'}</span>
        </button>
        {taskBarOpen ? (
          <div className="border-t border-border px-4 pb-3">
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted">
                Role
                <select
                  className={`${inputClass} mt-0.5 min-w-[8rem]`}
                  value={taskRoleName}
                  onChange={(e) => setTaskRoleName(e.target.value)}
                >
                  {activeRoles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[12rem] flex-1 text-xs text-muted">
                New task
                <input
                  className={`${inputClass} mt-0.5`}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Describe the task"
                />
              </label>
              <button
                type="button"
                className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
                onClick={() => void addTask()}
              >
                <Plus className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
                Add
              </button>
            </div>
            <ul className="mt-3 max-h-[22vh] space-y-1 overflow-y-auto text-sm">
              {tasks
                .filter((t) => t.role_name === taskRoleName)
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={t.done}
                      onChange={() => void toggleTask(t)}
                    />
                    <span className={t.done ? 'text-muted line-through' : ''}>{t.title}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>

      {adhocOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan24-adhoc-title"
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void saveAdhoc()
              }}
            >
              <h2 id="plan24-adhoc-title" className="font-display text-lg font-semibold">
                Ad hoc check
              </h2>
              <p className="text-xs text-muted">
                Role <strong className="text-fg">{adhocRole}</strong> · starts {adhocStart ? formatClock(adhocStart) : '—'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
          >
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Check</h2>
            <label className="block text-xs font-medium text-muted">
              Title
              <input
                className={`${inputClass} mt-1`}
                value={detailEv.title}
                onChange={(e) => setDetailEv({ ...detailEv, title: e.target.value })}
              />
            </label>
            <div className="text-xs text-muted">
              {detailEv.role_name ? `Role: ${detailEv.role_name}` : 'Unassigned'} · {detailEv.source === 'ad_hoc' ? 'Ad hoc' : 'Scheduled'}
            </div>
            <div className="space-y-2">
              <span className="text-xs font-semibold text-fg/80">Sub-tasks</span>
              {detailSubs.map((s, idx) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={() => {
                      const next = [...detailSubs]
                      next[idx] = { ...s, done: !s.done }
                      setDetailSubs(next)
                    }}
                  />
                  <input
                    className={`${inputClass} flex-1 py-1.5`}
                    value={s.label}
                    onChange={(e) => {
                      const next = [...detailSubs]
                      next[idx] = { ...s, label: e.target.value }
                      setDetailSubs(next)
                    }}
                  />
                </label>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() =>
                  setDetailSubs((prev) => [...prev, { id: crypto.randomUUID(), label: 'New step', done: false }])
                }
              >
                + Add sub-task
              </button>
            </div>
            {isAdmin ? (
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={detailOverride} onChange={(e) => setDetailOverride(e.target.checked)} />
                Admin: complete without all sub-tasks
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm" onClick={() => void saveDetail()}>
                Save
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600"
                onClick={() => void markComplete()}
              >
                Mark complete
              </button>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
                onClick={() => {
                  setDeleteEv(detailEv)
                  setDeleteComment('')
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove…
              </button>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {deleteEv ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
          >
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Remove from plan</h2>
            <p className="text-xs text-muted">Soft delete with a required comment (audit).</p>
            <textarea
              className={`${inputClass} min-h-[5rem]`}
              value={deleteComment}
              onChange={(e) => setDeleteComment(e.target.value)}
              placeholder="Why is this being removed?"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]" onClick={() => setDeleteEv(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !deleteComment.trim()}
                className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void confirmDelete()}
              >
                Confirm remove
              </button>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {rolePickOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
          >
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Person on {rolePickName}</h2>
            <p className="text-xs text-muted">Applies to this day and shift only.</p>
            <select
              className={inputClass}
              value={rolePickPersonId}
              onChange={(e) => setRolePickPersonId(e.target.value)}
            >
              <option value="">— None —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                </option>
              ))}
            </select>
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

function formatClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
