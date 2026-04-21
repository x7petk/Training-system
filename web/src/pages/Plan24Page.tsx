import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  ClipboardList,
  GripHorizontal,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localYMD } from '../lib/dueDateUtils'
import { useAuth } from '../hooks/useAuth'
import { Plan24Grid, PLAN24_DRAG_MIME } from '../features/plan24/Plan24Grid'
import { patternDayIndex, shiftWindowBounds, type ShiftRow } from '../features/plan24/plan24ShiftUtils'
import type {
  Plan24EventRow,
  Plan24PatternSlotRow,
  Plan24RoleTeamDefaultRow,
  Plan24RosterRoleRow,
  Plan24RosterRow,
  Plan24RoleAssignmentRow,
  Plan24ShiftKind,
  Plan24SubTask,
  Plan24TaskRow,
  Plan24TeamRow,
} from '../features/plan24/plan24Types'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { addMinutes, minutesBetween } from '../features/plan24/plan24ShiftUtils'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

/** Check detail modal: same border/focus colour as idle (no accent shift while editing). */
const detailInputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none focus:border-border focus:ring-1 focus:ring-fg/10 dark:focus:ring-white/10'

/** Save in check detail: neutral pressed/focus states (no accent / teal flash on click). */
const detailSaveButtonClass =
  'rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-fg outline-none [-webkit-tap-highlight-color:transparent] transition-colors hover:bg-black/[0.05] active:border-border active:bg-black/[0.08] active:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60 focus-visible:ring-offset-0 dark:hover:bg-white/[0.05] dark:active:bg-white/[0.1]'

