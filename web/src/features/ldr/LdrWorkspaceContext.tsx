/* eslint-disable react-refresh/only-export-components -- colocated provider + useLdrWorkspace hook */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../../lib/supabase'
import type { LdrMasterCellJoin } from './types'

/** Master data seed: Darfield site (default LDR workspace for migrated data). */
const LDR_DEFAULT_MASTER_SITE_ID = 'b1000001-0000-4000-8000-000000000001'

const STORAGE_KEY = 'ldr-tools.workspace.v1'

export type LdrScopeLevel = 'site' | 'cell'

type StoredSelection = {
  level: LdrScopeLevel
  siteId: string
  plantId: string
  cellId: string
}

type MasterSite = { id: string; name: string; sort_order: number }
type MasterPlant = { id: string; site_id: string; name: string; sort_order: number }
type MasterCell = { id: string; plant_id: string; name: string; sort_order: number }

export type LdrSiteCellOption = { id: string; label: string }

type Ctx = {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  workspaceId: string | null
  scopeLevel: LdrScopeLevel
  setScopeLevel: (l: LdrScopeLevel) => void
  sites: MasterSite[]
  plants: MasterPlant[]
  cells: MasterCell[]
  /** Master cells under the currently selected site (all plants), for LDR location pickers. */
  siteCellOptions: LdrSiteCellOption[]
  /** Plant + cell labels by master cell id (from cached master lists; use instead of PostgREST embed). */
  masterCellJoinById: ReadonlyMap<string, LdrMasterCellJoin>
  siteId: string
  plantId: string
  cellId: string
  setSiteId: (id: string) => void
  setPlantId: (id: string) => void
  setCellId: (id: string) => void
}

const LdrWorkspaceContext = createContext<Ctx | null>(null)

function loadStored(): StoredSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<StoredSelection>
    if (p.level !== 'site' && p.level !== 'cell') return null
    if (typeof p.siteId !== 'string') return null
    return {
      level: p.level,
      siteId: p.siteId,
      plantId: typeof p.plantId === 'string' ? p.plantId : '',
      cellId: typeof p.cellId === 'string' ? p.cellId : '',
    }
  } catch {
    return null
  }
}

