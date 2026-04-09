import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LdrPersonAvatar } from '../features/ldr/LdrPersonAvatar'
import {
  addDays,
  formatWeekTitle,
  parseYMD,
  startOfWeekMonday,
  toYMD,
  weekDaysMondayFirst,
} from '../features/ldr/ldrWeekUtils'
import {
  ldrLocationName,
  ldrPersonFullName,
  type LdrActivity,
  type LdrAssignmentRow,
  type LdrPersonRow,
  type LdrRag,
} from '../features/ldr/types'

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function personName(p: LdrPersonRow): string {
  return ldrPersonFullName(p)
}

function shortLocationTag(p: LdrPersonRow): string {
  const n = ldrLocationName(p.ldr_locations).trim()
  if (!n) return ''
  return n.length <= 4 ? n : n.slice(0, 4).toUpperCase()
}

function shortLocationTagFromName(name: string): string {
  const n = name.trim()
  if (!n) return ''
  return n.length <= 4 ? n : n.slice(0, 4).toUpperCase()
}

function ragDotClass(r: LdrRag): string {
  if (r === 'none') return 'bg-slate-400'
  if (r === 'green') return 'bg-emerald-500'
  if (r === 'yellow') return 'bg-amber-400'
  return 'bg-rose-500'
}

export function LeadershipRosterPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()))
  const [activities, setActivities] = useState<LdrActivity[]>([])
  const [ldrPeople, setLdrPeople] = useState<LdrPersonRow[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [assignments, setAssignments] = useState<LdrAssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cellModal, setCellModal] = useState<{ activityId: string; date: string } | null>(null)
  const [dragAssignmentId, setDragAssignmentId] = useState<string | null>(null)

  const weekDays = useMemo(() => weekDaysMondayFirst(weekStart), [weekStart])
  const weekStartStr = toYMD(weekStart)
  const weekEndStr = toYMD(addDays(weekStart, 6))

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const [actRes, peopleRes, locationsRes, asgRes] = await Promise.all([
      supabase.from('ldr_activities').select('id, name, sort_order').order('sort_order').order('name'),
      supabase
        .from('ldr_people')
        .select(
          'id, person_id, site_id, location_id, status, first_name, last_name, initials, avatar_variant, ldr_locations(name)',
        )
        .order('first_name')
        .order('last_name'),
      supabase.from('ldr_locations').select('id, name').order('sort_order').order('name'),
      supabase
        .from('ldr_assignments')
        .select('id, ldr_person_id, activity_id, assignment_date, ldr_location_id, rag_status, comment, ldr_locations(name)')
        .gte('assignment_date', weekStartStr)
        .lte('assignment_date', weekEndStr),
    ])
    if (actRes.error) setError(actRes.error.message)
    else if (peopleRes.error) setError(peopleRes.error.message)
    else if (locationsRes.error) setError(locationsRes.error.message)
    else if (asgRes.error) setError(asgRes.error.message)
    else {
      setActivities((actRes.data ?? []) as LdrActivity[])
      setLdrPeople((peopleRes.data ?? []) as LdrPersonRow[])
      setLocations((locationsRes.data ?? []) as { id: string; name: string }[])
      setAssignments((asgRes.data ?? []) as LdrAssignmentRow[])
    }
    setLoading(false)
  }, [weekStartStr, weekEndStr])

  useEffect(() => {
    void load()
  }, [load])

  const conflictKeys = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const a of assignments) {
      const k = `${a.ldr_person_id}|${a.assignment_date}`
      if (!m.has(k)) m.set(k, new Set())
      m.get(k)!.add(a.activity_id)
    }
    const out = new Set<string>()
    for (const [k, acts] of m) {
      if (acts.size > 1) out.add(k)
    }
    return out
  }, [assignments])

  function personConflictOnDate(ldrPersonId: string, date: string): boolean {
    return conflictKeys.has(`${ldrPersonId}|${date}`)
  }

  function assignmentsForCell(activityId: string, date: string): LdrAssignmentRow[] {
    return assignments.filter((a) => a.activity_id === activityId && a.assignment_date === date)
  }

  function cellHasWarning(activityId: string, date: string): boolean {
    return assignmentsForCell(activityId, date).some((a) => personConflictOnDate(a.ldr_person_id, date))
  }

  async function addAssignment(activityId: string, date: string, ldrPersonId: string) {
    setError(null)
    const person = ldrPeople.find((p) => p.id === ldrPersonId)
    const { error: e } = await supabase.from('ldr_assignments').insert({
      activity_id: activityId,
      assignment_date: date,
      ldr_person_id: ldrPersonId,
      ldr_location_id: person?.location_id ?? null,
      rag_status: 'none',
      comment: '',
    })
    if (e) {
      setError(e.message)
      return
    }
    await load()
  }

  async function updateAssignment(
    id: string,
    patch: Partial<Pick<LdrAssignmentRow, 'rag_status' | 'comment' | 'ldr_location_id'>>,
  ) {
    setError(null)
    const { error: e } = await supabase.from('ldr_assignments').update(patch).eq('id', id)
    if (e) {
      setError(e.message)
      return
    }
    await load()
  }

  async function removeAssignment(id: string) {
    setError(null)
    const { error: e } = await supabase.from('ldr_assignments').delete().eq('id', id)
    if (e) {
      setError(e.message)
      return
    }
    await load()
  }

  async function moveAssignment(assignmentId: string, activityId: string, date: string) {
    setError(null)
    const { error: e } = await supabase.from('ldr_assignments').update({ activity_id: activityId, assignment_date: date }).eq('id', assignmentId)
    if (e) {
      setError(e.message)
      return
    }
    setDragAssignmentId(null)
    await load()
  }

  function shiftWeek(delta: number) {
    setWeekStart((w) => addDays(w, delta * 7))
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Users className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Roster</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Leadership activities by day. Conflicts warn but never block saves.
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="rounded-lg border border-border p-2 text-muted hover:bg-black/[0.04] hover:text-fg"
            aria-label="Previous week"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="rounded-lg border border-border p-2 text-muted hover:bg-black/[0.04] hover:text-fg"
            aria-label="Next week"
          >
            <ChevronRight className="size-5" />
          </button>
          <h2 className="px-2 font-display text-lg font-semibold tracking-tight">{formatWeekTitle(weekStart)}</h2>
          <label className="ml-auto flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
            Jump
            <input
              type="date"
              value={toYMD(addDays(weekStart, 3))}
              onChange={(e) => {
                if (!e.target.value) return
                setWeekStart(startOfWeekMonday(parseYMD(e.target.value)))
              }}
              className="rounded-lg border border-border bg-canvas px-2 py-1.5 text-sm text-fg"
            />
          </label>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted">Loading…</p>
        ) : activities.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No activities yet. Add them under <strong className="text-fg/90">LDR tools → Admin</strong>.
          </p>
        ) : ldrPeople.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No LDR people yet. Add people under <strong className="text-fg/90">LDR tools → Admin</strong>.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
                  <th className="sticky left-0 z-10 min-w-[7.5rem] bg-surface py-2 pl-2 pr-2">Activity</th>
                  {weekDays.map((d, i) => (
                    <th key={toYMD(d)} className="min-w-[5.8rem] px-1 py-2 text-center">
                      <span className="block">{dayLabels[i]}</span>
                      <span className="text-fg">{d.getDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activities.map((act) => (
                  <tr key={act.id}>
                    <td className="sticky left-0 z-10 bg-surface py-1.5 pl-2 pr-2 font-medium text-fg">{act.name}</td>
                    {weekDays.map((d) => {
                      const ymd = toYMD(d)
                      const list = assignmentsForCell(act.id, ymd)
                      const warn = cellHasWarning(act.id, ymd)
                      return (
                        <td key={ymd} className="align-top p-0.5">
                          <button
                            type="button"
                            onClick={() => setCellModal({ activityId: act.id, date: ymd })}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const id = e.dataTransfer.getData('text/ldr-assignment') || dragAssignmentId
                              if (id) void moveAssignment(id, act.id, ymd)
                            }}
                            className="min-h-[4.25rem] w-full rounded-lg border border-border bg-canvas/40 p-1.5 text-left transition hover:border-accent/40 hover:bg-black/[0.02]"
                          >
                            <div className="mb-1 flex min-h-[1rem] items-center justify-end">
                              {warn ? (
                                <AlertTriangle className="size-4 text-amber-600" aria-label="Assignment conflict" />
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {list.map((a) => {
                                const lp = ldrPeople.find((p) => p.id === a.ldr_person_id)
                                const nm = lp ? personName(lp) : '?'
                                const assignmentLocationName = ldrLocationName(a.ldr_locations)
                                const locTag = assignmentLocationName
                                  ? shortLocationTagFromName(assignmentLocationName)
                                  : lp
                                    ? shortLocationTag(lp)
                                    : ''
                                const c = personConflictOnDate(a.ldr_person_id, ymd)
                                return (
                                  <span
                                    key={a.id}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/ldr-assignment', a.id)
                                      e.dataTransfer.effectAllowed = 'move'
                                      setDragAssignmentId(a.id)
                                    }}
                                    onDragEnd={() => setDragAssignmentId(null)}
                                    onClick={(ev) => {
                                      ev.stopPropagation()
                                      setCellModal({ activityId: act.id, date: ymd })
                                    }}
                                    title={nm}
                                    className={`inline-flex max-w-full items-center gap-1 rounded-md border px-1 py-0.5 text-[10px] font-semibold shadow-sm ${
                                      c
                                        ? 'border-amber-400/60 bg-amber-50 text-amber-950'
                                        : 'border-border bg-surface text-fg'
                                    }`}
                                  >
                                    <span className={`size-2 shrink-0 rounded-full ${ragDotClass(a.rag_status)}`} />
                                    <span className="truncate">
                                      {lp?.initials ?? 'LD'}
                                      {locTag ? ` · ${locTag}` : ''}
                                    </span>
                                  </span>
                                )
                              })}
                            </div>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {cellModal ? (
        <CellEditorModal
          activityName={activities.find((a) => a.id === cellModal.activityId)?.name ?? 'Activity'}
          date={cellModal.date}
          people={ldrPeople}
          locations={locations}
          rows={assignmentsForCell(cellModal.activityId, cellModal.date)}
          onClose={() => setCellModal(null)}
          onAdd={(pid) => void addAssignment(cellModal.activityId, cellModal.date, pid)}
          onUpdate={(id, patch) => void updateAssignment(id, patch)}
          onRemove={(id) => void removeAssignment(id)}
        />
      ) : null}
    </div>
  )
}

function CellEditorModal(props: {
  activityName: string
  date: string
  people: LdrPersonRow[]
  locations: { id: string; name: string }[]
  rows: LdrAssignmentRow[]
  onClose: () => void
  onAdd: (ldrPersonId: string) => void
  onUpdate: (id: string, patch: Partial<Pick<LdrAssignmentRow, 'rag_status' | 'comment' | 'ldr_location_id'>>) => void
  onRemove: (id: string) => void
}) {
  const assigned = new Set(props.rows.map((r) => r.ldr_person_id))
  const addable = props.people.filter((p) => !assigned.has(p.id))

  return (
    <dialog open className="fixed inset-0 z-50 flex max-h-none max-w-none items-center justify-center bg-black/40 p-4 text-fg [color-scheme:light]">
      <div className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 text-fg shadow-glow">
        <h3 className="font-display text-lg font-semibold text-fg">{props.activityName}</h3>
        <p className="mt-1 text-sm text-muted">{props.date}</p>

        <div className="mt-4 space-y-4">
          {props.rows.length === 0 ? (
            <p className="text-sm text-muted">No assignments yet.</p>
          ) : (
            props.rows.map((r) => {
              const p = props.people.find((x) => x.id === r.ldr_person_id)
              const assignmentLocationName = ldrLocationName(r.ldr_locations)
              const compactLocation = assignmentLocationName
                ? shortLocationTagFromName(assignmentLocationName)
                : p
                  ? shortLocationTag(p)
                  : ''
              const compact = p != null ? `${p.initials}${compactLocation ? ` · ${compactLocation}` : ''}` : 'LD'
              return (
                <AssignmentRowEditor
                  key={r.id}
                  row={r}
                  locations={props.locations}
                  personLabel={compact}
                  personFullName={p ? personName(p) : 'Person'}
                  personInitials={p?.initials ?? 'LD'}
                  personAvatarVariant={p?.avatar_variant ?? 1}
                  onUpdate={props.onUpdate}
                  onRemove={props.onRemove}
                />
              )
            })
          )}

          {addable.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Add person</p>
              <select
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v) {
                    props.onAdd(v)
                    e.target.value = ''
                  }
                }}
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="" disabled className="text-fg">
                  Select…
                </option>
                {addable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.initials}
                    {shortLocationTag(p) ? ` · ${shortLocationTag(p)}` : ''} — {personName(p)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={props.onClose}
          className="mt-6 w-full rounded-xl border border-border py-2 text-sm font-medium text-fg"
        >
          Close
        </button>
      </div>
    </dialog>
  )
}

function AssignmentRowEditor(props: {
  row: LdrAssignmentRow
  locations: { id: string; name: string }[]
  personLabel: string
  personFullName: string
  personInitials: string
  personAvatarVariant: number
  onUpdate: (id: string, patch: Partial<Pick<LdrAssignmentRow, 'rag_status' | 'comment' | 'ldr_location_id'>>) => void
  onRemove: (id: string) => void
}) {
  const [comment, setComment] = useState(props.row.comment)
  useEffect(() => {
    setComment(props.row.comment)
  }, [props.row.id, props.row.comment])

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-3 text-fg shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LdrPersonAvatar initials={props.personInitials} variant={props.personAvatarVariant} />
          <div>
            <p className="font-medium text-fg">{props.personLabel}</p>
            <p className="text-[11px] text-muted">{props.personFullName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => props.onRemove(props.row.id)}
          className="text-xs font-medium text-danger hover:underline"
        >
          Remove
        </button>
      </div>
      <label className="mt-2 block text-xs font-medium uppercase tracking-wider text-muted">
        RAG
        <select
          value={props.row.rag_status}
          onChange={(e) => props.onUpdate(props.row.id, { rag_status: e.target.value as LdrRag })}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-fg"
        >
          <option value="none">None</option>
          <option value="green">Green</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
        </select>
      </label>
      <label className="mt-2 block text-xs font-medium uppercase tracking-wider text-muted">
        Location
        <select
          value={props.row.ldr_location_id ?? ''}
          onChange={(e) =>
            props.onUpdate(props.row.id, {
              ldr_location_id: e.target.value || null,
            })
          }
          className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-fg"
        >
          <option value="">No location</option>
          {props.locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-xs font-medium uppercase tracking-wider text-muted">
        Comment
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => {
            if (comment !== props.row.comment) props.onUpdate(props.row.id, { comment })
          }}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-fg placeholder:text-muted"
        />
      </label>
    </div>
  )
}