function personLabel(p: {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return a || p.display_name || p.id.slice(0, 8)
}

/** Legacy defaults when no team / pattern row applies. */
function legacyDefaultPersonId(r: Plan24RosterRoleRow, sk: string): string | null {
  if (sk === 'day') return r.default_person_day_id ?? r.default_person_id ?? null
  if (sk === 'night') return r.default_person_night_id ?? r.default_person_id ?? null
  return r.default_person_id ?? null
}

const PLAN24_TASKS_PANEL_H_KEY = 'rtt-systems.plan24.tasksPanelHeight.v1'
const TASK_PANEL_MIN_PX = 140
const TASK_PANEL_DEFAULT_PX = 260
const TASK_PANEL_MAX_PX = 640
const PLAN24_VISIBLE_DAYS_AHEAD = 90

function clampTaskPanelHeight(px: number, viewportH: number): number {
  const cap = Math.floor(Math.min(TASK_PANEL_MAX_PX, viewportH * 0.68))
  return Math.min(cap, Math.max(TASK_PANEL_MIN_PX, Math.round(px)))
}

function readStoredTaskPanelHeight(): number {
  if (typeof window === 'undefined') return TASK_PANEL_DEFAULT_PX
  try {
    const n = Number(localStorage.getItem(PLAN24_TASKS_PANEL_H_KEY))
    if (Number.isFinite(n)) return clampTaskPanelHeight(n, window.innerHeight)
  } catch {
    /* ignore */
  }
  return TASK_PANEL_DEFAULT_PX
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
  const [panelOpen, setPanelOpen] = useState(false)
  const [taskBarOpen, setTaskBarOpen] = useState(false)
  const [taskRoleName, setTaskRoleName] = useState<string>('')

  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [roster, setRoster] = useState<Plan24RosterRow | null>(null)
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [roles, setRoles] = useState<Plan24RosterRoleRow[]>([])
  const [events, setEvents] = useState<Plan24EventRow[]>([])
  const [assignments, setAssignments] = useState<Plan24RoleAssignmentRow[]>([])
  const [patternSlots, setPatternSlots] = useState<Plan24PatternSlotRow[]>([])
  const [roleTeamDefaults, setRoleTeamDefaults] = useState<Plan24RoleTeamDefaultRow[]>([])
  const [teams, setTeams] = useState<Plan24TeamRow[]>([])
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
  const [detailDurationMin, setDetailDurationMin] = useState('30')

  const [deleteEv, setDeleteEv] = useState<Plan24EventRow | null>(null)
  const [deleteComment, setDeleteComment] = useState('')

  const [rolePickOpen, setRolePickOpen] = useState(false)
  const [rolePickName, setRolePickName] = useState('')
  const [rolePickPersonId, setRolePickPersonId] = useState<string>('')
  const [rolePickQuery, setRolePickQuery] = useState('')

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const todayYmd = localYMD(new Date())
  const maxVisibleYmd = useMemo(() => {
    const d = new Date(todayYmd + 'T12:00:00')
    d.setDate(d.getDate() + (PLAN24_VISIBLE_DAYS_AHEAD - 1))
    return localYMD(d)
  }, [todayYmd])
  const clampPlanDate = useCallback(
    (raw: string) => {
      if (!raw) return todayYmd
      if (raw < todayYmd) return todayYmd
      if (raw > maxVisibleYmd) return maxVisibleYmd
      return raw
    },
    [todayYmd, maxVisibleYmd],
  )

  const [taskPanelHeight, setTaskPanelHeight] = useState(readStoredTaskPanelHeight)
  const taskPanelHeightRef = useRef(taskPanelHeight)
  taskPanelHeightRef.current = taskPanelHeight
  const [taskResizing, setTaskResizing] = useState(false)

  useEffect(() => {
    function onResize() {
      setTaskPanelHeight((h) => clampTaskPanelHeight(h, window.innerHeight))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setPlanDate((prev) => clampPlanDate(prev))
  }, [clampPlanDate])

  const beginTaskResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!taskBarOpen) return
      e.preventDefault()
      e.stopPropagation()
      const handle = e.currentTarget
      const pid = e.pointerId
      const startY = e.clientY
      const startH = taskPanelHeightRef.current
      setTaskResizing(true)
      let lastH = startH

      const cap = () => clampTaskPanelHeight(9999, window.innerHeight)

      const move = (pe: PointerEvent) => {
        if (pe.pointerId !== pid) return
        lastH = Math.min(cap(), Math.max(TASK_PANEL_MIN_PX, Math.round(startH + (startY - pe.clientY))))
        setTaskPanelHeight(lastH)
      }
      const stop = (pe: PointerEvent) => {
        if (pe.pointerId !== pid) return
        document.removeEventListener('pointermove', move, true)
        document.removeEventListener('pointerup', stop, true)
        document.removeEventListener('pointercancel', stop, true)
        try {
          handle.releasePointerCapture(pid)
        } catch {
          /* ignore */
        }
        setTaskResizing(false)
        try {
          localStorage.setItem(PLAN24_TASKS_PANEL_H_KEY, String(lastH))
        } catch {
          /* ignore */
        }
      }

      handle.setPointerCapture(pid)
      document.addEventListener('pointermove', move, true)
      document.addEventListener('pointerup', stop, true)
      document.addEventListener('pointercancel', stop, true)
    },
    [taskBarOpen],
  )

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

  const patternDay = useMemo(() => {
    const plen = roster?.pattern_length != null ? roster.pattern_length : 8
    return patternDayIndex(planDate, roster?.pattern_start_date ?? null, plen)
  }, [planDate, roster?.pattern_start_date, roster?.pattern_length])

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

  const assignedEvents = useMemo(() => events.filter((e) => e.role_name && !e.deleted_at), [events])
  const unassignedEvents = useMemo(() => events.filter((e) => !e.role_name && !e.deleted_at), [events])

  const refresh = useCallback(async () => {
    if (!cellId || scopeStatus !== 'ready') return
    setLoadErr(null)
    setLoading(true)
    const materializeRes = await supabase.rpc('plan24_materialize_check_schedules', {
      p_master_cell_id: cellId,
      p_from_date: planDate,
      p_to_date: planDate,
    })
    if (materializeRes.error) {
      setLoadErr(materializeRes.error.message)
    }
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
      setTeams([])
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
    else setTeams((teamRes.data ?? []) as Plan24TeamRow[])

    const roleRows = (roleRes.data ?? []) as Plan24RosterRoleRow[]
    const roleIds = roleRows.map((x) => x.id)
    if (roleIds.length > 0) {
      const rtdRes = await supabase.from('plan24_role_team_defaults').select('*').in('role_id', roleIds)
      if (rtdRes.error) setLoadErr(rtdRes.error.message)
      else setRoleTeamDefaults((rtdRes.data ?? []) as Plan24RoleTeamDefaultRow[])
    } else {
      setRoleTeamDefaults([])
    }

    if (user?.id) {
      const tRes = await supabase
        .from('plan24_tasks')
        .select('id, master_cell_id, role_name, owner_id, title, done, sort_order')
        .eq('master_cell_id', cellId)
        .eq('owner_id', user.id)
        .order('sort_order')
      if (!tRes.error) setTasks((tRes.data ?? []) as Plan24TaskRow[])
    }
    setLoading(false)
  }, [cellId, scopeStatus, planDate, shiftKind, user?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const shiftTabs = useMemo(() => [...shifts], [shifts])

  useEffect(() => {
    if (shiftTabs.length === 0) return
    if (!shiftTabs.some((s) => s.kind === shiftKind)) setShiftKind(shiftTabs[0].kind)
  }, [shiftTabs, shiftKind])

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
  }, [cellId, rosterId, planDate, shiftKind, adhocStart, adhocRole, adhocTitle, adhocEndMin, user?.id, refresh])

  const onEventMove = useCallback(
    async (eventId: string, startAt: Date, endAt: Date, roleName: string) => {
      const { error } = await supabase
        .from('plan24_events')
        .update({
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          role_name: roleName,
          schedule_role_name: roleName || '',
        })
        .eq('id', eventId)
      if (error) setLoadErr(error.message)
      else void refresh()
    },
    [refresh],
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
      const { error } = await supabase
        .from('plan24_events')
        .update({
          role_name: roleName,
          schedule_role_name: roleName || '',
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
        })
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
    const dur = Math.max(5, Math.round(minutesBetween(new Date(ev.start_at), new Date(ev.end_at))))
    setDetailDurationMin(String(dur))
  }, [])

  const saveDetail = useCallback(async () => {
    if (!detailEv) return
    let status = detailEv.status
    let opened_at = detailEv.opened_at
    if (status === 'scheduled') {
      status = 'in_progress'
      opened_at = new Date().toISOString()
    }
    const isCheck =
      !detailEv.event_type || String(detailEv.event_type).toLowerCase() === 'check'
    const startAt = new Date(detailEv.start_at)
    const durRaw = Math.max(5, Math.round(Number(detailDurationMin)) || 5)
    const maxDurInWindow = Math.max(5, Math.floor(minutesBetween(startAt, windowBounds.end)))
    const dur = isCheck ? Math.min(maxDurInWindow, durRaw) : durRaw
    const endAt = isCheck ? addMinutes(startAt, dur).toISOString() : detailEv.end_at
    const { error } = await supabase
      .from('plan24_events')
      .update({
        title: detailEv.title,
        sub_tasks: detailSubs,
        status,
        opened_at,
        end_at: endAt,
      })
      .eq('id', detailEv.id)
    if (error) setLoadErr(error.message)
    else {
      setDetailEv(null)
      void refresh()
    }
  }, [detailEv, detailSubs, detailDurationMin, refresh, windowBounds.end])

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

  const stepDay = useCallback(
    (delta: number) => {
      const d = new Date(planDate + 'T12:00:00')
      d.setDate(d.getDate() + delta)
      setPlanDate(clampPlanDate(localYMD(d)))
    },
    [planDate, clampPlanDate],
  )

  const gotoToday = useCallback(() => {
    setPlanDate(todayYmd)
  }, [todayYmd])

  const cycleShift = useCallback(
    (dir: 1 | -1) => {
      if (shifts.length === 0) return
      const i = shifts.findIndex((s) => s.kind === shiftKind)
      const next = shifts[(i + dir + shifts.length) % shifts.length]
      if (next) setShiftKind(next.kind)
    },
    [shifts, shiftKind],
  )

  useEffect(() => {
    const anyModalOpen = adhocOpen || detailEv !== null || deleteEv !== null || rolePickOpen
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') {
        if (deleteEv) setDeleteEv(null)
        else if (rolePickOpen) setRolePickOpen(false)
        else if (adhocOpen) setAdhocOpen(false)
        else if (detailEv) setDetailEv(null)
        else if (panelOpen) setPanelOpen(false)
        else if (taskBarOpen) setTaskBarOpen(false)
        return
      }
      if (anyModalOpen) return
      const t = e.target as HTMLElement | null
      const isTyping =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if (isTyping) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepDay(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepDay(1)
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        gotoToday()
      } else if (e.key === '[') {
        e.preventDefault()
        cycleShift(-1)
      } else if (e.key === ']') {
        e.preventDefault()
        cycleShift(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adhocOpen, detailEv, deleteEv, rolePickOpen, panelOpen, taskBarOpen, stepDay, gotoToday, cycleShift])

  const filteredPickPeople = useMemo(() => {
    const q = rolePickQuery.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => {
      const label = personLabel(p).toLowerCase()
      return label.includes(q)
    })
  }, [people, rolePickQuery])

  const progress = useMemo(() => {
    const total = assignedEvents.length
    const done = assignedEvents.filter((e) => e.status === 'complete').length
    const inProg = assignedEvents.filter((e) => e.status === 'in_progress').length
    return { total, done, inProg }
  }, [assignedEvents])

  const isToday = planDate === todayYmd
  const atMaxVisible = planDate >= maxVisibleYmd

  const shiftLabel = useMemo(() => {
    const a = windowBounds.start
    const b = windowBounds.end
    const meta = shifts.find((s) => s.kind === shiftKind)
    const name = (meta?.display_name?.trim() || meta?.kind || shiftKind).replace(/_/g, ' ')
    const crosses =
      b.getDate() !== a.getDate() ||
      b.getMonth() !== a.getMonth() ||
      b.getFullYear() !== a.getFullYear()
    const timeRange = `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${formatClock(a)} → ${b.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${formatClock(b)}`
    if (crosses) return `${name} · ${timeRange}`
    return `${name} · ${a.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatClock(a)}–${formatClock(b)}`
  }, [shiftKind, windowBounds, shifts])

  const activeTeam = useMemo(() => teams.find((t) => t.id === activeTeamId), [teams, activeTeamId])

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
    <div className="flex h-full min-h-0 flex-1 flex-col gap-1">
      <div className="flex min-h-0 min-w-0 shrink-0 items-center gap-2 overflow-x-auto border-b border-border/50 pb-2">
        <h1 className="shrink-0 font-display text-lg font-semibold tracking-tight md:text-xl">Plan 24</h1>
        {loading ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-3 animate-spin" aria-hidden /> Loading
          </span>
        ) : null}
        {roster && progress.total > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-fg/80">
            <CircleDot className="size-3 text-emerald-600" aria-hidden />
            {progress.done}/{progress.total}
            {progress.inProg > 0 ? ` · ${progress.inProg} prog` : ''}
          </span>
        ) : null}

        <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />

        <div className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-surface px-0.5 py-0.5">
          <button
            type="button"
            className="rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
            aria-label="Previous day"
            onClick={() => stepDay(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="max-w-[9.5rem] rounded-lg border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-fg outline-none sm:text-sm"
            value={planDate}
            min={todayYmd}
            max={maxVisibleYmd}
            onChange={(e) => setPlanDate(clampPlanDate(e.target.value))}
            aria-label="Plan date"
          />
          <button
            type="button"
            className="rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
            aria-label="Next day"
            onClick={() => stepDay(1)}
            disabled={atMaxVisible}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          type="button"
          className={`inline-flex shrink-0 items-center gap-1 rounded-xl border border-border bg-surface px-2 py-1 text-xs font-semibold shadow-sm hover:bg-surface-raised/80 ${
            isToday ? 'text-accent' : 'text-fg/80'
          }`}
          onClick={gotoToday}
          aria-label="Go to today"
          title="Today (T)"
          disabled={isToday}
        >
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Today</span>
        </button>
        <div
          className="inline-flex w-fit shrink-0 flex-nowrap items-center rounded-md border border-border bg-surface p-px"
          role="group"
          aria-label="Shift"
          title={shiftLabel}
        >
          {shiftTabs.length === 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] text-muted">No shifts</span>
          ) : (
            shiftTabs.map((s) => {
              const label = (s.display_name?.trim() || s.kind).replace(/_/g, ' ')
              const range = `${(s.start_local || '').slice(0, 5)}–${(s.end_local || '').slice(0, 5)}`
              const isActive = shiftKind === s.kind
              return (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${label}, ${range}`}
                  className={`inline-flex h-6 min-h-6 shrink-0 items-center whitespace-nowrap rounded-sm px-2 text-[10px] font-semibold capitalize leading-none transition-colors ${
                    isActive ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
                  }`}
                  onClick={() => setShiftKind(s.kind)}
                  title={`${label} · ${range}`}
                >
                  {label}
                </button>
              )
            })
          )}
        </div>
        {activeTeam ? (
          <span
            className="inline-flex w-max min-w-0 max-w-[calc(100vw-2rem)] shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1 text-left text-[11px] font-semibold leading-none text-fg/90 sm:max-w-[min(96rem,calc(100vw-2rem))]"
            title={`${activeTeam.name} - pattern day ${patternDay}`}
          >
            <span
              className="size-3 shrink-0 rounded-sm ring-1 ring-black/10 dark:ring-white/15"
              style={{ backgroundColor: activeTeam.color }}
              aria-hidden
            />
            <span className="flex min-w-0 items-baseline gap-x-1 overflow-hidden">
              <span className="min-w-0 truncate">{activeTeam.name}</span>
              <span className="shrink-0 whitespace-nowrap font-medium text-muted">
                {' '}
                - pattern day {patternDay}
              </span>
            </span>
          </span>
        ) : null}
        <span className="inline-flex shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] font-medium text-muted">
          Visible horizon: today to {maxVisibleYmd}
        </span>
        <button
          type="button"
          className={`ml-auto inline-flex shrink-0 items-center rounded-xl border border-border bg-surface py-1.5 text-xs font-semibold text-fg shadow-sm hover:bg-surface-raised/80 ${
            panelOpen ? 'gap-1 px-2 sm:px-2.5' : 'px-1.5 sm:px-2'
          }`}
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="plan24-unassigned-drawer"
          aria-label={panelOpen ? 'Close unassigned panel' : 'Open unassigned panel'}
          title={`${panelOpen ? 'Close' : 'Open'} unassigned · ${unassignedEvents.length}`}
        >
          {panelOpen ? <PanelRightClose className="size-4 shrink-0" aria-hidden /> : <PanelRightOpen className="size-4 shrink-0" aria-hidden />}
          {panelOpen ? (
            <span className="hidden sm:inline">Unassigned{unassignedEvents.length ? ` · ${unassignedEvents.length}` : ''}</span>
          ) : unassignedEvents.length ? (
            <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[10px] text-white sm:ml-1">{unassignedEvents.length}</span>
          ) : null}
        </button>
      </div>

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

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl pb-11">
          {roster && shifts.length > 0 && activeRoles.length > 0 ? (
            <Plan24Grid
              windowStart={windowBounds.start}
              windowEnd={windowBounds.end}
              roles={roleCols}
              events={assignedEvents}
              onBackgroundClick={onBackgroundClick}
              onEventClick={openDetail}
              onEventMove={onEventMove}
              onDropUnassigned={onDropUnassigned}
              onRoleHeaderClick={onRoleHeaderClick}
            />
          ) : roster ? (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-raised/30 p-6 text-center text-sm text-muted">
              <p className="text-fg/80">
                {shifts.length === 0 ? 'No shifts configured for this roster.' : 'No active roles yet.'}
              </p>
              <p className="max-w-md text-xs">
                Go to <strong className="font-medium text-fg">RTT systems → Admin → Plan 24</strong> to{' '}
                {shifts.length === 0 ? 'add shifts' : 'add roles'} for this roster.
              </p>
            </div>
          ) : (
            <div className="min-h-[12rem] flex-1 rounded-2xl border border-dashed border-border bg-surface-raised/30" />
          )}

          {panelOpen ? (
            <div
              role="presentation"
              className="absolute inset-0 z-10 rounded-2xl bg-black/25 transition-opacity duration-300"
              onClick={() => setPanelOpen(false)}
            />
          ) : null}

          <aside
            id="plan24-unassigned-drawer"
            className={`absolute inset-y-0 right-0 z-20 flex w-[min(18rem,calc(100vw-2rem))] max-w-full min-w-0 flex-col rounded-l-2xl border border-border-strong border-r-0 bg-surface shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
              panelOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
            }`}
            aria-hidden={!panelOpen}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg/70">Unassigned</span>
              <button
                type="button"
                className="inline-flex rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
                aria-label="Close unassigned panel"
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
                      {formatClock(new Date(ev.start_at))}–{formatClock(new Date(ev.end_at))}
                      {ev.source === 'ad_hoc' ? ' · Ad hoc' : ''}
                    </div>
                    <p className="mt-1 text-[10px] text-sky-200/90">Drag onto a role column to assign.</p>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Bottom sheet: anchored to grid bottom; flex-col-reverse keeps the bar at the viewport bottom and grows content upward over the grid. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15]">
            <div className="pointer-events-auto flex flex-col-reverse rounded-t-xl border border-border bg-surface shadow-[0_-8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between px-4 text-left text-xs font-semibold uppercase tracking-wide text-fg/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                onClick={() => setTaskBarOpen((o) => !o)}
                aria-expanded={taskBarOpen}
                aria-controls="plan24-tasks-panel"
              >
                <span className="inline-flex items-center gap-2">
                  <ClipboardList className="size-4 opacity-80" aria-hidden />
                  Tasks
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted">
                  {taskBarOpen ? 'Hide' : 'Show'}
                  <ChevronUp
                    className={`size-4 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${taskBarOpen ? '' : 'rotate-180'}`}
                    aria-hidden
                  />
                </span>
              </button>
              <div
                id="plan24-tasks-panel"
                className={`overflow-hidden border-t border-border motion-reduce:transition-none ${
                  taskResizing ? '' : 'transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
                }`}
                style={{ height: taskBarOpen ? taskPanelHeight : 0 }}
              >
                <div className="flex h-full min-h-0 flex-col">
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize tasks panel"
                    title="Drag to resize · double-click to reset height"
                    onPointerDown={beginTaskResize}
                    onDoubleClick={(ev) => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      const d = clampTaskPanelHeight(TASK_PANEL_DEFAULT_PX, window.innerHeight)
                      setTaskPanelHeight(d)
                      try {
                        localStorage.setItem(PLAN24_TASKS_PANEL_H_KEY, String(d))
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="flex shrink-0 cursor-row-resize touch-none select-none items-center justify-center border-b border-border py-1.5 hover:bg-accent-dim/20 active:bg-accent-dim/35"
                  >
                    <GripHorizontal className="size-5 text-muted" aria-hidden />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-2" role="region" aria-label="Tasks">
                    <div className="flex flex-wrap items-end gap-2">
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
                    <ul className="mt-3 space-y-1 text-sm">
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
                </div>
              </div>
            </div>
          </div>
        </div>
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
            aria-labelledby="plan24-check-detail-title"
          >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 id="plan24-check-detail-title" className="font-display text-lg font-semibold">
                Check
              </h2>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/10"
                aria-label="Close"
                onClick={() => setDetailEv(null)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <label className="block text-xs font-medium text-muted">
              Title
              <input
                className={`${detailInputClass} mt-1`}
                value={detailEv.title}
                onChange={(e) => setDetailEv({ ...detailEv, title: e.target.value })}
              />
            </label>
            {!detailEv.event_type || String(detailEv.event_type).toLowerCase() === 'check' ? (
              <label className="block text-xs font-medium text-muted">
                Duration (minutes)
                <input
                  type="number"
                  min={5}
                  step={1}
                  className={`${detailInputClass} mt-1`}
                  inputMode="numeric"
                  value={detailDurationMin}
                  onChange={(e) => setDetailDurationMin(e.target.value)}
                />
                <span className="mt-1 block text-[10px] text-muted/90">
                  Starts {formatClock(new Date(detailEv.start_at))} · end updates from duration
                </span>
              </label>
            ) : null}
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
                    className={`${detailInputClass} flex-1 py-1.5`}
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
              <button type="button" className={detailSaveButtonClass} onClick={() => void saveDetail()}>
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
            <ul
              className="max-h-64 overflow-y-auto rounded-xl border border-border"
              role="listbox"
              aria-label="People"
            >
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={rolePickPersonId === ''}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent-dim/50 ${
                    rolePickPersonId === '' ? 'bg-accent-dim text-accent' : 'text-muted'
                  }`}
                  onClick={() => setRolePickPersonId('')}
                >
                  <span>— None —</span>
                  {rolePickPersonId === '' ? <span className="text-[10px] font-semibold">selected</span> : null}
                </button>
              </li>
              {filteredPickPeople.map((p) => {
                const sel = rolePickPersonId === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={sel}
                      className={`flex w-full items-center justify-between border-t border-border px-3 py-2 text-left text-sm hover:bg-accent-dim/40 ${
                        sel ? 'bg-accent-dim text-accent' : 'text-fg'
                      }`}
                      onClick={() => setRolePickPersonId(p.id)}
                    >
                      <span>{personLabel(p)}</span>
                      {sel ? <span className="text-[10px] font-semibold">selected</span> : null}
                    </button>
                  </li>
                )
              })}
              {filteredPickPeople.length === 0 ? (
                <li className="border-t border-border px-3 py-3 text-xs text-muted">No people match.</li>
              ) : null}
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

function formatClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
