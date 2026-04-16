/* eslint-disable react-refresh/only-export-components -- provider + hook */
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

/** Darfield · Powder · Powder cell — seeded demo cell with Plan 24 roster. */
export const PLAN24_DEFAULT_MASTER_CELL_ID = 'b3000001-0000-4000-8000-000000000001'

const STORAGE_KEY = 'rtt-systems.plan24.scope.v1'

type MasterSite = { id: string; name: string; sort_order: number }
type MasterPlant = { id: string; site_id: string; name: string; sort_order: number }
type MasterCell = { id: string; plant_id: string; name: string; sort_order: number }

type Stored = { siteId: string; plantId: string; cellId: string }

type Ctx = {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  sites: MasterSite[]
  plants: MasterPlant[]
  cells: MasterCell[]
  siteId: string
  plantId: string
  cellId: string
  setSiteId: (id: string) => void
  setPlantId: (id: string) => void
  setCellId: (id: string) => void
  resolveMasterCellScope: (masterCellId: string | null | undefined) => {
    siteId: string
    plantId: string
    cellId: string
  } | null
}

const Plan24WorkspaceContext = createContext<Ctx | null>(null)

function loadStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Stored>
    if (typeof p.siteId !== 'string' || typeof p.plantId !== 'string' || typeof p.cellId !== 'string') return null
    return { siteId: p.siteId, plantId: p.plantId, cellId: p.cellId }
  } catch {
    return null
  }
}

function saveStored(s: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

function sortMaster<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function Plan24WorkspaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [sites, setSites] = useState<MasterSite[]>([])
  const [allPlants, setAllPlants] = useState<MasterPlant[]>([])
  const [allCells, setAllCells] = useState<MasterCell[]>([])
  const [siteId, setSiteIdState] = useState('')
  const [plantId, setPlantIdState] = useState('')
  const [cellId, setCellIdState] = useState('')

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
    async function load() {
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
      const siteList = sortMaster((sitesRes.data ?? []) as MasterSite[])
      const plantList = sortMaster((plantsRes.data ?? []) as MasterPlant[])
      const cellList = sortMaster((cellsRes.data ?? []) as MasterCell[])
      setSites(siteList)
      setAllPlants(plantList)
      setAllCells(cellList)

      const stored = loadStored()
      const resolved = resolveScopeFromCellId(PLAN24_DEFAULT_MASTER_CELL_ID, siteList, plantList, cellList)
      if (stored) {
        const cellOk = cellList.some((c) => c.id === stored.cellId)
        const plantOk = plantList.some((p) => p.id === stored.plantId)
        const siteOk = siteList.some((s) => s.id === stored.siteId)
        if (siteOk && plantOk && cellOk) {
          setSiteIdState(stored.siteId)
          setPlantIdState(stored.plantId)
          setCellIdState(stored.cellId)
        } else if (resolved) {
          setSiteIdState(resolved.siteId)
          setPlantIdState(resolved.plantId)
          setCellIdState(resolved.cellId)
          saveStored(resolved)
        }
      } else if (resolved) {
        setSiteIdState(resolved.siteId)
        setPlantIdState(resolved.plantId)
        setCellIdState(resolved.cellId)
        saveStored(resolved)
      } else if (siteList[0]) {
        setSiteIdState(siteList[0].id)
      }
      setStatus('ready')
    }
    void load()
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

  useEffect(() => {
    if (status !== 'ready' || !siteId) return
    if (plants.length && !plants.some((p) => p.id === plantId)) {
      const next = plants[0]?.id ?? ''
      if (next !== plantId) {
        setPlantIdState(next)
        setCellIdState('')
      }
    }
  }, [status, siteId, plants, plantId])

  useEffect(() => {
    if (status !== 'ready' || !plantId) return
    if (cells.length && !cells.some((c) => c.id === cellId)) {
      const next = cells[0]?.id ?? ''
      if (next !== cellId) setCellIdState(next)
    }
  }, [status, plantId, cells, cellId])

  useEffect(() => {
    if (status !== 'ready') return
    if (!siteId || !plantId || !cellId) return
    saveStored({ siteId, plantId, cellId })
  }, [status, siteId, plantId, cellId])

  const resolveMasterCellScope = useCallback(
    (masterCellId: string | null | undefined) => {
      if (!masterCellId) return null
      return resolveScopeFromCellId(masterCellId, sites, allPlants, allCells)
    },
    [sites, allPlants, allCells],
  )

  const value = useMemo<Ctx>(
    () => ({
      status,
      error,
      sites,
      plants,
      cells,
      siteId,
      plantId,
      cellId,
      setSiteId,
      setPlantId,
      setCellId,
      resolveMasterCellScope,
    }),
    [status, error, sites, plants, cells, siteId, plantId, cellId, setSiteId, setPlantId, setCellId, resolveMasterCellScope],
  )

  return <Plan24WorkspaceContext.Provider value={value}>{children}</Plan24WorkspaceContext.Provider>
}

function resolveScopeFromCellId(
  masterCellId: string,
  siteList: MasterSite[],
  plantList: MasterPlant[],
  cellList: MasterCell[],
): Stored | null {
  const cell = cellList.find((c) => c.id === masterCellId)
  if (!cell) return null
  const plant = plantList.find((p) => p.id === cell.plant_id)
  if (!plant) return null
  if (!siteList.some((s) => s.id === plant.site_id)) return null
  return { siteId: plant.site_id, plantId: plant.id, cellId: cell.id }
}

export function usePlan24Workspace(): Ctx {
  const ctx = useContext(Plan24WorkspaceContext)
  if (!ctx) throw new Error('usePlan24Workspace must be used under Plan24WorkspaceProvider')
  return ctx
}
