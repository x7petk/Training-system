import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localYMD } from '../../lib/dueDateUtils'
import type { Plan24RosterRoleRow, Plan24RosterRow } from './plan24Types'
import { usePlan24Workspace } from './Plan24WorkspaceContext'
import type { ShiftRow } from './plan24ShiftUtils'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

function timeInputValue(s: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(s?.trim() ?? '')
  if (!m) return '05:00'
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

export function Plan24AdminRosterTab() {
  const { cellId, status } = usePlan24Workspace()
  const [err, setErr] = useState<string | null>(null)
  const [rosters, setRosters] = useState<Plan24RosterRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [roles, setRoles] = useState<Plan24RosterRoleRow[]>([])
  const [people, setPeople] = useState<{ id: string; display_name: string | null }[]>([])
  const [newRosterName, setNewRosterName] = useState('')
  const [dayStart, setDayStart] = useState('05:00')
  const [dayEnd, setDayEnd] = useState('17:00')
  const [nightStart, setNightStart] = useState('17:00')
  const [nightEnd, setNightEnd] = useState('05:00')

  const loadRosters = useCallback(async () => {
    if (!cellId || status !== 'ready') return
    setErr(null)
    const res = await supabase
      .from('plan24_rosters')
      .select('id, master_cell_id, name, sort_order, is_active, effective_from')
      .eq('master_cell_id', cellId)
      .order('sort_order')
    if (res.error) {
      setErr(res.error.message)
      return
    }
    const rows = (res.data ?? []) as Plan24RosterRow[]
    setRosters(rows)
    const active = rows.find((r) => r.is_active)
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev
      return active?.id ?? rows[0]?.id ?? ''
    })
  }, [cellId, status])

  useEffect(() => {
    void loadRosters()
  }, [loadRosters])

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setRoles([])
      return
    }
    const [rRes, sRes, pRes] = await Promise.all([
      supabase.from('plan24_roster_roles').select('*').eq('roster_id', selectedId).order('sort_order'),
      supabase.from('plan24_roster_shifts').select('kind, start_local, end_local').eq('roster_id', selectedId).order('sort_order'),
      supabase.from('people').select('id, display_name').order('display_name').limit(400),
    ])
    if (rRes.error) setErr(rRes.error.message)
    else setRoles((rRes.data ?? []) as Plan24RosterRoleRow[])
    if (sRes.error) setErr(sRes.error.message)
    else {
      const sh = (sRes.data ?? []) as ShiftRow[]
      const day = sh.find((x) => x.kind === 'day')
      const night = sh.find((x) => x.kind === 'night')
      if (day) {
        setDayStart(timeInputValue(day.start_local))
        setDayEnd(timeInputValue(day.end_local))
      }
      if (night) {
        setNightStart(timeInputValue(night.start_local))
        setNightEnd(timeInputValue(night.end_local))
      }
    }
    if (!pRes.error) setPeople((pRes.data ?? []) as typeof people)
  }, [selectedId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const selected = useMemo(() => rosters.find((r) => r.id === selectedId), [rosters, selectedId])

  const saveShifts = useCallback(async () => {
    if (!selectedId) return
    setErr(null)
    const toTime = (hm: string) => {
      const [h, m] = hm.split(':').map(Number)
      return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:00`
    }
    const { error: e1 } = await supabase.from('plan24_roster_shifts').upsert(
      {
        roster_id: selectedId,
        kind: 'day' as const,
        start_local: toTime(dayStart),
        end_local: toTime(dayEnd),
        sort_order: 0,
      },
      { onConflict: 'roster_id,kind' },
    )
    if (e1) {
      setErr(e1.message)
      return
    }
    const { error: e2 } = await supabase.from('plan24_roster_shifts').upsert(
      {
        roster_id: selectedId,
        kind: 'night' as const,
        start_local: toTime(nightStart),
        end_local: toTime(nightEnd),
        sort_order: 1,
      },
      { onConflict: 'roster_id,kind' },
    )
    if (e2) setErr(e2.message)
    else void loadDetail()
  }, [selectedId, dayStart, dayEnd, nightStart, nightEnd, loadDetail])

  const saveRole = useCallback(
    async (row: Plan24RosterRoleRow) => {
      setErr(null)
      const { error } = await supabase
        .from('plan24_roster_roles')
        .update({
          name: row.name,
          sort_order: row.sort_order,
          is_active: row.is_active,
          default_person_id: row.default_person_id,
          default_person_day_id: row.default_person_day_id ?? null,
          default_person_night_id: row.default_person_night_id ?? null,
        })
        .eq('id', row.id)
      if (error) setErr(error.message)
      else void loadDetail()
    },
    [loadDetail],
  )

  const addRole = useCallback(async () => {
    if (!selectedId) return
    const next = roles.length ? Math.max(...roles.map((r) => r.sort_order)) + 1 : 0
    const { error } = await supabase.from('plan24_roster_roles').insert({
      roster_id: selectedId,
      name: `Role ${next + 1}`,
      sort_order: next,
      is_active: true,
    })
    if (error) setErr(error.message)
    else void loadDetail()
  }, [selectedId, roles, loadDetail])

  const createRoster = useCallback(async () => {
    if (!cellId || !newRosterName.trim()) return
    const { error } = await supabase.from('plan24_rosters').insert({
      master_cell_id: cellId,
      name: newRosterName.trim(),
      sort_order: rosters.length,
      is_active: false,
    })
    if (error) setErr(error.message)
    else {
      setNewRosterName('')
      void loadRosters()
    }
  }, [cellId, newRosterName, rosters.length, loadRosters])

  const activateRoster = useCallback(async () => {
    if (!cellId || !selectedId) return
    const eff = window.prompt('Effective from date (YYYY-MM-DD). Plan on and after this date uses this roster.', localYMD(new Date()))
    if (!eff || !/^\d{4}-\d{2}-\d{2}$/.test(eff)) return
    setErr(null)
    const { error: e0 } = await supabase.from('plan24_rosters').update({ is_active: false }).eq('master_cell_id', cellId)
    if (e0) {
      setErr(e0.message)
      return
    }
    const { error: e1 } = await supabase
      .from('plan24_rosters')
      .update({ is_active: true, effective_from: eff })
      .eq('id', selectedId)
    if (e1) setErr(e1.message)
    else void loadRosters()
  }, [cellId, selectedId, loadRosters])

  if (status !== 'ready') return <p className="text-sm text-muted">Loading…</p>
  if (!cellId) {
    return <p className="text-sm text-muted">Pick a cell in the scope bar above.</p>
  }

  return (
    <div className="space-y-8">
      {err ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {err}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Rosters for this cell</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] text-xs text-muted">
            Active / edit roster
            <select className={`${inputClass} mt-1`} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.is_active ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold shadow-sm hover:bg-surface-raised/80"
            onClick={() => void activateRoster()}
          >
            Make selected roster active
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="New roster name"
            value={newRosterName}
            onChange={(e) => setNewRosterName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
            onClick={() => void createRoster()}
          >
            Add roster
          </button>
        </div>
        {selected ? (
          <p className="text-xs text-muted">
            Editing <strong className="text-fg">{selected.name}</strong>
            {selected.effective_from ? ` · effective from ${selected.effective_from}` : null}
          </p>
        ) : null}
      </section>

      {selectedId ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Shift windows (local time)</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted">
                Day start
                <input type="time" className={`${inputClass} mt-1`} value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
              </label>
              <label className="text-xs text-muted">
                Day end
                <input type="time" className={`${inputClass} mt-1`} value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
              </label>
              <label className="text-xs text-muted">
                Night start
                <input type="time" className={`${inputClass} mt-1`} value={nightStart} onChange={(e) => setNightStart(e.target.value)} />
              </label>
              <label className="text-xs text-muted">
                Night end
                <input type="time" className={`${inputClass} mt-1`} value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold shadow-sm hover:bg-surface-raised/80"
              onClick={() => void saveShifts()}
            >
              Save shifts
            </button>
          </section>

          <section className="space-y-3">
            <p className="text-xs text-muted">
              Set a default person per role for <strong className="font-medium text-fg/90">day</strong> and{' '}
              <strong className="font-medium text-fg/90">night</strong> shift windows. Plan 24 uses these when there is no
              per-day assignment on the grid. The legacy column applies only if both day and night defaults are empty.
            </p>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-fg">Roles</h2>
              <button
                type="button"
                className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
                onClick={() => void addRole()}
              >
                Add role
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-raised/50 text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Sort</th>
                    <th className="px-3 py-2">Active</th>
                    <th className="px-3 py-2">Day default</th>
                    <th className="px-3 py-2">Night default</th>
                    <th className="px-3 py-2" title="Fallback when day and night defaults are both empty">
                      Fallback
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2">
                        <input
                          className={inputClass}
                          value={row.name}
                          onChange={(e) =>
                            setRoles((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className={inputClass}
                          value={row.sort_order}
                          onChange={(e) =>
                            setRoles((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, sort_order: Number(e.target.value) || 0 } : r)),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={row.is_active}
                          onChange={(e) =>
                            setRoles((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: e.target.checked } : r)))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={inputClass}
                          value={row.default_person_day_id ?? ''}
                          onChange={(e) =>
                            setRoles((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, default_person_day_id: e.target.value || null } : r,
                              ),
                            )
                          }
                        >
                          <option value="">—</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name ?? p.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={inputClass}
                          value={row.default_person_night_id ?? ''}
                          onChange={(e) =>
                            setRoles((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, default_person_night_id: e.target.value || null } : r,
                              ),
                            )
                          }
                        >
                          <option value="">—</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name ?? p.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={`${inputClass} text-xs`}
                          title="Used only when day and night defaults are both empty"
                          value={row.default_person_id ?? ''}
                          onChange={(e) =>
                            setRoles((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, default_person_id: e.target.value || null } : r,
                              ),
                            )
                          }
                        >
                          <option value="">—</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name ?? p.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-raised/80"
                          onClick={() => void saveRole(row)}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
