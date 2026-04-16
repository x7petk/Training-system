/* eslint-disable react-hooks/set-state-in-effect -- intentional workspace resolution + roster auto-select */
/* eslint-disable react-refresh/only-export-components -- colocated provider + useLdrWorkspace hook */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { LdrMasterCellJoin } from './types'
import { isHcObsScopedPath } from './ldrHcObsScope'

/** Master data seed: Darfield site (default LDR workspace for migrated data). */
const LDR_DEFAULT_MASTER_SITE_ID = 'b1000001-0000-4000-8000-000000000001'

const STORAGE_KEY = 'ldr-tools.workspace.v1'
const STORAGE_KEY_HC_OBS = 'ldr-tools.hc-obs-filter.v1'

export type LdrScopeLevel = 'site' | 'cell'

type StoredSelection = {
  level: LdrScopeLevel
  siteId: string
  plantId: string
  cellId: string
}

type HcObsStored = {
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
  /** Workspace for HC / Observation System (cell workspace when a cell is selected, else site). */
  hcObsWorkspaceId: string | null
  scopeLevel: LdrScopeLevel
  setScopeLevel: (l: LdrScopeLevel) => void
  sites: MasterSite[]
  /** All plants (master data). */
  allPlants: MasterPlant[]
  /** All cells (master data). */
  allCells: MasterCell[]
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
  /** Site / plant / cell for Health Checks & Observation System lists, reports, and new flows (independent of Calendar/Roster scope). */
  hcObsSiteId: string
  hcObsPlantId: string
  hcObsCellId: string
  setHcObsSiteId: (id: string) => void
  setHcObsPlantId: (id: string) => void
  setHcObsCellId: (id: string) => void
  /** Resolve site + plant + master cell from a master cell id (for deep links / HC from roster). */
  resolveMasterCellScope: (masterCellId: string | null | undefined) => {
    siteId: string
    plantId: string
    cellId: string
  } | null
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

function loadHcObsStored(): HcObsStored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HC_OBS)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<HcObsStored>
    if (typeof p.siteId !== 'string') return null
    return {
      siteId: p.siteId,
      plantId: typeof p.plantId === 'string' ? p.plantId : '',
      cellId: typeof p.cellId === 'string' ? p.cellId : '',
    }
  } catch {
    return null
  }
}

