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
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { addDays, localYMD } from '../../lib/dueDateUtils'
import { MIN_PLAN_YMD, PLAN24_VISIBLE_DAYS_AHEAD } from '../plan24/plan24DateBounds'
import { usePlan24Workspace } from '../plan24/Plan24WorkspaceContext'
import type { DdsP2pSummaryRosterRole, DdsP2pSummaryShiftRow } from './DdsP2pSummaryBody'

function sortGroups<T extends { sort_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

/** Day + shift strip in the scope bar (Shift / Line / Plant / Site DDS share roster shell). */
function isDdsDayShiftShellPath(pathname: string): boolean {
  return (
    pathname.endsWith('/shift-dds') ||
    pathname.includes('/dds-process/shift-dds') ||
    pathname.endsWith('/line-dds') ||
    pathname.includes('/dds-process/line-dds') ||
    pathname.endsWith('/plant-dds') ||
    pathname.includes('/dds-process/plant-dds') ||
    pathname.endsWith('/site-dds') ||
    pathname.includes('/dds-process/site-dds') ||
    pathname.endsWith('/triggers') ||
    pathname.includes('/dds-process/triggers')
  )
}

/** Date-only strip (24h day bucket; no shift selector). */
function isDdsComplianceDayPath(pathname: string): boolean {
  return (
    pathname.endsWith('/line-compliance') ||
    pathname.includes('/dds-process/line-compliance') ||
    pathname.endsWith('/site-compliance') ||
    pathname.includes('/dds-process/site-compliance')
  )
}

type Ctx = {
  /** True when a DDS page uses the scope-bar date strip (with or without shift). */
  routeActive: boolean
  /** Line / Site compliance: date only, no shift in scope bar. */
  complianceDayOnly: boolean
  planDate: string
  setPlanDate: (ymd: string) => void
  shiftKind: string
  setShiftKind: (kind: string) => void
  shifts: DdsP2pSummaryShiftRow[]
  roles: DdsP2pSummaryRosterRole[]
  shellLoading: boolean
  rosterError: string | null
  stepPlanDay: (delta: number) => void
  clampPlanDate: (raw: string) => string
  minPlanYmd: string
  maxPlanYmd: string
}

const ShiftDdsShellContext = createContext<Ctx | undefined>(undefined)

export function ShiftDdsShellProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const complianceDayOnly = isDdsComplianceDayPath(location.pathname)
  const routeActive = isDdsDayShiftShellPath(location.pathname) || complianceDayOnly

  const { status: scopeStatus, cellId } = usePlan24Workspace()

  const todayYmd = useMemo(() => localYMD(new Date()), [])
  const maxPlanYmd = useMemo(
    () => localYMD(addDays(new Date(todayYmd + 'T12:00:00'), PLAN24_VISIBLE_DAYS_AHEAD - 1)),
    [todayYmd],
  )

  const [planDate, setPlanDateState] = useState(() => localYMD(new Date()))
  const [shiftKind, setShiftKind] = useState('')
  const [shifts, setShifts] = useState<DdsP2pSummaryShiftRow[]>([])
  const [roles, setRoles] = useState<DdsP2pSummaryRosterRole[]>([])
  const [shellLoading, setShellLoading] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)

  const clampPlanDate = useCallback(
    (raw: string) => {
      if (!raw) return planDate
      if (raw < MIN_PLAN_YMD) return MIN_PLAN_YMD
      if (raw > maxPlanYmd) return maxPlanYmd
      return raw
    },
    [maxPlanYmd, planDate],
  )

  const setPlanDate = useCallback((ymd: string) => {
    setPlanDateState((prev) => {
      const next = ymd
      if (!next) return prev
      if (next < MIN_PLAN_YMD) return MIN_PLAN_YMD
      if (next > maxPlanYmd) return maxPlanYmd
      return next
    })
  }, [maxPlanYmd])

  const stepPlanDay = useCallback(
    (delta: number) => {
      setPlanDateState((prev) => {
        const d = new Date(prev + 'T12:00:00')
        d.setDate(d.getDate() + delta)
        let y = localYMD(d)
        if (y < MIN_PLAN_YMD) y = MIN_PLAN_YMD
        if (y > maxPlanYmd) y = maxPlanYmd
        return y
      })
    },
    [maxPlanYmd],
  )

  const loadRosterShell = useCallback(async () => {
    if (!routeActive || complianceDayOnly || scopeStatus !== 'ready' || !cellId) {
      setShifts([])
      setRoles([])
      setShiftKind('')
      setShellLoading(false)
      setRosterError(null)
      return
    }
    setShellLoading(true)
    setRosterError(null)
    const rosterRes = await supabase
      .from('plan24_rosters')
      .select('id')
      .eq('master_cell_id', cellId)
      .eq('is_active', true)
      .maybeSingle()
    if (rosterRes.error) {
      setRosterError(rosterRes.error.message)
      setShifts([])
      setRoles([])
      setShellLoading(false)
      return
    }
    const rid = (rosterRes.data as { id: string } | null)?.id ?? null
    if (!rid) {
      setShifts([])
      setRoles([])
      setShiftKind('')
      setShellLoading(false)
      return
    }
    const [shRes, roRes] = await Promise.all([
      supabase
        .from('plan24_roster_shifts')
        .select('kind, display_name, sort_order, start_local, end_local')
        .eq('roster_id', rid)
        .order('sort_order'),
      supabase.from('plan24_roster_roles').select('id, name, sort_order, is_active').eq('roster_id', rid).order('sort_order').order('name'),
    ])
    if (shRes.error || roRes.error) {
      setRosterError(shRes.error?.message ?? roRes.error?.message ?? 'Load failed')
      setShifts([])
      setRoles([])
      setShellLoading(false)
      return
    }
    const shList = (shRes.data ?? []) as DdsP2pSummaryShiftRow[]
    setShifts(shList)
    setShiftKind((prev) => {
      if (prev && shList.some((s) => s.kind === prev)) return prev
      return shList[0]?.kind ?? ''
    })
    setRoles(sortGroups((roRes.data ?? []) as DdsP2pSummaryRosterRole[]))
    setShellLoading(false)
  }, [cellId, complianceDayOnly, routeActive, scopeStatus])

  useEffect(() => {
    void loadRosterShell()
  }, [loadRosterShell])

  const shiftTabs = useMemo(() => [...shifts], [shifts])
  useEffect(() => {
    if (!routeActive) return
    if (shiftTabs.length === 0) return
    if (!shiftTabs.some((s) => s.kind === shiftKind)) setShiftKind(shiftTabs[0].kind)
  }, [routeActive, shiftKind, shiftTabs])

  const value = useMemo<Ctx>(
    () => ({
      routeActive,
      complianceDayOnly,
      planDate,
      setPlanDate,
      shiftKind,
      setShiftKind,
      shifts,
      roles,
      shellLoading,
      rosterError,
      stepPlanDay,
      clampPlanDate,
      minPlanYmd: MIN_PLAN_YMD,
      maxPlanYmd: maxPlanYmd,
    }),
    [
      routeActive,
      complianceDayOnly,
      planDate,
      setPlanDate,
      shiftKind,
      shifts,
      roles,
      shellLoading,
      rosterError,
      stepPlanDay,
      clampPlanDate,
      maxPlanYmd,
    ],
  )

  return <ShiftDdsShellContext.Provider value={value}>{children}</ShiftDdsShellContext.Provider>
}

/** Safe where the DDS shell provider is not mounted (e.g. Plan 24 under RTT layout). */
export function useShiftDdsShellOptional(): Ctx | undefined {
  return useContext(ShiftDdsShellContext)
}

export function useShiftDdsShell(): Ctx {
  const ctx = useContext(ShiftDdsShellContext)
  if (!ctx) throw new Error('useShiftDdsShell must be used under ShiftDdsShellProvider')
  return ctx
}
