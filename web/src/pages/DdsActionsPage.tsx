import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, LayoutList, Loader2, Plus, Rows3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localYMD } from '../lib/dueDateUtils'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { DdsActionSurfacesField } from '../features/dds/DdsActionSurfacesField'
import { DdsActionTimelineBar } from '../features/dds/DdsActionTimelineBar'
import {
  DDS_ACTION_UI_SURFACE_KEYS,
  formatDdsActionSurfacesSummary,
  normalizeDdsActionSurfacesForSave,
  type DdsActionUiSurfaceKey,
} from '../features/dds/ddsActionSurfaces'
import {
  addMinutes,
  formatPlan24Clock,
  minutesBetween,
  shiftWindowBounds,
  type ShiftRow,
} from '../features/plan24/plan24ShiftUtils'
import type { Plan24EventRow, Plan24RosterRow } from '../features/plan24/plan24Types'
import { Plan24EventDetailModal } from '../features/plan24/Plan24EventDetailModal'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

import { MIN_PLAN_YMD, clampPlanDateYmd, plan24MaxVisibleYmd } from '../features/plan24/plan24DateBounds'

const ROW_H = 40

function personLabel(p: {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}): string {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return a || p.display_name || p.id.slice(0, 8)
}

function mondayOfWeekYmd(anchorYmd: string): string {
  const d = new Date(anchorYmd + 'T12:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return localYMD(d)
}

function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return localYMD(d)
}

