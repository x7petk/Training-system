import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, ListTree, Pencil, Plus, Table2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Site = { id: string; name: string; sort_order: number }
type Plant = { id: string; site_id: string; name: string; sort_order: number }
type Cell = { id: string; plant_id: string; name: string; sort_order: number }
type Area = { id: string; cell_id: string; name: string; sort_order: number }
type Equipment = { id: string; area_id: string; name: string; sort_order: number }

function sortByOrder<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

function LevelBadge({ level }: { level: 'Site' | 'Plant' | 'Cell' | 'Area' | 'Equipment' }) {
  const styles: Record<string, string> = {
    Site:
      'border border-teal-800/15 bg-teal-100 text-teal-950 dark:border-teal-400/25 dark:bg-teal-950/80 dark:text-teal-50',
    Plant:
      'border border-violet-800/15 bg-violet-100 text-violet-950 dark:border-violet-400/25 dark:bg-violet-950/80 dark:text-violet-50',
    Cell:
      'border border-sky-800/15 bg-sky-100 text-sky-950 dark:border-sky-400/25 dark:bg-sky-950/80 dark:text-sky-50',
    Area:
      'border border-amber-800/20 bg-amber-100 text-amber-950 dark:border-amber-400/25 dark:bg-amber-950/80 dark:text-amber-50',
    Equipment:
      'border border-slate-500/25 bg-slate-200 text-slate-950 dark:border-slate-500/40 dark:bg-slate-800 dark:text-slate-100',
  }
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[level]}`}
    >
      {level}
    </span>
  )
}

function IconButton(props: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        props.onClick()
      }}
      className="shrink-0 rounded-lg p-2 text-fg/55 hover:bg-danger/10 hover:text-danger"
      aria-label={props.label}
    >
      {props.children}
    </button>
  )
}

function EditableName(props: {
  name: string
  onRename: (name: string) => void | Promise<void>
  textClassName: string
  inputClassName: string
  ariaLabel: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.name)

  useEffect(() => {
    if (!editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset draft when server name changes while not editing
      setDraft(props.name)
    }
  }, [props.name, editing])

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(props.name)
            setEditing(false)
          }
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        onBlur={() => {
          const n = draft.trim()
          setEditing(false)
          if (!n || n === props.name) {
            setDraft(props.name)
            return
          }
          void props.onRename(n)
        }}
        className={props.inputClassName}
        aria-label={props.ariaLabel}
      />
    )
  }

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span className={`min-w-0 truncate ${props.textClassName}`}>{props.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setEditing(true)
        }}
        className="shrink-0 rounded-md p-1 text-fg/45 hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/10"
        aria-label={`Rename ${props.ariaLabel}`}
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
    </span>
  )
}

function AddRow(props: {
  placeholder: string
  buttonLabel: string
  onAdd: (name: string) => void
  dense?: boolean
}) {
  const [name, setName] = useState('')
  return (
    <form
      className={`flex flex-wrap items-center gap-2 ${props.dense ? '' : 'mt-2'}`}
      onSubmit={(e) => {
        e.preventDefault()
        const n = name.trim()
        if (!n) return
        props.onAdd(n)
        setName('')
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={props.placeholder}
        className="min-w-[8rem] flex-1 rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg placeholder:text-muted"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-xs font-semibold text-fg hover:border-accent/50 hover:bg-accent-dim/40"
      >
        <Plus className="size-3.5" aria-hidden />
        {props.buttonLabel}
      </button>
    </form>
  )
}

export function MasterDataStructurePage() {
  const [view, setView] = useState<'cascade' | 'paths'>('cascade')
  const [sites, setSites] = useState<Site[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const [s, p, c, a, e] = await Promise.all([
      supabase.from('master_sites').select('id, name, sort_order').order('sort_order').order('name'),
      supabase.from('master_plants').select('id, site_id, name, sort_order').order('sort_order').order('name'),
      supabase.from('master_cells').select('id, plant_id, name, sort_order').order('sort_order').order('name'),
      supabase.from('master_areas').select('id, cell_id, name, sort_order').order('sort_order').order('name'),
      supabase.from('master_equipment').select('id, area_id, name, sort_order').order('sort_order').order('name'),
    ])
    const err = s.error || p.error || c.error || a.error || e.error
    if (err) setError(err.message)
    else {
      setSites((s.data ?? []) as Site[])
      setPlants((p.data ?? []) as Plant[])
      setCells((c.data ?? []) as Cell[])
      setAreas((a.data ?? []) as Area[])
      setEquipment((e.data ?? []) as Equipment[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load() updates master data after fetch
    void load()
  }, [load])

  const plantsBySite = useMemo(() => {
    const m = new Map<string, Plant[]>()
    for (const pl of plants) {
      if (!m.has(pl.site_id)) m.set(pl.site_id, [])
      m.get(pl.site_id)!.push(pl)
    }
    for (const [, list] of m) sortByOrder(list)
    return m
  }, [plants])

  const cellsByPlant = useMemo(() => {
    const m = new Map<string, Cell[]>()
    for (const ce of cells) {
      if (!m.has(ce.plant_id)) m.set(ce.plant_id, [])
      m.get(ce.plant_id)!.push(ce)
    }
    for (const [, list] of m) sortByOrder(list)
    return m
  }, [cells])

  const areasByCell = useMemo(() => {
    const m = new Map<string, Area[]>()
    for (const ar of areas) {
      if (!m.has(ar.cell_id)) m.set(ar.cell_id, [])
      m.get(ar.cell_id)!.push(ar)
    }
    for (const [, list] of m) sortByOrder(list)
    return m
  }, [areas])

  const equipmentByArea = useMemo(() => {
    const m = new Map<string, Equipment[]>()
    for (const eq of equipment) {
      if (!m.has(eq.area_id)) m.set(eq.area_id, [])
      m.get(eq.area_id)!.push(eq)
    }
    for (const [, list] of m) sortByOrder(list)
    return m
  }, [equipment])

  const equipmentPathRows = useMemo(() => {
    type Row = {
      equipmentId: string
      pathPrefix: string
      eqName: string
      sortKey: string
    }
    const rows: Row[] = []
    for (const site of sortByOrder(sites)) {
      for (const plant of plantsBySite.get(site.id) ?? []) {
        for (const cell of cellsByPlant.get(plant.id) ?? []) {
          for (const area of areasByCell.get(cell.id) ?? []) {
            for (const eq of equipmentByArea.get(area.id) ?? []) {
              rows.push({
                equipmentId: eq.id,
                eqName: eq.name,
                pathPrefix: `${site.name} → ${plant.name} → ${cell.name} → ${area.name} → `,
                sortKey: `${site.name} → ${plant.name} → ${cell.name} → ${area.name} → ${eq.name}`,
              })
            }
          }
        }
      }
    }
    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return rows
  }, [sites, plantsBySite, cellsByPlant, areasByCell, equipmentByArea])

  async function addSite(name: string) {
    setError(null)
    const next = sites.length ? Math.max(...sites.map((x) => x.sort_order)) + 1 : 0
    const { error: e } = await supabase.from('master_sites').insert({ name, sort_order: next })
    if (e) setError(e.message)
    else await load()
  }

  async function addPlant(siteId: string, name: string) {
    setError(null)
    const sibs = plants.filter((p) => p.site_id === siteId)
    const next = sibs.length ? Math.max(...sibs.map((x) => x.sort_order)) + 1 : 0
    const { error: e } = await supabase.from('master_plants').insert({ site_id: siteId, name, sort_order: next })
    if (e) setError(e.message)
    else await load()
  }

  async function addCell(plantId: string, name: string) {
    setError(null)
    const sibs = cells.filter((c) => c.plant_id === plantId)
    const next = sibs.length ? Math.max(...sibs.map((x) => x.sort_order)) + 1 : 0
    const { error: e } = await supabase.from('master_cells').insert({ plant_id: plantId, name, sort_order: next })
    if (e) setError(e.message)
    else await load()
  }

  async function addArea(cellId: string, name: string) {
    setError(null)
    const sibs = areas.filter((a) => a.cell_id === cellId)
    const next = sibs.length ? Math.max(...sibs.map((x) => x.sort_order)) + 1 : 0
    const { error: e } = await supabase.from('master_areas').insert({ cell_id: cellId, name, sort_order: next })
    if (e) setError(e.message)
    else await load()
  }

  async function addEquipment(areaId: string, name: string) {
    setError(null)
    const sibs = equipment.filter((q) => q.area_id === areaId)
    const next = sibs.length ? Math.max(...sibs.map((x) => x.sort_order)) + 1 : 0
    const { error: e } = await supabase.from('master_equipment').insert({ area_id: areaId, name, sort_order: next })
    if (e) setError(e.message)
    else await load()
  }

  async function removeSite(id: string, label: string) {
    if (!window.confirm(`Delete site "${label}" and everything under it (plants, cells, areas, equipment)?`)) return
    setError(null)
    const { error: e } = await supabase.from('master_sites').delete().eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function removePlant(id: string, label: string) {
    if (!window.confirm(`Delete plant "${label}" and all cells, areas, and equipment under it?`)) return
    setError(null)
    const { error: e } = await supabase.from('master_plants').delete().eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function removeCell(id: string, label: string) {
    if (!window.confirm(`Delete cell "${label}" and all areas and equipment under it?`)) return
    setError(null)
    const { error: e } = await supabase.from('master_cells').delete().eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function removeArea(id: string, label: string) {
    if (!window.confirm(`Delete area "${label}" and all equipment under it?`)) return
    setError(null)
    const { error: e } = await supabase.from('master_areas').delete().eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function removeEquipment(id: string, label: string) {
    if (!window.confirm(`Delete equipment "${label}"?`)) return
    setError(null)
    const { error: e } = await supabase.from('master_equipment').delete().eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function renameSite(id: string, name: string) {
    setError(null)
    const n = name.trim()
    if (!n) return
    const { error: e } = await supabase.from('master_sites').update({ name: n }).eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function renamePlant(id: string, name: string) {
    setError(null)
    const n = name.trim()
    if (!n) return
    const { error: e } = await supabase.from('master_plants').update({ name: n }).eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function renameCell(id: string, name: string) {
    setError(null)
    const n = name.trim()
    if (!n) return
    const { error: e } = await supabase.from('master_cells').update({ name: n }).eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function renameArea(id: string, name: string) {
    setError(null)
    const n = name.trim()
    if (!n) return
    const { error: e } = await supabase.from('master_areas').update({ name: n }).eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  async function renameEquipment(id: string, name: string) {
    setError(null)
    const n = name.trim()
    if (!n) return
    const { error: e } = await supabase.from('master_equipment').update({ name: n }).eq('id', id)
    if (e) setError(e.message)
    else await load()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Structure</h1>
          <p className="mt-1 max-w-2xl text-sm text-fg/75">
            Site → plant → cell → area → equipment. Use <strong className="font-medium text-fg">Cascade</strong> to edit
            in a top-down tree, or <strong className="font-medium text-fg">Path list</strong> to scan every equipment line
            in one column.
          </p>
        </div>
        <div
          className="inline-flex shrink-0 rounded-xl border border-border bg-slate-950/5 p-1 dark:bg-white/5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setView('cascade')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              view === 'cascade'
                ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                : 'text-fg/80 hover:bg-slate-950/5 hover:text-fg dark:hover:bg-white/10'
            }`}
          >
            <ListTree className="size-3.5 opacity-90" aria-hidden />
            Cascade
          </button>
          <button
            type="button"
            onClick={() => setView('paths')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              view === 'paths'
                ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                : 'text-fg/80 hover:bg-slate-950/5 hover:text-fg dark:hover:bg-white/10'
            }`}
          >
            <Table2 className="size-3.5 opacity-90" aria-hidden />
            Path list
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-fg/70">Loading…</p>
      ) : view === 'paths' ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-border-strong bg-surface shadow-sm">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-border-strong bg-surface-raised/80 text-xs font-semibold uppercase tracking-wider text-fg/80">
                <tr>
                  <th className="px-4 py-3">Path</th>
                  <th className="min-w-[10rem] px-4 py-3">Equipment name</th>
                  <th className="w-24 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {equipmentPathRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-fg/65">
                      No equipment rows yet. Switch to Cascade to add structure, or add sites first.
                    </td>
                  </tr>
                ) : (
                  equipmentPathRows.map((row) => (
                    <tr key={row.equipmentId} className="bg-canvas/35 even:bg-surface-raised/40">
                      <td className="px-4 py-2.5 font-mono text-[13px] leading-relaxed text-fg/90">
                        {row.pathPrefix}
                      </td>
                      <td className="px-4 py-2.5">
                        <EditableName
                          name={row.eqName}
                          onRename={(n) => void renameEquipment(row.equipmentId, n)}
                          textClassName="font-mono text-[13px] font-medium text-fg"
                          inputClassName="w-full min-w-[8rem] rounded-lg border border-border-strong bg-surface px-2 py-1 font-mono text-[13px] text-fg"
                          ariaLabel={`equipment ${row.eqName}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void removeEquipment(row.equipmentId, row.eqName)}
                          className="inline-flex rounded-lg p-2 text-fg/55 hover:bg-danger/10 hover:text-danger"
                          aria-label={`Delete ${row.eqName}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-fg/70">
            To add or remove sites through areas, switch to <strong className="font-medium text-fg">Cascade</strong>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-strong bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg/75">Add site</p>
            <AddRow placeholder="Site name" buttonLabel="Add site" onAdd={(n) => void addSite(n)} />
          </div>

          {sortByOrder(sites).map((site) => (
            <details
              key={site.id}
              className="group overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-sm open:shadow-md"
              open
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 bg-gradient-to-r from-teal-100/90 via-teal-50/50 to-surface px-4 py-3.5 dark:from-teal-950/50 dark:via-teal-950/20 dark:to-surface [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 text-teal-800 transition-transform group-open:rotate-90 dark:text-teal-200" />
                <LevelBadge level="Site" />
                <EditableName
                  name={site.name}
                  onRename={(n) => void renameSite(site.id, n)}
                  textClassName="font-display text-lg font-semibold tracking-tight text-fg"
                  inputClassName="min-w-[10rem] flex-1 rounded-lg border border-border-strong bg-surface px-2 py-1 font-display text-lg font-semibold text-fg"
                  ariaLabel={`site ${site.name}`}
                />
                <IconButton label={`Delete site ${site.name}`} onClick={() => void removeSite(site.id, site.name)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </summary>

              <div className="border-t border-border-strong bg-surface-raised/50 px-4 py-4 dark:bg-surface-raised/30">
                <AddRow
                  placeholder="New plant name"
                  buttonLabel="Add plant"
                  onAdd={(n) => void addPlant(site.id, n)}
                />

                <div className="mt-4 space-y-5 border-l-[3px] border-teal-600/35 pl-4 dark:border-teal-500/45">
                  {(plantsBySite.get(site.id) ?? []).map((plant) => (
                    <div key={plant.id} className="relative">
                      <div className="absolute -left-4 top-3 h-px w-3 bg-teal-600/40 dark:bg-teal-400/50" aria-hidden />
                      <div className="flex flex-wrap items-center gap-2 border-b border-border-strong pb-2">
                        <LevelBadge level="Plant" />
                        <EditableName
                          name={plant.name}
                          onRename={(n) => void renamePlant(plant.id, n)}
                          textClassName="text-base font-semibold text-fg"
                          inputClassName="min-w-[8rem] max-w-full rounded-lg border border-border-strong bg-surface px-2 py-1 text-base font-semibold text-fg"
                          ariaLabel={`plant ${plant.name}`}
                        />
                        <IconButton
                          label={`Delete plant ${plant.name}`}
                          onClick={() => void removePlant(plant.id, plant.name)}
                        >
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </div>

                      <div className="ml-1 mt-3 space-y-4 border-l-[3px] border-violet-600/35 pl-4 dark:border-violet-500/45">
                        <AddRow
                          dense
                          placeholder="New cell name"
                          buttonLabel="Add cell"
                          onAdd={(n) => void addCell(plant.id, n)}
                        />
                        {(cellsByPlant.get(plant.id) ?? []).map((cell) => (
                          <div key={cell.id} className="relative">
                            <div className="absolute -left-4 top-2.5 h-px w-3 bg-violet-600/40 dark:bg-violet-400/50" aria-hidden />
                            <div className="flex flex-wrap items-center gap-2">
                              <LevelBadge level="Cell" />
                              <EditableName
                                name={cell.name}
                                onRename={(n) => void renameCell(cell.id, n)}
                                textClassName="font-medium text-fg"
                                inputClassName="min-w-[7rem] max-w-full rounded-lg border border-border-strong bg-surface px-2 py-1 text-sm font-medium text-fg"
                                ariaLabel={`cell ${cell.name}`}
                              />
                              <IconButton
                                label={`Delete cell ${cell.name}`}
                                onClick={() => void removeCell(cell.id, cell.name)}
                              >
                                <Trash2 className="size-3.5" />
                              </IconButton>
                            </div>

                            <div className="ml-0 mt-3 space-y-3 border-l-[3px] border-sky-600/35 pl-4 dark:border-sky-500/45">
                              <AddRow
                                dense
                                placeholder="New area name"
                                buttonLabel="Add area"
                                onAdd={(n) => void addArea(cell.id, n)}
                              />
                              {(areasByCell.get(cell.id) ?? []).map((area) => (
                                <div key={area.id} className="relative">
                                  <div className="absolute -left-4 top-2 h-px w-3 bg-sky-600/40 dark:bg-sky-400/50" aria-hidden />
                                  <div className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 shadow-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <LevelBadge level="Area" />
                                      <EditableName
                                        name={area.name}
                                        onRename={(n) => void renameArea(area.id, n)}
                                        textClassName="font-medium text-fg"
                                        inputClassName="min-w-[7rem] max-w-full rounded-lg border border-border-strong bg-surface px-2 py-1 text-sm font-medium text-fg"
                                        ariaLabel={`area ${area.name}`}
                                      />
                                      <IconButton
                                        label={`Delete area ${area.name}`}
                                        onClick={() => void removeArea(area.id, area.name)}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </IconButton>
                                    </div>
                                    <AddRow
                                      dense
                                      placeholder="Equipment name"
                                      buttonLabel="Add equipment"
                                      onAdd={(n) => void addEquipment(area.id, n)}
                                    />
                                    <ul className="mt-2 space-y-1.5 border-l-[3px] border-amber-600/30 pl-3 dark:border-amber-500/40">
                                      {(equipmentByArea.get(area.id) ?? []).map((eq) => (
                                        <li
                                          key={eq.id}
                                          className="flex flex-wrap items-center gap-2 text-sm text-fg"
                                        >
                                          <span className="font-mono text-fg/45" aria-hidden>
                                            └
                                          </span>
                                          <LevelBadge level="Equipment" />
                                          <EditableName
                                            name={eq.name}
                                            onRename={(n) => void renameEquipment(eq.id, n)}
                                            textClassName="font-medium"
                                            inputClassName="min-w-[6rem] max-w-full flex-1 rounded-lg border border-border-strong bg-surface px-2 py-1 text-sm font-medium text-fg"
                                            ariaLabel={`equipment ${eq.name}`}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => void removeEquipment(eq.id, eq.name)}
                                            className="ml-auto rounded p-1 text-fg/55 hover:bg-danger/10 hover:text-danger md:ml-0"
                                            aria-label={`Delete ${eq.name}`}
                                          >
                                            <Trash2 className="size-3.5" />
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
