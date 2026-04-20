import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { localYMD } from '../../lib/dueDateUtils'
import type {
  Plan24PatternSlotRow,
  Plan24RoleTeamDefaultRow,
  Plan24RosterRoleRow,
  Plan24RosterRow,
  Plan24ShiftRow,
  Plan24TeamRow,
} from './plan24Types'
import { usePlan24Workspace } from './Plan24WorkspaceContext'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

const TEAM_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899',
]

function timeInputValue(s: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(s?.trim() ?? '')
  if (!m) return '05:00'
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function toTime(hm: string) {
  const [h, m] = hm.split(':').map(Number)
  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:00`
}

export function Plan24AdminRosterTab() {
  const { cellId, status } = usePlan24Workspace()
  const [err, setErr] = useState<string | null>(null)
  const [rosters, setRosters] = useState<Plan24RosterRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [newRosterName, setNewRosterName] = useState('')

  const [shifts, setShifts] = useState<Plan24ShiftRow[]>([])
  const [teams, setTeams] = useState<Plan24TeamRow[]>([])
  const [pattern, setPattern] = useState<Plan24PatternSlotRow[]>([])
  const [roles, setRoles] = useState<Plan24RosterRoleRow[]>([])
  const [roleTeamDefaults, setRoleTeamDefaults] = useState<Plan24RoleTeamDefaultRow[]>([])
  const [people, setPeople] = useState<{ id: string; display_name: string | null }[]>([])

  /* ── load rosters ── */
  const loadRosters = useCallback(async () => {
    if (!cellId || status !== 'ready') return
    setErr(null)
    const res = await supabase
      .from('plan24_rosters')
      .select('id, master_cell_id, name, sort_order, is_active, effective_from, pattern_length, pattern_start_date')
      .eq('master_cell_id', cellId)
      .order('sort_order')
    if (res.error) { setErr(res.error.message); return }
    const rows = (res.data ?? []) as Plan24RosterRow[]
    setRosters(rows)
    const active = rows.find((r) => r.is_active)
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev
      return active?.id ?? rows[0]?.id ?? ''
    })
  }, [cellId, status])

  useEffect(() => { void loadRosters() }, [loadRosters])

  /* ── load detail for selected roster ── */
  const loadDetail = useCallback(async () => {
    if (!selectedId) { setShifts([]); setTeams([]); setPattern([]); setRoles([]); setRoleTeamDefaults([]); return }
    const [sRes, tRes, pRes, rRes, pplRes, rtdRes] = await Promise.all([
      supabase.from('plan24_roster_shifts').select('id, roster_id, kind, display_name, start_local, end_local, sort_order').eq('roster_id', selectedId).order('sort_order'),
      supabase.from('plan24_teams').select('*').eq('roster_id', selectedId).order('sort_order'),
      supabase.from('plan24_pattern_slots').select('*').eq('roster_id', selectedId),
      supabase.from('plan24_roster_roles').select('*').eq('roster_id', selectedId).order('sort_order'),
      supabase.from('people').select('id, display_name').order('display_name').limit(400),
      supabase.from('plan24_role_team_defaults').select('*'),
    ])
    if (sRes.error) setErr(sRes.error.message); else setShifts((sRes.data ?? []) as Plan24ShiftRow[])
    if (tRes.error) setErr(tRes.error.message); else setTeams((tRes.data ?? []) as Plan24TeamRow[])
    if (pRes.error) setErr(pRes.error.message); else setPattern((pRes.data ?? []) as Plan24PatternSlotRow[])
    if (rRes.error) setErr(rRes.error.message); else setRoles((rRes.data ?? []) as Plan24RosterRoleRow[])
    if (!pplRes.error) setPeople((pplRes.data ?? []) as typeof people)
    if (rtdRes.error) setErr(rtdRes.error.message)
    else {
      const roleIds = new Set(((rRes.data ?? []) as Plan24RosterRoleRow[]).map((r) => r.id))
      setRoleTeamDefaults(((rtdRes.data ?? []) as Plan24RoleTeamDefaultRow[]).filter((d) => roleIds.has(d.role_id)))
    }
  }, [selectedId])

  useEffect(() => { void loadDetail() }, [loadDetail])

  const selected = useMemo(() => rosters.find((r) => r.id === selectedId), [rosters, selectedId])

  /* ── roster CRUD ── */
  const createRoster = useCallback(async () => {
    if (!cellId || !newRosterName.trim()) return
    const { error } = await supabase.from('plan24_rosters').insert({
      master_cell_id: cellId, name: newRosterName.trim(), sort_order: rosters.length, is_active: false,
    })
    if (error) setErr(error.message); else { setNewRosterName(''); void loadRosters() }
  }, [cellId, newRosterName, rosters.length, loadRosters])

  const activateRoster = useCallback(async () => {
    if (!cellId || !selectedId) return
    const eff = window.prompt('Effective from date (YYYY-MM-DD).', localYMD(new Date()))
    if (!eff || !/^\d{4}-\d{2}-\d{2}$/.test(eff)) return
    setErr(null)
    await supabase.from('plan24_rosters').update({ is_active: false }).eq('master_cell_id', cellId)
    const { error } = await supabase.from('plan24_rosters').update({ is_active: true, effective_from: eff }).eq('id', selectedId)
    if (error) setErr(error.message); else void loadRosters()
  }, [cellId, selectedId, loadRosters])

  /* ── shifts CRUD ── */
  const addShift = useCallback(async () => {
    if (!selectedId) return
    const next = shifts.length
    const names = ['day', 'afternoon', 'night', 'evening', 'early', 'late']
    const usedKinds = new Set(shifts.map((s) => s.kind))
    const kind = names.find((n) => !usedKinds.has(n)) ?? `shift_${next + 1}`
    const { error } = await supabase.from('plan24_roster_shifts').insert({
      roster_id: selectedId, kind, display_name: kind.charAt(0).toUpperCase() + kind.slice(1),
      start_local: '06:00:00', end_local: '14:00:00', sort_order: next,
    })
    if (error) setErr(error.message); else void loadDetail()
  }, [selectedId, shifts, loadDetail])

  const saveShift = useCallback(async (s: Plan24ShiftRow) => {
    setErr(null)
    const { error } = await supabase.from('plan24_roster_shifts').update({
      display_name: s.display_name,
      start_local: toTime(timeInputValue(s.start_local)),
      end_local: toTime(timeInputValue(s.end_local)),
      sort_order: s.sort_order,
    }).eq('id', s.id)
    if (error) setErr(error.message); else void loadDetail()
  }, [loadDetail])

  const deleteShift = useCallback(async (id: string) => {
    if (!window.confirm('Delete this shift?')) return
    const { error } = await supabase.from('plan24_roster_shifts').delete().eq('id', id)
    if (error) setErr(error.message); else void loadDetail()
  }, [loadDetail])

  /* ── teams CRUD ── */
  const addTeam = useCallback(async () => {
    if (!selectedId) return
    const n = teams.length
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const name = n < labels.length ? labels[n] : `Team ${n + 1}`
    const { error } = await supabase.from('plan24_teams').insert({
      roster_id: selectedId, name, color: TEAM_COLORS[n % TEAM_COLORS.length], sort_order: n,
    })
    if (error) setErr(error.message); else void loadDetail()
  }, [selectedId, teams, loadDetail])

  const saveTeam = useCallback(async (t: Plan24TeamRow) => {
    setErr(null)
    const { error } = await supabase.from('plan24_teams').update({ name: t.name, color: t.color, sort_order: t.sort_order }).eq('id', t.id)
    if (error) setErr(error.message); else void loadDetail()
  }, [loadDetail])

  const deleteTeam = useCallback(async (id: string) => {
    if (!window.confirm('Delete this team? Pattern slots and role defaults for it will be cleared.')) return
    const { error } = await supabase.from('plan24_teams').delete().eq('id', id)
    if (error) setErr(error.message); else void loadDetail()
  }, [loadDetail])

  /* ── pattern ── */
  const patternLength = selected?.pattern_length ?? 8

  const savePatternLength = useCallback(async (len: number) => {
    if (!selectedId || len < 1) return
    const { error } = await supabase.from('plan24_rosters').update({ pattern_length: len }).eq('id', selectedId)
    if (error) setErr(error.message); else void loadRosters()
  }, [selectedId, loadRosters])

  const savePatternStartDate = useCallback(async (d: string) => {
    if (!selectedId) return
    const { error } = await supabase.from('plan24_rosters').update({ pattern_start_date: d || null }).eq('id', selectedId)
    if (error) setErr(error.message); else void loadRosters()
  }, [selectedId, loadRosters])

  const setPatternSlot = useCallback(async (day: number, shiftKind: string, teamId: string | null) => {
    if (!selectedId) return
    setErr(null)
    if (!teamId) {
      await supabase.from('plan24_pattern_slots').delete()
        .eq('roster_id', selectedId).eq('pattern_day', day).eq('shift_kind', shiftKind)
      void loadDetail()
      return
    }
    const existing = pattern.find((p) => p.roster_id === selectedId && p.pattern_day === day && p.shift_kind === shiftKind)
    if (existing) {
      const { error } = await supabase.from('plan24_pattern_slots').update({ team_id: teamId }).eq('id', existing.id)
      if (error) setErr(error.message)
    } else {
      const { error } = await supabase.from('plan24_pattern_slots').insert({
        roster_id: selectedId, pattern_day: day, shift_kind: shiftKind, team_id: teamId,
      })
      if (error) setErr(error.message)
    }
    void loadDetail()
  }, [selectedId, pattern, loadDetail])

  const generateDefaultPattern = useCallback(async () => {
    if (!selectedId || teams.length === 0 || shifts.length === 0) return
    if (!window.confirm('Generate default pattern (2 on / 2 on / 4 off for each team)? This replaces the current pattern.')) return
    setErr(null)
    await supabase.from('plan24_pattern_slots').delete().eq('roster_id', selectedId)
    const sortedTeamsLocal = [...teams].sort((a, b) => a.sort_order - b.sort_order)
    const sortedShiftsLocal = [...shifts].sort((a, b) => a.sort_order - b.sort_order)
    const nTeams = sortedTeamsLocal.length
    const nShifts = sortedShiftsLocal.length
    const rows: { roster_id: string; pattern_day: number; shift_kind: string; team_id: string }[] = []
    for (let day = 1; day <= patternLength; day++) {
      for (let si = 0; si < nShifts; si++) {
        const teamIdx = (Math.floor((day - 1 + si * (patternLength / nShifts)) / 2)) % nTeams
        const team = sortedTeamsLocal[teamIdx]
        if (team) {
          rows.push({ roster_id: selectedId, pattern_day: day, shift_kind: sortedShiftsLocal[si].kind, team_id: team.id })
        }
      }
    }
    if (rows.length) {
      const { error } = await supabase.from('plan24_pattern_slots').insert(rows)
      if (error) setErr(error.message)
    }
    void loadDetail()
  }, [selectedId, teams, shifts, patternLength, loadDetail])

  /* ── roles CRUD ── */
  const addRole = useCallback(async () => {
    if (!selectedId) return
    const next = roles.length ? Math.max(...roles.map((r) => r.sort_order)) + 1 : 0
    const { error } = await supabase.from('plan24_roster_roles').insert({
      roster_id: selectedId, name: `Role ${next + 1}`, sort_order: next, is_active: true,
    })
    if (error) setErr(error.message); else void loadDetail()
  }, [selectedId, roles, loadDetail])

  const saveRole = useCallback(async (row: Plan24RosterRoleRow) => {
    setErr(null)
    const { error } = await supabase.from('plan24_roster_roles').update({
      name: row.name, sort_order: row.sort_order, is_active: row.is_active,
    }).eq('id', row.id)
    if (error) setErr(error.message); else void loadDetail()
  }, [loadDetail])

  const deleteRole = useCallback(async (id: string) => {
    if (!window.confirm('Delete this role?')) return
    const { error } = await supabase.from('plan24_roster_roles').delete().eq('id', id)
    if (error) setErr(error.message); else void loadDetail()
  }, [loadDetail])

  /* ── role-team default person ── */
  const setRoleTeamDefault = useCallback(async (roleId: string, teamId: string, personId: string | null) => {
    setErr(null)
    const existing = roleTeamDefaults.find((d) => d.role_id === roleId && d.team_id === teamId)
    if (existing) {
      if (!personId) {
        await supabase.from('plan24_role_team_defaults').delete().eq('id', existing.id)
      } else {
        await supabase.from('plan24_role_team_defaults').update({ person_id: personId }).eq('id', existing.id)
      }
    } else if (personId) {
      await supabase.from('plan24_role_team_defaults').insert({ role_id: roleId, team_id: teamId, person_id: personId })
    }
    void loadDetail()
  }, [roleTeamDefaults, loadDetail])

  /* ── render guards ── */
  if (status !== 'ready') return <p className="text-sm text-muted">Loading…</p>
  if (!cellId) return <p className="text-sm text-muted">Pick a cell in the scope bar above.</p>

  const sortedTeams = [...teams].sort((a, b) => a.sort_order - b.sort_order)
  const sortedShifts = [...shifts].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-10">
      {err ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{err}</div>
      ) : null}

      {/* ─── Roster selector ─── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Rosters for this cell</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] text-xs text-muted">
            Active / edit roster
            <select className={`${inputClass} mt-1`} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.is_active ? ' (active)' : ''}</option>
              ))}
            </select>
          </label>
          <button type="button" className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold shadow-sm hover:bg-surface-raised/80" onClick={() => void activateRoster()}>
            Make selected roster active
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <input className={`${inputClass} max-w-xs`} placeholder="New roster name" value={newRosterName} onChange={(e) => setNewRosterName(e.target.value)} />
          <button type="button" className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95" onClick={() => void createRoster()}>
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
          {/* ─── 1. Shift Setup ─── */}
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-fg">Shift Setup</h2>
                <p className="mt-0.5 text-xs text-muted">Define the shifts for each day. Default is Day + Night; add Afternoon or others as needed.</p>
              </div>
              <button type="button" className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95" onClick={() => void addShift()}>
                <Plus className="size-3.5" aria-hidden />Add shift
              </button>
            </div>
            <div className="space-y-3">
              {sortedShifts.map((s) => (
                <div key={s.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-canvas/40 p-3">
                  <label className="min-w-[8rem] flex-1 text-xs text-muted">
                    Name
                    <input
                      className={`${inputClass} mt-1`}
                      value={s.display_name ?? s.kind}
                      onChange={(e) => setShifts((prev) => prev.map((x) => x.id === s.id ? { ...x, display_name: e.target.value } : x))}
                      placeholder="e.g. Day"
                    />
                  </label>
                  <div className="min-w-[6rem] text-xs text-muted">
                    ID
                    <div
                      className="mt-1 truncate rounded-xl border border-border bg-canvas/20 px-3 py-2 font-mono text-[11px] text-muted"
                      title="Internal key; locked after creation to keep events and pattern slots in sync."
                    >
                      {s.kind}
                    </div>
                  </div>
                  <label className="min-w-[7rem] text-xs text-muted">
                    Start
                    <input type="time" className={`${inputClass} mt-1`} value={timeInputValue(s.start_local)}
                      onChange={(e) => setShifts((prev) => prev.map((x) => x.id === s.id ? { ...x, start_local: e.target.value } : x))} />
                  </label>
                  <label className="min-w-[7rem] text-xs text-muted">
                    End
                    <input type="time" className={`${inputClass} mt-1`} value={timeInputValue(s.end_local)}
                      onChange={(e) => setShifts((prev) => prev.map((x) => x.id === s.id ? { ...x, end_local: e.target.value } : x))} />
                  </label>
                  <label className="w-16 text-xs text-muted">
                    Order
                    <input type="number" className={`${inputClass} mt-1`} value={s.sort_order}
                      onChange={(e) => setShifts((prev) => prev.map((x) => x.id === s.id ? { ...x, sort_order: Number(e.target.value) || 0 } : x))} />
                  </label>
                  <button type="button" className="rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-surface-raised/80" onClick={() => void saveShift(s)}>Save</button>
                  <button type="button" className="rounded-lg border border-danger/30 px-2 py-2 text-danger hover:bg-danger/10" onClick={() => void deleteShift(s.id)} title="Delete shift">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              {shifts.length === 0 ? <p className="text-xs text-muted">No shifts defined — add at least one.</p> : null}
              <p className="text-[11px] text-muted">
                Display name can change freely. The internal <code className="rounded bg-canvas/40 px-1 font-mono">ID</code> is generated once to keep events and pattern slots linked.
              </p>
            </div>
          </section>

          {/* ─── 2. Teams ─── */}
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-fg">Teams</h2>
                <p className="mt-0.5 text-xs text-muted">Shift crews that rotate through the pattern. E.g. A, B, C, D.</p>
              </div>
              <button type="button" className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95" onClick={() => void addTeam()}>
                <Plus className="size-3.5" aria-hidden />Add team
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {sortedTeams.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-canvas/40 p-3">
                  <span className="size-6 shrink-0 rounded-md" style={{ backgroundColor: t.color }} />
                  <input className={`${inputClass} w-20`} value={t.name}
                    onChange={(e) => setTeams((prev) => prev.map((x) => x.id === t.id ? { ...x, name: e.target.value } : x))} />
                  <select className="rounded-lg border border-border bg-canvas px-1 py-1 text-xs" value={t.color}
                    onChange={(e) => setTeams((prev) => prev.map((x) => x.id === t.id ? { ...x, color: e.target.value } : x))}>
                    {TEAM_COLORS.map((c) => <option key={c} value={c} style={{ backgroundColor: c }}>{c}</option>)}
                  </select>
                  <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-raised/80" onClick={() => void saveTeam(t)}>Save</button>
                  <button type="button" className="rounded-lg border border-danger/30 p-1 text-danger hover:bg-danger/10" onClick={() => void deleteTeam(t.id)} title="Delete team">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              {teams.length === 0 ? <p className="text-xs text-muted">No teams yet.</p> : null}
            </div>
          </section>

          {/* ─── 3. Shift Pattern ─── */}
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold text-fg">Shift Pattern</h2>
              <p className="mt-0.5 text-xs text-muted">
                Set the roster length (pattern repeats after this many days) and assign a team to each shift on each day.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-xs text-muted">
                Roster Length (days)
                <input
                  type="number"
                  min={1}
                  max={56}
                  className={`${inputClass} mt-1 w-24`}
                  defaultValue={patternLength}
                  key={`plen-${selectedId}-${patternLength}`}
                  onBlur={(e) => {
                    const n = Number(e.target.value) || 8
                    if (n !== patternLength) void savePatternLength(n)
                  }}
                />
              </label>
              <label className="text-xs text-muted">
                Start Date
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  defaultValue={selected?.pattern_start_date ?? ''}
                  key={`pstart-${selectedId}-${selected?.pattern_start_date ?? ''}`}
                  onBlur={(e) => {
                    if ((e.target.value || null) !== (selected?.pattern_start_date ?? null)) {
                      void savePatternStartDate(e.target.value)
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void generateDefaultPattern()}
                disabled={shifts.length === 0 || teams.length === 0}
                title={shifts.length === 0 || teams.length === 0 ? 'Add shifts and teams first' : undefined}
              >
                Generate default pattern
              </button>
            </div>
            {shifts.length > 0 && teams.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-muted" />
                      {Array.from({ length: patternLength }, (_, i) => (
                        <th key={i} className="px-2 py-2 text-center text-muted">
                          <div className="text-[10px]">Day {i + 1}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedShifts.map((shift) => (
                      <tr key={shift.kind} className="border-t border-border">
                        <td className="whitespace-nowrap px-2 py-2 font-semibold text-fg">{shift.display_name ?? shift.kind}</td>
                        {Array.from({ length: patternLength }, (_, i) => {
                          const day = i + 1
                          const slot = pattern.find((p) => p.pattern_day === day && p.shift_kind === shift.kind)
                          const team = slot?.team_id ? sortedTeams.find((t) => t.id === slot.team_id) : null
                          return (
                            <td key={i} className="px-1 py-1">
                              <select
                                className="w-full min-w-[2.5rem] rounded-lg border border-border px-1 py-1.5 text-center text-xs font-semibold"
                                style={{ backgroundColor: team ? team.color + '30' : undefined, color: team ? team.color : undefined }}
                                value={slot?.team_id ?? ''}
                                onChange={(e) => void setPatternSlot(day, shift.kind, e.target.value || null)}
                              >
                                <option value="">—</option>
                                {sortedTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted">Add shifts and teams first to configure the pattern.</p>
            )}
          </section>

          {/* ─── 4. Roles & Team Defaults ─── */}
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-fg">Roles</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Roles are Plan 24 column headers. For each role, set the default person per team.
                </p>
              </div>
              <button type="button" className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95" onClick={() => void addRole()}>
                <Plus className="size-3.5" aria-hidden />Add role
              </button>
            </div>
            {roles.length === 0 ? (
              <p className="text-xs text-muted">No roles yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-raised/50 text-xs font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">Role</th>
                      <th className="w-16 px-3 py-2">Sort</th>
                      <th className="px-3 py-2">Active</th>
                      {sortedTeams.map((t) => (
                        <th key={t.id} className="px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            <span className="size-3 rounded-sm" style={{ backgroundColor: t.color }} />
                            {t.name}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((row) => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2">
                          <input className={inputClass} value={row.name}
                            onChange={(e) => setRoles((prev) => prev.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" className={`${inputClass} w-16`} value={row.sort_order}
                            onChange={(e) => setRoles((prev) => prev.map((r) => r.id === row.id ? { ...r, sort_order: Number(e.target.value) || 0 } : r))} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="checkbox" className="size-4" checked={row.is_active}
                            onChange={(e) => setRoles((prev) => prev.map((r) => r.id === row.id ? { ...r, is_active: e.target.checked } : r))} />
                        </td>
                        {sortedTeams.map((t) => {
                          const def = roleTeamDefaults.find((d) => d.role_id === row.id && d.team_id === t.id)
                          return (
                            <td key={t.id} className="px-2 py-2">
                              <select className={inputClass} value={def?.person_id ?? ''}
                                onChange={(e) => void setRoleTeamDefault(row.id, t.id, e.target.value || null)}>
                                <option value="">—</option>
                                {people.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.id.slice(0, 8)}</option>)}
                              </select>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-raised/80" onClick={() => void saveRole(row)}>Save</button>
                            <button type="button" className="rounded-lg border border-danger/30 p-1 text-danger hover:bg-danger/10" onClick={() => void deleteRole(row.id)} title="Delete role">
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