/** `datetime-local` value in local time (minute resolution). */
function formatForDatetimeLocal(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da}T${h}:${mi}`
}

function parseDatetimeLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s.trim())
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0)
}

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

function statusSelectClass(status: string): string {
  if (status === 'complete') return 'border-emerald-600/50 bg-emerald-600/15 text-emerald-900 dark:text-emerald-100'
  if (status === 'not_required') return 'border-zinc-500/50 bg-zinc-400/20 text-fg'
  return 'border-orange-600/50 bg-orange-500/15 text-orange-950 dark:text-orange-100'
}

export function DdsActionsPage() {
  const navigate = useNavigate()
  const { cellId, status: scopeStatus } = usePlan24Workspace()
  const { user, isAdmin } = useAuth()

  const todayYmd = localYMD(new Date())
  const maxVisibleYmd = useMemo(() => plan24MaxVisibleYmd(todayYmd), [todayYmd])

  const clamp = useCallback(
    (raw: string) => clampPlanDateYmd(raw, maxVisibleYmd, todayYmd),
    [todayYmd, maxVisibleYmd],
  )

  const [view, setView] = useState<'day' | 'week' | 'custom'>('day')
  const [planDate, setPlanDate] = useState(() => clamp(todayYmd))
  const [shiftKind, setShiftKind] = useState<string>('day')
  const [weekAnchor, setWeekAnchor] = useState(() => clamp(todayYmd))
  const [customFrom, setCustomFrom] = useState(() => clamp(todayYmd))
  const [customTo, setCustomTo] = useState(() => clamp(todayYmd))

  const [roster, setRoster] = useState<Plan24RosterRow | null>(null)
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [events, setEvents] = useState<Plan24EventRow[]>([])
  const [people, setPeople] = useState<
    { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [detailEv, setDetailEv] = useState<Plan24EventRow | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createPlanDate, setCreatePlanDate] = useState(() => clamp(todayYmd))
  const [createShiftKind, setCreateShiftKind] = useState<string>('day')
  const [createOwnerPersonId, setCreateOwnerPersonId] = useState('')
  const [createStartLocal, setCreateStartLocal] = useState('')
  const [createTitle, setCreateTitle] = useState('DDS action')
  const [createComment, setCreateComment] = useState('')
  const [createEndMin, setCreateEndMin] = useState('30')
  const [createSurfaces, setCreateSurfaces] = useState<DdsActionUiSurfaceKey[]>(() => [...DDS_ACTION_UI_SURFACE_KEYS])

  const weekFrom = useMemo(() => mondayOfWeekYmd(weekAnchor), [weekAnchor])
  const weekTo = useMemo(() => addDaysYmd(weekFrom, 6), [weekFrom])

  const dateRange = useMemo(() => {
    if (view === 'day') return { from: planDate, to: planDate }
    if (view === 'week') return { from: weekFrom, to: weekTo }
    const a = customFrom <= customTo ? customFrom : customTo
    const b = customFrom <= customTo ? customTo : customFrom
    return { from: clamp(a), to: clamp(b) }
  }, [view, planDate, weekFrom, weekTo, customFrom, customTo, clamp])

  const windowBounds = useMemo(
    () => shiftWindowBounds(planDate, shiftKind, shifts),
    [planDate, shiftKind, shifts],
  )

  const detailBounds = useMemo(() => {
    if (!detailEv) return windowBounds
    return shiftWindowBounds(detailEv.plan_date, detailEv.shift_kind, shifts)
  }, [detailEv, shifts, windowBounds])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const sortedPeopleForCreate = useMemo(() => {
    const copy = [...people]
    copy.sort((a, b) => personLabel(a).localeCompare(personLabel(b), undefined, { sensitivity: 'base' }))
    return copy
  }, [people])

  const refresh = useCallback(async () => {
    if (!cellId || scopeStatus !== 'ready') return
    setLoadErr(null)
    setLoading(true)
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
      setEvents([])
      setPeople([])
      setLoading(false)
      return
    }
    const [shRes, peRes, evRes] = await Promise.all([
      supabase
        .from('plan24_roster_shifts')
        .select('kind, start_local, end_local, display_name')
        .eq('roster_id', r.id)
        .order('sort_order'),
      supabase.from('people').select('id, display_name, first_name, last_name').order('display_name').limit(500),
      supabase
        .from('plan24_events')
        .select('*')
        .eq('master_cell_id', cellId)
        .eq('event_type', 'dds_action')
        .gte('plan_date', dateRange.from)
        .lte('plan_date', dateRange.to)
        .is('deleted_at', null)
        .order('plan_date')
        .order('shift_kind')
        .order('start_at'),
    ])
    if (shRes.error) setLoadErr(shRes.error.message)
    else setShifts((shRes.data ?? []) as ShiftRow[])
    if (peRes.error) setLoadErr(peRes.error.message)
    else setPeople((peRes.data ?? []) as typeof people)
    if (evRes.error) setLoadErr(evRes.error.message)
    else setEvents((evRes.data ?? []) as Plan24EventRow[])
    setLoading(false)
  }, [cellId, scopeStatus, dateRange.from, dateRange.to])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!successMsg) return
    const t = window.setTimeout(() => setSuccessMsg(null), 2400)
    return () => window.clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (shifts.length === 0) return
    if (!shifts.some((s) => s.kind === shiftKind)) setShiftKind(shifts[0].kind)
  }, [shifts, shiftKind])

  const dayEvents = useMemo(
    () => events.filter((e) => e.plan_date === planDate && e.shift_kind === shiftKind),
    [events, planDate, shiftKind],
  )

  const sortedDayEvents = useMemo(() => {
    const copy = [...dayEvents]
    copy.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    return copy
  }, [dayEvents])

  const listEvents = useMemo(() => {
    const copy = [...events]
    copy.sort(
      (a, b) =>
        a.plan_date.localeCompare(b.plan_date) ||
        String(a.shift_kind).localeCompare(String(b.shift_kind)) ||
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )
    return copy
  }, [events])

  const totalMin = useMemo(
    () => Math.max(15, minutesBetween(windowBounds.start, windowBounds.end)),
    [windowBounds],
  )

  const createWindowBounds = useMemo(
    () => shiftWindowBounds(createPlanDate, createShiftKind, shifts),
    [createPlanDate, createShiftKind, shifts],
  )

  const createStartInputMax = useMemo(
    () => formatForDatetimeLocal(addMinutes(createWindowBounds.end, -1)),
    [createWindowBounds],
  )

  useEffect(() => {
    if (!createOpen || shifts.length === 0) return
    if (!shifts.some((s) => s.kind === createShiftKind)) setCreateShiftKind(shifts[0].kind)
  }, [createOpen, shifts, createShiftKind])

  useEffect(() => {
    if (!createOpen || shifts.length === 0) return
    const bounds = shiftWindowBounds(createPlanDate, createShiftKind, shifts)
    setCreateStartLocal((prev) => {
      const parsed = parseDatetimeLocal(prev)
      if (!parsed || parsed.getTime() < bounds.start.getTime() || parsed.getTime() >= bounds.end.getTime()) {
        return formatForDatetimeLocal(bounds.start)
      }
      return prev
    })
  }, [createOpen, createPlanDate, createShiftKind, shifts])

  const openCreate = useCallback(() => {
    if (!roster || !user) return
    const planD = clamp(view === 'day' ? planDate : todayYmd)
    const sk =
      shifts.length === 0
        ? shiftKind
        : shifts.some((s) => s.kind === shiftKind)
          ? shiftKind
          : shifts[0].kind
    setCreatePlanDate(planD)
    setCreateShiftKind(sk)
    const bounds = shiftWindowBounds(planD, sk, shifts)
    setCreateStartLocal(formatForDatetimeLocal(bounds.start))
    setCreateOwnerPersonId('')
    setCreateTitle('DDS action')
    setCreateComment('')
    setCreateEndMin('30')
    setCreateSurfaces([...DDS_ACTION_UI_SURFACE_KEYS])
    setCreateOpen(true)
  }, [roster, user, view, planDate, shiftKind, todayYmd, clamp, shifts])

  const saveCreate = useCallback(async () => {
    if (!cellId || !roster || !user?.id) return
    const pid = createOwnerPersonId.trim()
    if (!pid) {
      setLoadErr('Select an owner for this DDS action.')
      return
    }
    const dur = Math.max(5, Math.round(Number(createEndMin)) || 30)
    const bounds = shiftWindowBounds(createPlanDate, createShiftKind, shifts)
    const startAt = parseDatetimeLocal(createStartLocal)
    if (!startAt) {
      setLoadErr('Enter a valid start date and time.')
      return
    }
    if (startAt.getTime() < bounds.start.getTime() || startAt.getTime() >= bounds.end.getTime()) {
      setLoadErr('Start time must fall within the shift window for the selected date and shift.')
      return
    }
    let endAt = addMinutes(startAt, dur)
    if (endAt > bounds.end) endAt = bounds.end
    if (endAt.getTime() <= startAt.getTime()) {
      setLoadErr('Duration is too long for the time remaining in this shift.')
      return
    }
    const surf = normalizeDdsActionSurfacesForSave(createSurfaces)
    if (surf.length === 0) {
      setLoadErr('Select at least one DDS page (Line, Plant, or Site).')
      return
    }
    setCreateBusy(true)
    const { error } = await supabase.from('plan24_events').insert({
      master_cell_id: cellId,
      roster_id: roster.id,
      plan_date: createPlanDate,
      shift_kind: createShiftKind,
      role_name: null,
      schedule_role_name: '',
      title: createTitle.trim() || 'DDS action',
      event_type: 'dds_action',
      source: 'ad_hoc',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'in_progress',
      sub_tasks: [],
      assigned_person_id: pid,
      comment: createComment.trim() || null,
      dds_display_surfaces: surf,
      created_by: user.id,
    })
    setCreateBusy(false)
    if (error) setLoadErr(error.message)
    else {
      setCreateOpen(false)
      setSuccessMsg('DDS action created.')
      void refresh()
    }
  }, [
    cellId,
    roster,
    user,
    createOwnerPersonId,
    createPlanDate,
    createShiftKind,
    shifts,
    createStartLocal,
    createEndMin,
    createTitle,
    createComment,
    createSurfaces,
    refresh,
  ])

  const handleTimesChange = useCallback(
    async (eventId: string, startAt: Date, endAt: Date) => {
      const { error } = await supabase
        .from('plan24_events')
        .update({ start_at: startAt.toISOString(), end_at: endAt.toISOString() })
        .eq('id', eventId)
      if (error) setLoadErr(error.message)
      else void refresh()
    },
    [refresh],
  )

  async function updateStatus(id: string, status: Plan24EventRow['status']) {
    const patch: Record<string, unknown> = { status }
    if (status === 'complete' && user?.id) {
      patch.completed_at = new Date().toISOString()
      patch.completed_by = user.id
      patch.opened_at = new Date().toISOString()
    } else {
      patch.completed_at = null
      patch.completed_by = null
    }
    const { error } = await supabase.from('plan24_events').update(patch).eq('id', id)
    if (error) setLoadErr(error.message)
    else void refresh()
  }

  const stepDay = (delta: number) => {
    const d = new Date(planDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setPlanDate(clamp(localYMD(d)))
  }

  if (scopeStatus !== 'ready') {
    return <div className="text-sm text-muted">Loading scope…</div>
  }

  if (!cellId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Select a <strong className="font-medium">cell</strong> in the scope bar above.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
        <h1 className="font-display text-lg font-semibold tracking-tight md:text-xl">DDS actions</h1>
        <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
        <div className="inline-flex rounded-lg border border-border bg-surface p-px" role="group" aria-label="View">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-semibold ${view === 'day' ? 'bg-accent-dim text-accent' : 'text-muted'}`}
            onClick={() => setView('day')}
          >
            <span className="inline-flex items-center gap-1">
              <Rows3 className="size-3.5" aria-hidden />
              Day
            </span>
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-semibold ${view === 'week' ? 'bg-accent-dim text-accent' : 'text-muted'}`}
            onClick={() => setView('week')}
          >
            <span className="inline-flex items-center gap-1">
              <LayoutList className="size-3.5" aria-hidden />
              Week
            </span>
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-semibold ${view === 'custom' ? 'bg-accent-dim text-accent' : 'text-muted'}`}
            onClick={() => setView('custom')}
          >
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="size-3.5" aria-hidden />
              Custom
            </span>
          </button>
        </div>

        {view === 'day' ? (
          <>
            <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface px-0.5 py-0.5">
              <button
                type="button"
                className="rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
                aria-label="Previous day"
                onClick={() => stepDay(-1)}
              >
                <ChevronLeft className="size-4" />
              </button>
              <input
                type="date"
                className="max-w-[9.5rem] rounded-lg border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-fg outline-none sm:text-sm"
                value={planDate}
                min={MIN_PLAN_YMD}
                max={maxVisibleYmd}
                onChange={(e) => setPlanDate(clamp(e.target.value))}
                aria-label="Plan date"
              />
              <button
                type="button"
                className="rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
                aria-label="Next day"
                onClick={() => stepDay(1)}
                disabled={planDate >= maxVisibleYmd}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div
              className="inline-flex w-fit shrink-0 flex-nowrap items-center rounded-md border border-border bg-surface p-px"
              role="group"
              aria-label="Shift"
            >
              {shifts.length === 0 ? (
                <span className="px-1.5 py-0.5 text-[10px] text-muted">No shifts</span>
              ) : (
                shifts.map((s) => {
                  const label = (s.display_name?.trim() || s.kind).replace(/_/g, ' ')
                  const isActive = shiftKind === s.kind
                  return (
                    <button
                      key={s.kind}
                      type="button"
                      aria-pressed={isActive}
                      className={`inline-flex h-6 shrink-0 items-center rounded-sm px-2 text-[10px] font-semibold capitalize leading-none ${
                        isActive ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg'
                      }`}
                      onClick={() => setShiftKind(s.kind)}
                    >
                      {label}
                    </button>
                  )
                })
              )}
            </div>
          </>
        ) : null}

        {view === 'week' ? (
          <div className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface px-0.5 py-0.5">
            <button
              type="button"
              className="rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
              aria-label="Previous week"
              onClick={() => {
                const d = new Date(weekAnchor + 'T12:00:00')
                d.setDate(d.getDate() - 7)
                setWeekAnchor(clamp(localYMD(d)))
              }}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-xs font-medium text-fg/90">
              {weekFrom} → {weekTo}
            </span>
            <button
              type="button"
              className="rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg"
              aria-label="Next week"
              onClick={() => {
                const d = new Date(weekAnchor + 'T12:00:00')
                d.setDate(d.getDate() + 7)
                setWeekAnchor(clamp(localYMD(d)))
              }}
              disabled={weekFrom >= maxVisibleYmd}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}

        {view === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1 font-medium text-muted">
              From
              <input
                type="date"
                className="rounded-lg border border-border bg-surface px-2 py-1 text-fg"
                value={customFrom}
                min={MIN_PLAN_YMD}
                max={maxVisibleYmd}
                onChange={(e) => setCustomFrom(clamp(e.target.value))}
              />
            </label>
            <label className="inline-flex items-center gap-1 font-medium text-muted">
              To
              <input
                type="date"
                className="rounded-lg border border-border bg-surface px-2 py-1 text-fg"
                value={customTo}
                min={MIN_PLAN_YMD}
                max={maxVisibleYmd}
                onChange={(e) => setCustomTo(clamp(e.target.value))}
              />
            </label>
          </div>
        ) : null}

        {loading ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Loading
          </span>
        ) : null}
        <div className="min-w-0 flex-1" aria-hidden />
        {roster && user ? (
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-sm hover:bg-surface-raised/80"
          >
            <Plus className="size-3.5" aria-hidden />
            New DDS action
          </button>
        ) : null}
      </div>

      {loadErr ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {loadErr}
        </div>
      ) : null}
      {successMsg ? (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
          {successMsg}
        </div>
      ) : null}

      {!roster ? (
        <div className="rounded-xl border border-border bg-surface-raised/50 px-3 py-2 text-sm text-muted">
          No active Plan 24 roster for this cell.
        </div>
      ) : null}

      {view === 'day' && roster && shifts.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-surface p-3 shadow-sm">
          <p className="mb-2 text-[11px] text-muted">
            Shift window {formatPlan24Clock(windowBounds.start)}–{formatPlan24Clock(windowBounds.end)} · one row per
            action
          </p>
          <div className="space-y-1">
            {sortedDayEvents.length === 0 ? (
              <p className="text-sm text-muted">No DDS actions for this day and shift.</p>
            ) : (
              sortedDayEvents.map((ev) => {
                const owner = ev.assigned_person_id ? peopleById.get(ev.assigned_person_id) : undefined
                const ownerLab = owner ? personLabel(owner) : '—'
                return (
                  <div
                    key={ev.id}
                    className="flex items-stretch gap-2 rounded-xl border border-border bg-canvas/40 py-1 pl-2 pr-1"
                    style={{ minHeight: ROW_H }}
                  >
                    <div className="flex w-44 min-w-0 shrink-0 flex-col justify-center text-[11px] leading-tight">
                      <span className="truncate font-semibold text-fg">{ev.title}</span>
                      <span className="truncate text-muted">{ownerLab}</span>
                    </div>
                    <div className="relative min-h-[36px] min-w-0 flex-1 rounded-lg bg-surface-raised/30">
                      <div className="pointer-events-none absolute inset-0 rounded-lg bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(100%/24-1px),rgba(0,0,0,0.06)_calc(100%/24-1px),rgba(0,0,0,0.06)_calc(100%/24))]" />
                      <DdsActionTimelineBar
                        eventId={ev.id}
                        title={ev.title}
                        status={ev.status}
                        planDate={ev.plan_date}
                        shiftKind={ev.shift_kind}
                        startAt={ev.start_at}
                        endAt={ev.end_at}
                        windowStart={windowBounds.start}
                        totalMin={totalMin}
                        shifts={shifts}
                        minWidthPct={0.8}
                        barClassName="top-1 bottom-1 rounded-md text-[10px]"
                        onOpen={() => setDetailEv(ev)}
                        onTimesChange={(id, startAt, endAt) => void handleTimesChange(id, startAt, endAt)}
                      />
                    </div>
                    <div className="flex w-[7.5rem] shrink-0 flex-col justify-center gap-1">
                      <select
                        aria-label={`Status for ${ev.title}`}
                        className={`w-full rounded-lg border px-1 py-1 text-[10px] font-semibold outline-none ${statusSelectClass(ev.status)}`}
                        value={ev.status === 'scheduled' ? 'in_progress' : ev.status}
                        onChange={(e) => void updateStatus(ev.id, e.target.value as Plan24EventRow['status'])}
                      >
                        <option value="in_progress">In process</option>
                        <option value="complete">Complete</option>
                        <option value="not_required">Not required</option>
                      </select>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : null}

      {(view === 'week' || view === 'custom') && roster ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised/40 text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">DDS pages</th>
                  <th className="px-3 py-2">Comment</th>
                </tr>
              </thead>
              <tbody>
                {listEvents.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-sm text-muted">
                      No DDS actions in this range.
                    </td>
                  </tr>
                ) : (
                  listEvents.map((ev) => {
                    const owner = ev.assigned_person_id ? peopleById.get(ev.assigned_person_id) : undefined
                    const dur = Math.round(minutesBetween(new Date(ev.start_at), new Date(ev.end_at)))
                    return (
                      <tr key={ev.id} className="border-b border-border/70 hover:bg-surface-raised/30">
                        <td className="px-3 py-2">
                          <select
                            className={`max-w-[9rem] rounded-lg border px-2 py-1 text-xs font-medium outline-none ${statusSelectClass(ev.status)}`}
                            value={ev.status === 'scheduled' ? 'in_progress' : ev.status}
                            onChange={(e) => void updateStatus(ev.id, e.target.value as Plan24EventRow['status'])}
                          >
                            <option value="in_progress">In process</option>
                            <option value="complete">Complete</option>
                            <option value="not_required">Not required</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-xs">{ev.plan_date}</td>
                        <td className="px-3 py-2 text-xs">{ev.shift_kind}</td>
                        <td className="px-3 py-2 text-xs tabular-nums">{formatPlan24Clock(new Date(ev.start_at))}</td>
                        <td className="px-3 py-2 text-xs tabular-nums">{formatPlan24Clock(new Date(ev.end_at))}</td>
                        <td className="px-3 py-2 text-xs">{dur} min</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="max-w-[14rem] truncate text-left font-medium text-accent hover:underline"
                            onClick={() => setDetailEv(ev)}
                          >
                            {ev.title}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted">
                          {owner ? personLabel(owner) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs">{ev.role_name ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-muted">{formatDdsActionSurfacesSummary(ev)}</td>
                        <td className="max-w-xs truncate px-3 py-2 text-xs text-muted">{ev.comment ?? ''}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {createOpen && roster ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dds-create-title"
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void saveCreate()
              }}
            >
              <h2 id="dds-create-title" className="font-display text-lg font-semibold">
                New DDS action
              </h2>
              <p className="text-[11px] text-muted">
                Shift window {formatPlan24Clock(createWindowBounds.start)}–{formatPlan24Clock(createWindowBounds.end)}
              </p>
              <label className="block text-xs font-medium text-muted">
                Plan date
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={createPlanDate}
                  min={MIN_PLAN_YMD}
                  max={maxVisibleYmd}
                  onChange={(e) => setCreatePlanDate(clamp(e.target.value))}
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Shift
                <select
                  className={`${inputClass} mt-1`}
                  value={createShiftKind}
                  onChange={(e) => setCreateShiftKind(e.target.value)}
                >
                  {shifts.map((s) => (
                    <option key={s.kind} value={s.kind}>
                      {(s.display_name?.trim() || s.kind).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-muted">
                Owner
                <select
                  className={`${inputClass} mt-1`}
                  value={createOwnerPersonId}
                  onChange={(e) => setCreateOwnerPersonId(e.target.value)}
                  required
                >
                  <option value="">Select person…</option>
                  {sortedPeopleForCreate.map((p) => (
                    <option key={p.id} value={p.id}>
                      {personLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
              {sortedPeopleForCreate.length === 0 ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  No people are available to assign. Add people in the directory or widen access.
                </p>
              ) : null}
              <label className="block text-xs font-medium text-muted">
                Start (local)
                <input
                  type="datetime-local"
                  className={`${inputClass} mt-1 min-h-10`}
                  value={createStartLocal}
                  min={formatForDatetimeLocal(createWindowBounds.start)}
                  max={createStartInputMax}
                  onChange={(e) => setCreateStartLocal(e.target.value)}
                />
              </label>
              <p className="text-[11px] text-muted">
                Pick any start time within the shift window above (not only shift start).
              </p>
              <label className="block text-xs font-medium text-muted">
                Title
                <input className={`${inputClass} mt-1`} value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
              </label>
              <label className="block text-xs font-medium text-muted">
                Comment
                <textarea
                  className={`${inputClass} mt-1 min-h-[5rem] py-2`}
                  value={createComment}
                  onChange={(e) => setCreateComment(e.target.value)}
                  placeholder="Optional details"
                  rows={3}
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Duration (minutes)
                <input
                  className={`${inputClass} mt-1`}
                  type="number"
                  min={5}
                  step={5}
                  value={createEndMin}
                  onChange={(e) => setCreateEndMin(e.target.value)}
                />
              </label>
              <DdsActionSurfacesField
                idPrefix="dds-actions-create"
                selected={createSurfaces}
                onChange={setCreateSurfaces}
                disabled={createBusy}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-black/[0.06]"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createBusy ||
                    shifts.length === 0 ||
                    !createOwnerPersonId.trim() ||
                    !createStartLocal.trim() ||
                    normalizeDdsActionSurfacesForSave(createSurfaces).length === 0
                  }
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
          windowEnd={detailBounds.end}
          userId={user?.id}
          isAdmin={isAdmin}
          navigate={navigate}
          onClose={() => setDetailEv(null)}
          onSaved={() => {
            setDetailEv(null)
            void refresh()
          }}
          onLoadError={setLoadErr}
          onSuccessMsg={setSuccessMsg}
        />
      ) : null}
    </div>
  )
}