function saveStored(s: StoredSelection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

function sortMaster<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function LdrWorkspaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [scopeLevel, setScopeLevelState] = useState<LdrScopeLevel>('site')
  const [sites, setSites] = useState<MasterSite[]>([])
  const [allPlants, setAllPlants] = useState<MasterPlant[]>([])
  const [allCells, setAllCells] = useState<MasterCell[]>([])
  const [siteId, setSiteIdState] = useState('')
  const [plantId, setPlantIdState] = useState('')
  const [cellId, setCellIdState] = useState('')

  const setScopeLevel = useCallback((l: LdrScopeLevel) => {
    setScopeLevelState(l)
  }, [])

  const setSiteId = useCallback((id: string) => {
    setSiteIdState(id)
    setPlantIdState('')
    setCellIdState('')
  }, [])

  const setPlantId = useCallback((id: string) => {
    setPlantIdState(id)
    setCellIdState('')
  }, [])

  const setCellId = useCallback((id: string) => {
    setCellIdState(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadMasterData() {
      setError(null)
      const [sitesRes, plantsRes, cellsRes] = await Promise.all([
        supabase.from('master_sites').select('id, name, sort_order').order('sort_order').order('name'),
        supabase.from('master_plants').select('id, site_id, name, sort_order').order('sort_order').order('name'),
        supabase.from('master_cells').select('id, plant_id, name, sort_order').order('sort_order').order('name'),
      ])
      if (cancelled) return
      const e = sitesRes.error || plantsRes.error || cellsRes.error
      if (e) {
        setError(e.message)
        setStatus('error')
        return
      }
      const list = sortMaster((sitesRes.data ?? []) as MasterSite[])
      setSites(list)
      setAllPlants(sortMaster((plantsRes.data ?? []) as MasterPlant[]))
      setAllCells(sortMaster((cellsRes.data ?? []) as MasterCell[]))
      const stored = loadStored()
      const fallbackSite = list.find((s) => s.id === LDR_DEFAULT_MASTER_SITE_ID)?.id ?? list[0]?.id ?? ''
      if (stored) {
        setScopeLevelState(stored.level)
        setSiteIdState(stored.siteId && list.some((s) => s.id === stored.siteId) ? stored.siteId : fallbackSite)
        setPlantIdState(stored.plantId)
        setCellIdState(stored.cellId)
      } else {
        setSiteIdState(fallbackSite)
      }
      setStatus('ready')
    }
    void loadMasterData()
    return () => {
      cancelled = true
    }
  }, [])

  const plants = useMemo(
    () => sortMaster(allPlants.filter((plant) => plant.site_id === siteId)),
    [allPlants, siteId],
  )

  const cells = useMemo(
    () => sortMaster(allCells.filter((cell) => cell.plant_id === plantId)),
    [allCells, plantId],
  )

  if (scopeLevel === 'cell' && plants.length > 0 && !plants.some((p) => p.id === plantId)) {
    const next = plants[0]?.id ?? ''
    if (next !== plantId) setPlantIdState(next)
  }
  if (scopeLevel === 'cell' && cells.length > 0 && !cells.some((c) => c.id === cellId)) {
    const next = cells[0]?.id ?? ''
    if (next !== cellId) setCellIdState(next)
  }

  useEffect(() => {
    if (status !== 'ready' || !siteId) return
    if (scopeLevel === 'cell' && (!plantId || !cellId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear workspace until cell scope is fully selected
      setWorkspaceId(null)
      setError(null)
      return
    }
    let cancelled = false
    async function resolveWorkspace() {
      setWorkspaceId(null)
      setError(null)
      if (scopeLevel === 'site') {
        const { data, error: e } = await supabase.rpc('ldr_ensure_workspace_site', {
          p_master_site_id: siteId,
        })
        if (cancelled) return
        if (e) {
          setError(e.message)
          return
        }
        const id = typeof data === 'string' ? data : null
        if (id) setWorkspaceId(id)
        saveStored({ level: 'site', siteId, plantId: '', cellId: '' })
        return
      }
      const { data, error: e } = await supabase.rpc('ldr_ensure_workspace_cell', {
        p_master_cell_id: cellId,
      })
      if (cancelled) return
      if (e) {
        setError(e.message)
        return
      }
      const id = typeof data === 'string' ? data : null
      if (id) setWorkspaceId(id)
      saveStored({ level: 'cell', siteId, plantId, cellId })
    }
    void resolveWorkspace()
    return () => {
      cancelled = true
    }
  }, [status, scopeLevel, siteId, plantId, cellId])

  const siteCellOptions = useMemo<LdrSiteCellOption[]>(() => {
    if (!siteId) return []
    const plantsHere = sortMaster(allPlants.filter((plant) => plant.site_id === siteId))
    const out: LdrSiteCellOption[] = []
    for (const plant of plantsHere) {
      for (const cell of sortMaster(allCells.filter((c) => c.plant_id === plant.id))) {
        out.push({ id: cell.id, label: `${plant.name} · ${cell.name}` })
      }
    }
    return out
  }, [siteId, allPlants, allCells])

  const masterCellJoinById = useMemo(() => {
    const m = new Map<string, LdrMasterCellJoin>()
    const plantById = new Map(allPlants.map((p) => [p.id, p]))
    for (const cell of allCells) {
      const plant = plantById.get(cell.plant_id)
      m.set(cell.id, {
        name: cell.name,
        master_plants: plant ? { name: plant.name } : undefined,
      })
    }
    return m
  }, [allPlants, allCells])

  const value = useMemo<Ctx>(
    () => ({
      status,
      error,
      workspaceId,
      scopeLevel,
      setScopeLevel,
      sites,
      plants,
      cells,
      siteCellOptions,
      masterCellJoinById,
      siteId,
      plantId,
      cellId,
      setSiteId,
      setPlantId,
      setCellId,
    }),
    [
      status,
      error,
      workspaceId,
      scopeLevel,
      setScopeLevel,
      sites,
      plants,
      cells,
      siteCellOptions,
      masterCellJoinById,
      siteId,
      plantId,
      cellId,
      setSiteId,
      setPlantId,
      setCellId,
    ],
  )

  return <LdrWorkspaceContext.Provider value={value}>{children}</LdrWorkspaceContext.Provider>
}

export function useLdrWorkspace(): Ctx {
  const ctx = useContext(LdrWorkspaceContext)
  if (!ctx) throw new Error('useLdrWorkspace must be used under LdrWorkspaceProvider')
  return ctx
}