function saveHcObsStored(s: HcObsStored) {
  try {
    localStorage.setItem(STORAGE_KEY_HC_OBS, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

function sortMaster<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function LdrWorkspaceProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [hcObsWorkspaceId, setHcObsWorkspaceId] = useState<string | null>(null)
  const [scopeLevel, setScopeLevelState] = useState<LdrScopeLevel>('site')
  const [sites, setSites] = useState<MasterSite[]>([])
  const [allPlants, setAllPlants] = useState<MasterPlant[]>([])
  const [allCells, setAllCells] = useState<MasterCell[]>([])
  const [siteId, setSiteIdState] = useState('')
  const [plantId, setPlantIdState] = useState('')
  const [cellId, setCellIdState] = useState('')
  const [hcObsSiteId, setHcObsSiteIdState] = useState('')
  const [hcObsPlantId, setHcObsPlantIdState] = useState('')
  const [hcObsCellId, setHcObsCellIdState] = useState('')
  const prevPathnameRef = useRef<string>('')

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

  const setHcObsSiteId = useCallback((id: string) => {
    setHcObsSiteIdState(id)
    setHcObsPlantIdState('')
    setHcObsCellIdState('')
  }, [])

  const setHcObsPlantId = useCallback((id: string) => {
    setHcObsPlantIdState(id)
    setHcObsCellIdState('')
  }, [])

  const setHcObsCellId = useCallback((id: string) => {
    setHcObsCellIdState(id)
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
      const plantsList = sortMaster((plantsRes.data ?? []) as MasterPlant[])
      const cellsList = sortMaster((cellsRes.data ?? []) as MasterCell[])
      setSites(list)
      setAllPlants(plantsList)
      setAllCells(cellsList)
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
      const hcStored = loadHcObsStored()
      if (hcStored && list.some((s) => s.id === hcStored.siteId)) {
        setHcObsSiteIdState(hcStored.siteId)
        setHcObsPlantIdState(
          hcStored.plantId && plantsList.some((p) => p.id === hcStored.plantId && p.site_id === hcStored.siteId)
            ? hcStored.plantId
            : '',
        )
        const plantOk =
          hcStored.plantId &&
          plantsList.some((p) => p.id === hcStored.plantId && p.site_id === hcStored.siteId)
        setHcObsCellIdState(
          plantOk &&
            hcStored.cellId &&
            cellsList.some((c) => c.id === hcStored.cellId && c.plant_id === hcStored.plantId)
            ? hcStored.cellId
            : '',
        )
      } else {
        setHcObsSiteIdState(fallbackSite)
        setHcObsPlantIdState('')
        setHcObsCellIdState('')
      }
      setStatus('ready')
    }
    void loadMasterData()
    return () => {
      cancelled = true
    }
  }, [])

  /** When navigating from Calendar/Roster into HC/Obs, mirror location from roster scope. */
  useEffect(() => {
    const cur = location.pathname
    const prev = prevPathnameRef.current
    prevPathnameRef.current = cur
    if (status !== 'ready') return
    const nowHc = isHcObsScopedPath(cur)
    const prevHc = isHcObsScopedPath(prev)
    if (nowHc && !prevHc) {
      setHcObsSiteIdState(siteId)
      setHcObsPlantIdState(plantId)
      setHcObsCellIdState(cellId)
      saveHcObsStored({ siteId, plantId, cellId })
    }
  }, [location.pathname, status, siteId, plantId, cellId])

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

  useEffect(() => {
    if (status !== 'ready' || !hcObsSiteId) return
    let cancelled = false
    async function resolveHcObsWs() {
      setHcObsWorkspaceId(null)
      if (hcObsCellId) {
        const { data, error: e } = await supabase.rpc('ldr_ensure_workspace_cell', {
          p_master_cell_id: hcObsCellId,
        })
        if (cancelled) return
        if (!e) {
          const id = typeof data === 'string' ? data : null
          if (id) setHcObsWorkspaceId(id)
        }
      } else {
        const { data, error: e } = await supabase.rpc('ldr_ensure_workspace_site', {
          p_master_site_id: hcObsSiteId,
        })
        if (cancelled) return
        if (!e) {
          const id = typeof data === 'string' ? data : null
          if (id) setHcObsWorkspaceId(id)
        }
      }
      saveHcObsStored({ siteId: hcObsSiteId, plantId: hcObsPlantId, cellId: hcObsCellId })
    }
    void resolveHcObsWs()
    return () => {
      cancelled = true
    }
  }, [status, hcObsSiteId, hcObsPlantId, hcObsCellId])

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

  const resolveMasterCellScope = useCallback(
    (masterCellId: string | null | undefined) => {
      if (!masterCellId) return null
      const cell = allCells.find((c) => c.id === masterCellId)
      if (!cell) return null
      const plant = allPlants.find((p) => p.id === cell.plant_id)
      if (!plant) return null
      return { siteId: plant.site_id, plantId: plant.id, cellId: cell.id }
    },
    [allCells, allPlants],
  )

  const value = useMemo<Ctx>(
    () => ({
      status,
      error,
      workspaceId,
      hcObsWorkspaceId,
      scopeLevel,
      setScopeLevel,
      sites,
      allPlants,
      allCells,
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
      hcObsSiteId,
      hcObsPlantId,
      hcObsCellId,
      setHcObsSiteId,
      setHcObsPlantId,
      setHcObsCellId,
      resolveMasterCellScope,
    }),
    [
      status,
      error,
      workspaceId,
      hcObsWorkspaceId,
      scopeLevel,
      setScopeLevel,
      sites,
      allPlants,
      allCells,
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
      hcObsSiteId,
      hcObsPlantId,
      hcObsCellId,
      setHcObsSiteId,
      setHcObsPlantId,
      setHcObsCellId,
      resolveMasterCellScope,
    ],
  )

  return <LdrWorkspaceContext.Provider value={value}>{children}</LdrWorkspaceContext.Provider>
}

export function useLdrWorkspace(): Ctx {
  const ctx = useContext(LdrWorkspaceContext)
  if (!ctx) throw new Error('useLdrWorkspace must be used under LdrWorkspaceProvider')
  return ctx
}
