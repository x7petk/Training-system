import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { localYMD } from '../../lib/dueDateUtils'
import { useAuth } from '../../hooks/useAuth'
import {
  addMinutes,
  formatPlan24Clock,
  minutesBetween,
  shiftWindowBounds,
  type ShiftRow,
} from '../plan24/plan24ShiftUtils'
import type { Plan24EventRow, Plan24RosterRow } from '../plan24/plan24Types'
import { Plan24EventDetailModal } from '../plan24/Plan24EventDetailModal'

const PLAN24_VISIBLE_DAYS_AHEAD = 90
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

export type LineDdsActionsPanelProps = {
  cellId: string
  planDate: string
  shiftKind: string
}

/**
 * DDS actions for the scoped plan date and shift (Line DDS planned-actions column).
 */
export function LineDdsActionsPanel({ cellId, planDate, shiftKind }: LineDdsActionsPanelProps) {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()

  const todayYmd = localYMD(new Date())
  const maxVisibleYmd = useMemo(() => {
    const d = new Date(todayYmd + 'T12:00:00')
    d.setDate(d.getDate() + (PLAN24_VISIBLE_DAYS_AHEAD - 1))
    return localYMD(d)
  }, [todayYmd])

  const clamp = useCallback(
    (raw: string) => {
      if (!raw) return todayYmd
      if (raw < todayYmd) return todayYmd
      if (raw > maxVisibleYmd) return maxVisibleYmd
      return raw
    },
    [todayYmd, maxVisibleYmd],
  )

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
  const [createPlanDate, setCreatePlanDate] = useState(planDate)
  const [createShiftKind, setCreateShiftKind] = useState(shiftKind)
  const [createOwnerPersonId, setCreateOwnerPersonId] = useState('')
  const [createStartLocal, setCreateStartLocal] = useState('')
  const [createTitle, setCreateTitle] = useState('DDS action')
  const [createComment, setCreateComment] = useState('')
  const [createEndMin, setCreateEndMin] = useState('30')

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
    if (!cellId || !planDate || !shiftKind) return
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
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind)
        .is('deleted_at', null)
        .order('start_at'),
    ])
    if (shRes.error) setLoadErr(shRes.error.message)
    else setShifts((shRes.data ?? []) as ShiftRow[])
    if (peRes.error) setLoadErr(peRes.error.message)
    else setPeople((peRes.data ?? []) as typeof people)
    if (evRes.error) setLoadErr(evRes.error.message)
    else setEvents((evRes.data ?? []) as Plan24EventRow[])
    setLoading(false)
  }, [cellId, planDate, shiftKind])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!successMsg) return
    const t = window.setTimeout(() => setSuccessMsg(null), 2400)
    return () => window.clearTimeout(t)
  }, [successMsg])

  const sortedDayEvents = useMemo(() => {
    const copy = [...events]
    copy.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
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
    const sk =
      shifts.length === 0
        ? shiftKind
        : shifts.some((s) => s.kind === shiftKind)
          ? shiftKind
          : shifts[0].kind
    setCreatePlanDate(planDate)
    setCreateShiftKind(sk)
    const bounds = shiftWindowBounds(planDate, sk, shifts)
    setCreateStartLocal(formatForDatetimeLocal(bounds.start))
    setCreateOwnerPersonId('')
    setCreateTitle('DDS action')
    setCreateComment('')
    setCreateEndMin('30')
    setCreateOpen(true)
  }, [roster, user, planDate, shiftKind, shifts])

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
    refresh,
  ])

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

  if (!shiftKind) {
    return <p className="text-[11px] text-muted">Select a shift in the scope bar to load DDS actions.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Loading
          </span>
        ) : null}
        <div className="min-w-0 flex-1" />
        {roster && user ? (
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-fg shadow-sm hover:bg-surface-raised/80"
          >
            <Plus className="size-3.5" aria-hidden />
            New action
          </button>
        ) : null}
      </div>

      {loadErr ? (
        <div className="shrink-0 rounded-lg border border-danger/35 bg-danger/10 px-2 py-1.5 text-[11px] text-danger" role="alert">
          {loadErr}
        </div>
      ) : null}
      {successMsg ? (
        <div className="shrink-0 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-900 dark:text-emerald-100">
          {successMsg}
        </div>
      ) : null}

      {!roster ? (
        <p className="shrink-0 text-[11px] text-muted">No active Plan 24 roster for this cell.</p>
      ) : shifts.length === 0 ? (
        <p className="shrink-0 text-[11px] text-muted">No shifts configured on the roster.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-surface p-2">
          <p className="mb-2 text-[10px] text-muted">
            {planDate} · {shiftKind.replace(/_/g, ' ')} · {formatPlan24Clock(windowBounds.start)}–
            {formatPlan24Clock(windowBounds.end)}
          </p>
          <div className="space-y-1">
            {sortedDayEvents.length === 0 ? (
              <p className="text-xs text-muted">No DDS actions for this day and shift.</p>
            ) : (
              sortedDayEvents.map((ev) => {
                const start = new Date(ev.start_at)
                const end = new Date(ev.end_at)
                const startMin = Math.max(0, minutesBetween(windowBounds.start, start))
                const durMin = Math.max(2, minutesBetween(start, end))
                const leftPct = (startMin / totalMin) * 100
                const widthPct = (durMin / totalMin) * 100
                const owner = ev.assigned_person_id ? peopleById.get(ev.assigned_person_id) : undefined
                const ownerLab = owner ? personLabel(owner) : '—'
                return (
                  <div
                    key={ev.id}
                    className="flex items-stretch gap-2 rounded-xl border border-border bg-canvas/40 py-1 pl-2 pr-1"
                    style={{ minHeight: ROW_H }}
                  >
                    <div className="flex w-36 min-w-0 shrink-0 flex-col justify-center text-[10px] leading-tight">
                      <span className="truncate font-semibold text-fg">{ev.title}</span>
                      <span className="truncate text-muted">{ownerLab}</span>
                    </div>
                    <div className="relative min-h-[32px] min-w-0 flex-1 rounded-lg bg-surface-raised/30">
                      <div className="pointer-events-none absolute inset-0 rounded-lg bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(100%/24-1px),rgba(0,0,0,0.06)_calc(100%/24-1px),rgba(0,0,0,0.06)_calc(100%/24))]" />
                      <button
                        type="button"
                        title="Open details"
                        className={`absolute top-1 bottom-1 min-w-[6px] rounded-md border text-left text-[10px] font-medium leading-none shadow-sm transition hover:brightness-105 ${
                          ev.status === 'complete'
                            ? 'border-emerald-800/50 bg-emerald-600 text-emerald-50'
                            : ev.status === 'not_required'
                              ? 'border-zinc-500/50 bg-zinc-400 text-zinc-950'
                              : 'border-orange-800/50 bg-orange-500 text-orange-950'
                        }`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.8)}%` }}
                        onClick={() => setDetailEv(ev)}
                      >
                        <span className="sr-only">
                          {ev.title}, {formatPlan24Clock(start)} to {formatPlan24Clock(end)}
                        </span>
                      </button>
                    </div>
                    <div className="flex w-[6.5rem] shrink-0 flex-col justify-center gap-1">
                      <select
                        aria-label={`Status for ${ev.title}`}
                        className={`w-full rounded-lg border px-1 py-0.5 text-[9px] font-semibold outline-none ${statusSelectClass(ev.status)}`}
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
      )}

      {createOpen && roster ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="line-dds-dds-create-title"
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void saveCreate()
              }}
            >
              <h2 id="line-dds-dds-create-title" className="font-display text-lg font-semibold">
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
                  min={todayYmd}
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
                    !createStartLocal.trim()
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
