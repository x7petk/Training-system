import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardCheck, Users } from 'lucide-react'
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
  isMissingMasterCellColumnError,
  ldrMasterCellJoinFromId,
  ldrMasterCellLabel,
  ldrMasterCellName,
  ldrPersonFullName,
  type LdrActivity,
  type LdrAssignmentRow,
  type LdrMasterCellJoin,
  type LdrPersonRow,
  type LdrRag,
} from '../features/ldr/types'
import { useLdrWorkspace } from '../features/ldr/LdrWorkspaceContext'
import {
  consumeLdrRosterReturnScope,
  stashLdrRosterReturnScope,
} from '../features/ldr/ldrRosterReturnScope'

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const LDR_RAG_OPTIONS = [
  { value: 'none' as const, label: 'None', active: 'border-slate-500 bg-slate-200 text-slate-950' },
  { value: 'green' as const, label: 'Green', active: 'border-emerald-600 bg-emerald-200 text-emerald-950' },
  { value: 'yellow' as const, label: 'Yellow', active: 'border-amber-600 bg-amber-200 text-amber-950' },
  { value: 'red' as const, label: 'Red', active: 'border-rose-600 bg-rose-200 text-rose-950' },
] as const

function personName(p: LdrPersonRow): string {
  return ldrPersonFullName(p)
}

function shortCellTag(p: LdrPersonRow): string {
  const n = ldrMasterCellName(p.master_cells).trim()
  if (!n) return ''
  return n.length <= 4 ? n : n.slice(0, 4).toUpperCase()
}

function shortLocationTagFromName(name: string): string {
  const n = name.trim()
  if (!n) return ''
  return n.length <= 4 ? n : n.slice(0, 4).toUpperCase()
}

/** Map LDR location row → master cell option id for the cell picker (legacy DB has no master_cell_id on assignments). */
function masterCellIdForLegacyLocation(
  ldrLocationId: string | null | undefined,
  legacyLocations: { id: string; name: string }[],
  siteCells: { id: string; label: string }[],
): string {
  if (!ldrLocationId || !legacyLocations.length) return ''
  const locName = legacyLocations.find((l) => l.id === ldrLocationId)?.name?.trim().toLowerCase() ?? ''
  if (!locName) return ''
  for (const opt of siteCells) {
    const label = opt.label.trim().toLowerCase()
    if (label === locName) return opt.id
    const cellPart = opt.label.split('·').pop()?.trim().toLowerCase() ?? ''
    if (cellPart === locName) return opt.id
  }
  return ''
}

function assignmentCellSelectValue(
  row: Pick<LdrAssignmentRow, 'master_cell_id' | 'ldr_location_id'>,
  legacyLocations: { id: string; name: string }[],
  siteCells: { id: string; label: string }[],
): string {
  if (row.master_cell_id && siteCells.some((c) => c.id === row.master_cell_id)) return row.master_cell_id
  return masterCellIdForLegacyLocation(row.ldr_location_id, legacyLocations, siteCells)
}

/** Master cell for HC deep link: assignment cell, else current cell scope when at cell level. */
function effectiveMasterCellForHc(
  row: Pick<LdrAssignmentRow, 'master_cell_id' | 'ldr_location_id'>,
  legacyLocations: { id: string; name: string }[],
  siteCells: { id: string; label: string }[],
  scopeLevel: 'site' | 'cell',
  contextMasterCellId: string,
): string {
  const v = assignmentCellSelectValue(row, legacyLocations, siteCells)
  if (v) return v
  if (scopeLevel === 'cell' && contextMasterCellId) return contextMasterCellId
  return ''
}

function personDefaultCellForPicker(
  person: LdrPersonRow,
  legacyLocations: { id: string; name: string }[],
  siteCells: { id: string; label: string }[],
): string {
  if (person.master_cell_id && siteCells.some((c) => c.id === person.master_cell_id)) return person.master_cell_id
  return masterCellIdForLegacyLocation(person.location_id, legacyLocations, siteCells)
}

/** Persist cell choice when DB only has ldr_location_id (name match to master cell). */
function legacyLocationIdForMasterCell(
  masterCellId: string | null | undefined,
  legacyLocations: { id: string; name: string }[],
  masterCellJoinById: ReadonlyMap<string, LdrMasterCellJoin>,
): string | null {
  if (!masterCellId) return null
  const join = masterCellJoinById.get(masterCellId)
  if (!join || !legacyLocations.length) return null
  const full = ldrMasterCellLabel(join).trim().toLowerCase()
  const cellOnly = join.name.trim().toLowerCase()
  for (const loc of legacyLocations) {
    const n = loc.name.trim().toLowerCase()
    if (n === cellOnly || n === full) return loc.id
  }
  return null
}

function visibleSiteActivitiesStorageKey(cellWorkspaceId: string, siteWorkspaceId: string) {
  return `ldr.site-activities.visible.v1:${cellWorkspaceId}:${siteWorkspaceId}`
}

function loadVisibleSiteActivityIds(cellWorkspaceId: string, siteWorkspaceId: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(visibleSiteActivitiesStorageKey(cellWorkspaceId, siteWorkspaceId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    return null
  }
}

function ragDotClass(r: LdrRag): string {
  if (r === 'none') return 'bg-slate-400'
  if (r === 'green') return 'bg-emerald-500'
  if (r === 'yellow') return 'bg-amber-400'
  return 'bg-rose-500'
}

type LeadershipRosterPageProps = {
  /** Compact embed for compliance screens (same data as LDR tools). */
  embed?: boolean
}

export function LeadershipRosterPage({ embed = false }: LeadershipRosterPageProps = {}) {
  const navigate = useNavigate()
  const {
    status: ldrStatus,
    workspaceId,
    scopeLevel,
    siteId,
    plantId,
    cellId,
    sites,
    siteCellOptions,
    masterCellJoinById,
    setScopeLevel,
    setSiteId,
    setPlantId,
    setCellId,
  } = useLdrWorkspace()
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()))
  const [activities, setActivities] = useState<LdrActivity[]>([])
  const [ldrPeople, setLdrPeople] = useState<LdrPersonRow[]>([])
  const [assignments, setAssignments] = useState<LdrAssignmentRow[]>([])
  /** When DB has no assignment.master_cell_id, we map picks to ldr_locations by name. */
  const [legacyLdrLocations, setLegacyLdrLocations] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cellModal, setCellModal] = useState<{ activityId: string; date: string } | null>(null)
  const [dragAssignmentId, setDragAssignmentId] = useState<string | null>(null)
  /** Activities (LDR) that have a linked HC type with an active template — roster can open Complete HC. */
  const [hcReadyByActivityId, setHcReadyByActivityId] = useState<Map<string, { hcTypeId: string }>>(() => new Map())
  /** SOS / QOS / PPO: activity is system-linked and has at least one active type template. */
  const [obsReadyByActivityId, setObsReadyByActivityId] = useState<Map<string, { sos: boolean; qos: boolean; ppo: boolean }>>(
    () => new Map(),
  )

  /** After HC / obs flows change workspace to cell scope, restore roster site vs cell choice when returning here. */
  useEffect(() => {
    if (ldrStatus !== 'ready' || sites.length === 0) return
    const returned = consumeLdrRosterReturnScope()
    if (!returned) return
    if (!sites.some((s) => s.id === returned.siteId)) return
    setScopeLevel(returned.scopeLevel)
    setSiteId(returned.siteId)
    if (returned.scopeLevel === 'cell') {
      setPlantId(returned.plantId)
      setCellId(returned.cellId)
    }
  }, [ldrStatus, sites, setScopeLevel, setSiteId, setPlantId, setCellId])

  const weekDays = useMemo(() => weekDaysMondayFirst(weekStart), [weekStart])
  const weekStartStr = toYMD(weekStart)
  const weekEndStr = toYMD(addDays(weekStart, 6))

  const load = useCallback(async () => {
    setError(null)
    if (!workspaceId) {
      setActivities([])
      setLdrPeople([])
      setAssignments([])
      setLegacyLdrLocations([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [actRes, peopleRes, asgRes] = await Promise.all([
      supabase
        .from('ldr_activities')
        .select('id, name, sort_order, workspace_id')
        .eq('workspace_id', workspaceId)
        .order('sort_order')
        .order('name'),
      supabase
        .from('ldr_people')
        .select(
          'id, workspace_id, site_id, location_id, master_cell_id, status, first_name, last_name, initials, avatar_variant',
        )
        .eq('workspace_id', workspaceId)
        .order('first_name')
        .order('last_name'),
      supabase
        .from('ldr_assignments')
        .select(
          'id, workspace_id, ldr_person_id, activity_id, assignment_date, ldr_location_id, master_cell_id, rag_status, comment',
        )
        .eq('workspace_id', workspaceId)
        .gte('assignment_date', weekStartStr)
        .lte('assignment_date', weekEndStr),
    ])
    if (
      (peopleRes.error && isMissingMasterCellColumnError(peopleRes.error.message)) ||
      (asgRes.error && isMissingMasterCellColumnError(asgRes.error.message))
    ) {
      const [legacyPeopleRes, legacyLocationsRes, legacyAsgRes] = await Promise.all([
        supabase
          .from('ldr_people')
          .select('id, workspace_id, site_id, location_id, status, first_name, last_name, initials, avatar_variant')
          .eq('workspace_id', workspaceId)
          .order('first_name')
          .order('last_name'),
        supabase.from('ldr_locations').select('id, name').eq('workspace_id', workspaceId),
        supabase
          .from('ldr_assignments')
          .select('id, workspace_id, ldr_person_id, activity_id, assignment_date, ldr_location_id, rag_status, comment')
          .eq('workspace_id', workspaceId)
          .gte('assignment_date', weekStartStr)
          .lte('assignment_date', weekEndStr),
      ])
      if (actRes.error) setError(actRes.error.message)
      else if (legacyPeopleRes.error) setError(legacyPeopleRes.error.message)
      else if (legacyLocationsRes.error) setError(legacyLocationsRes.error.message)
      else if (legacyAsgRes.error) setError(legacyAsgRes.error.message)
      else {
        let mergedLegacyLocations = [...((legacyLocationsRes.data ?? []) as { id: string; name: string }[])]
        const allActivities = [...((actRes.data ?? []) as LdrActivity[])]
        const peopleRaw = [...((legacyPeopleRes.data ?? []) as LdrPersonRow[])]
        const asgRaw = [...((legacyAsgRes.data ?? []) as LdrAssignmentRow[])]

        if (scopeLevel === 'cell' && siteId && cellId) {
          const { data: siteWsData, error: siteWsErr } = await supabase.rpc('ldr_ensure_workspace_site', {
            p_master_site_id: siteId,
          })
          const siteWsId = !siteWsErr && typeof siteWsData === 'string' ? siteWsData : null
          if (siteWsErr) setError(siteWsErr.message)
          if (siteWsId) {
            const [siteActRes, sitePeopleRes, siteAsgRes, siteLocRes] = await Promise.all([
              supabase
                .from('ldr_activities')
                .select('id, name, sort_order, workspace_id')
                .eq('workspace_id', siteWsId)
                .order('sort_order')
                .order('name'),
              supabase
                .from('ldr_people')
                .select('id, workspace_id, site_id, location_id, status, first_name, last_name, initials, avatar_variant')
                .eq('workspace_id', siteWsId)
                .order('first_name')
                .order('last_name'),
              supabase
                .from('ldr_assignments')
                .select('id, workspace_id, ldr_person_id, activity_id, assignment_date, ldr_location_id, rag_status, comment')
                .eq('workspace_id', siteWsId)
                .gte('assignment_date', weekStartStr)
                .lte('assignment_date', weekEndStr),
              supabase.from('ldr_locations').select('id, name').eq('workspace_id', siteWsId),
            ])
            if (siteActRes.error) setError(siteActRes.error.message)
            else if (sitePeopleRes.error) setError(sitePeopleRes.error.message)
            else if (siteAsgRes.error) setError(siteAsgRes.error.message)
            else if (siteLocRes.error) setError(siteLocRes.error.message)
            else {
              const visibleSiteActivityIds = loadVisibleSiteActivityIds(workspaceId, siteWsId)
              const siteActivitiesToShow = ((siteActRes.data ?? []) as LdrActivity[]).filter((activity) =>
                visibleSiteActivityIds == null ? true : visibleSiteActivityIds.has(activity.id),
              )
              const seenActivityIds = new Set(allActivities.map((a) => a.id))
              for (const activity of siteActivitiesToShow) {
                if (!seenActivityIds.has(activity.id)) allActivities.push(activity)
              }

              const siteLegacyLocations = (siteLocRes.data ?? []) as { id: string; name: string }[]
              mergedLegacyLocations = [...mergedLegacyLocations, ...siteLegacyLocations]

              const seenPeopleIds = new Set(peopleRaw.map((p) => p.id))
              const sitePeople = (sitePeopleRes.data ?? []) as LdrPersonRow[]
              for (const person of sitePeople) {
                if (!seenPeopleIds.has(person.id)) peopleRaw.push(person)
              }

              const personCellById = new Map<string, string>()
              for (const person of sitePeople) {
                const resolved = masterCellIdForLegacyLocation(person.location_id, siteLegacyLocations, siteCellOptions)
                if (resolved) personCellById.set(person.id, resolved)
              }

              const filteredSiteAssignments = ((siteAsgRes.data ?? []) as LdrAssignmentRow[]).filter(
                (a) =>
                  siteActivitiesToShow.some((act) => act.id === a.activity_id) &&
                  (masterCellIdForLegacyLocation(a.ldr_location_id, siteLegacyLocations, siteCellOptions) === cellId ||
                    personCellById.get(a.ldr_person_id) === cellId),
              )
              asgRaw.push(...filteredSiteAssignments)
            }
          }
        }

        setLegacyLdrLocations(mergedLegacyLocations)
        const legacyLocationById = new Map(mergedLegacyLocations.map((row) => [row.id, row.name]))
        setActivities(allActivities)
        setLdrPeople(
          peopleRaw.map((r) => ({
            ...r,
            master_cell_id: null,
            master_cells: r.location_id ? { name: legacyLocationById.get(r.location_id) ?? '' } : undefined,
          })),
        )
        setAssignments(
          asgRaw.map((r) => ({
            ...r,
            master_cell_id: null,
            master_cells: r.ldr_location_id ? { name: legacyLocationById.get(r.ldr_location_id) ?? '' } : undefined,
          })),
        )
      }
      setLoading(false)
      return
    }
    if (actRes.error) setError(actRes.error.message)
    else if (peopleRes.error) setError(peopleRes.error.message)
    else if (asgRes.error) setError(asgRes.error.message)
    else {
      setLegacyLdrLocations([])
      const allActivities = [...((actRes.data ?? []) as LdrActivity[])]
      const peopleRaw = [...((peopleRes.data ?? []) as LdrPersonRow[])]
      const asgRaw = [...((asgRes.data ?? []) as LdrAssignmentRow[])]

      if (scopeLevel === 'cell' && siteId && cellId) {
        const { data: siteWsData, error: siteWsErr } = await supabase.rpc('ldr_ensure_workspace_site', {
          p_master_site_id: siteId,
        })
        const siteWsId = !siteWsErr && typeof siteWsData === 'string' ? siteWsData : null
        if (siteWsErr) setError(siteWsErr.message)
        if (siteWsId) {
          const [siteActRes, sitePeopleResMaybe, siteAsgResMaybe, siteLocRes] = await Promise.all([
            supabase
              .from('ldr_activities')
              .select('id, name, sort_order, workspace_id')
              .eq('workspace_id', siteWsId)
              .order('sort_order')
              .order('name'),
            supabase
              .from('ldr_people')
              .select('id, workspace_id, site_id, location_id, master_cell_id, status, first_name, last_name, initials, avatar_variant')
              .eq('workspace_id', siteWsId)
              .order('first_name')
              .order('last_name'),
            supabase
              .from('ldr_assignments')
              .select(
                'id, workspace_id, ldr_person_id, activity_id, assignment_date, ldr_location_id, master_cell_id, rag_status, comment',
              )
              .eq('workspace_id', siteWsId)
              .gte('assignment_date', weekStartStr)
              .lte('assignment_date', weekEndStr),
            supabase.from('ldr_locations').select('id, name').eq('workspace_id', siteWsId),
          ])
          let sitePeopleErr = sitePeopleResMaybe.error
          let siteAsgErr = siteAsgResMaybe.error
          let sitePeopleData = (sitePeopleResMaybe.data ?? []) as LdrPersonRow[]
          let siteAsgData = (siteAsgResMaybe.data ?? []) as LdrAssignmentRow[]
          if (sitePeopleErr && isMissingMasterCellColumnError(sitePeopleErr.message)) {
            const sitePeopleLegacyRes = await supabase
              .from('ldr_people')
              .select('id, site_id, location_id, status, first_name, last_name, initials, avatar_variant')
              .eq('workspace_id', siteWsId)
              .order('first_name')
              .order('last_name')
            sitePeopleErr = sitePeopleLegacyRes.error
            sitePeopleData = (sitePeopleLegacyRes.data ?? []) as LdrPersonRow[]
          }
          if (siteAsgErr && isMissingMasterCellColumnError(siteAsgErr.message)) {
            const siteAsgLegacyRes = await supabase
              .from('ldr_assignments')
              .select('id, workspace_id, ldr_person_id, activity_id, assignment_date, ldr_location_id, rag_status, comment')
              .eq('workspace_id', siteWsId)
              .gte('assignment_date', weekStartStr)
              .lte('assignment_date', weekEndStr)
            siteAsgErr = siteAsgLegacyRes.error
            siteAsgData = (siteAsgLegacyRes.data ?? []) as LdrAssignmentRow[]
          }

          if (siteActRes.error) setError(siteActRes.error.message)
          else if (sitePeopleErr) setError(sitePeopleErr.message)
          else if (siteAsgErr) setError(siteAsgErr.message)
          else if (siteLocRes.error) setError(siteLocRes.error.message)
          else {
            const visibleSiteActivityIds = loadVisibleSiteActivityIds(workspaceId, siteWsId)
            const siteActivitiesToShow = ((siteActRes.data ?? []) as LdrActivity[]).filter((activity) =>
              visibleSiteActivityIds == null ? true : visibleSiteActivityIds.has(activity.id),
            )
            const seenActivityIds = new Set(allActivities.map((a) => a.id))
            for (const activity of siteActivitiesToShow) {
              if (!seenActivityIds.has(activity.id)) allActivities.push(activity)
            }

            const seenPeopleIds = new Set(peopleRaw.map((p) => p.id))
            for (const person of sitePeopleData) {
              if (!seenPeopleIds.has(person.id)) peopleRaw.push(person)
            }

            const siteLegacyLocations = (siteLocRes.data ?? []) as { id: string; name: string }[]
            const personCellById = new Map<string, string>()
            for (const person of sitePeopleData) {
              const resolved =
                person.master_cell_id && person.master_cell_id.length
                  ? person.master_cell_id
                  : masterCellIdForLegacyLocation(person.location_id, siteLegacyLocations, siteCellOptions)
              if (resolved) personCellById.set(person.id, resolved)
            }
            const siteAssignments = siteAsgData.filter(
              (a) =>
                siteActivitiesToShow.some((act) => act.id === a.activity_id) &&
                ((a.master_cell_id && a.master_cell_id === cellId) ||
                  masterCellIdForLegacyLocation(a.ldr_location_id, siteLegacyLocations, siteCellOptions) === cellId ||
                  personCellById.get(a.ldr_person_id) === cellId),
            )
            asgRaw.push(...siteAssignments)
          }
        }
      }

      setActivities(allActivities)
      setLdrPeople(
        peopleRaw.map((r) => ({
          ...r,
          master_cells: ldrMasterCellJoinFromId(r.master_cell_id, masterCellJoinById),
        })),
      )
      setAssignments(
        asgRaw.map((r) => ({
          ...r,
          master_cells: ldrMasterCellJoinFromId(r.master_cell_id, masterCellJoinById),
        })),
      )
    }
    setLoading(false)
  }, [workspaceId, scopeLevel, siteId, cellId, weekStartStr, weekEndStr, siteCellOptions, masterCellJoinById])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    const activityIds = activities.map((a) => a.id)
    if (activityIds.length === 0) {
      queueMicrotask(() => setHcReadyByActivityId(new Map()))
      return
    }
    let cancelled = false
    async function loadHcReadiness() {
      if (cancelled) return
      const typesRes = await supabase
        .from('hc_types')
        .select('id, ldr_activity_id')
        .eq('active', true)
        .in('ldr_activity_id', activityIds)
      if (cancelled) return
      if (typesRes.error) {
        setHcReadyByActivityId(new Map())
        return
      }
      const rows = (typesRes.data ?? []) as { id: string; ldr_activity_id: string }[]
      if (rows.length === 0) {
        setHcReadyByActivityId(new Map())
        return
      }
      const typeIds = rows.map((r) => r.id)
      const tplRes = await supabase
        .from('hc_templates')
        .select('hc_type_id')
        .eq('active', true)
        .in('hc_type_id', typeIds)
      if (cancelled) return
      const withTpl = new Set((tplRes.data ?? []).map((t: { hc_type_id: string }) => t.hc_type_id))
      const m = new Map<string, { hcTypeId: string }>()
      for (const r of rows) {
        if (withTpl.has(r.id)) m.set(r.ldr_activity_id, { hcTypeId: r.id })
      }
      setHcReadyByActivityId(m)
    }
    queueMicrotask(() => {
      void loadHcReadiness()
    })
    return () => {
      cancelled = true
    }
  }, [activities])

  useEffect(() => {
    const activityIds = activities.map((a) => a.id)
    const workspaceIds = [...new Set(activities.map((a) => a.workspace_id).filter((v): v is string => Boolean(v)))]
    if (activityIds.length === 0) {
      queueMicrotask(() => setObsReadyByActivityId(new Map()))
      return
    }
    let cancelled = false
    async function loadObsReadiness() {
      if (cancelled) return
      const [linksRes, sosTypesRes, qosTypesRes, ppoTypesRes] = await Promise.all([
        workspaceIds.length
          ? supabase
              .from('obs_system_activity_links')
              .select('workspace_id, kind, ldr_activity_id')
              .in('workspace_id', workspaceIds)
          : Promise.resolve({
              data: [] as { workspace_id: string; kind: 'sos' | 'qos' | 'ppo'; ldr_activity_id: string }[],
              error: null,
            }),
        workspaceIds.length
          ? supabase.from('sos_types').select('id, workspace_id').eq('active', true).in('workspace_id', workspaceIds)
          : Promise.resolve({ data: [] as { id: string; workspace_id: string }[], error: null }),
        workspaceIds.length
          ? supabase.from('qos_types').select('id, workspace_id').eq('active', true).in('workspace_id', workspaceIds)
          : Promise.resolve({ data: [] as { id: string; workspace_id: string }[], error: null }),
        workspaceIds.length
          ? supabase.from('ppo_types').select('id, workspace_id').eq('active', true).in('workspace_id', workspaceIds)
          : Promise.resolve({ data: [] as { id: string; workspace_id: string }[], error: null }),
      ])
      if (cancelled) return
      if (linksRes.error || sosTypesRes.error || qosTypesRes.error || ppoTypesRes.error) {
        setObsReadyByActivityId(new Map())
        return
      }
      const links = (linksRes.data ?? []) as { workspace_id: string; kind: 'sos' | 'qos' | 'ppo'; ldr_activity_id: string }[]
      const sosTypes = (sosTypesRes.data ?? []) as { id: string; workspace_id: string }[]
      const qosTypes = (qosTypesRes.data ?? []) as { id: string; workspace_id: string }[]
      const ppoTypes = (ppoTypesRes.data ?? []) as { id: string; workspace_id: string }[]

      const [sosTpl, qosTpl, ppoTpl] = await Promise.all([
        sosTypes.length
          ? supabase
              .from('sos_templates')
              .select('sos_type_id')
              .eq('active', true)
              .in(
                'sos_type_id',
                sosTypes.map((t) => t.id),
              )
          : Promise.resolve({ data: [] as { sos_type_id: string }[] }),
        qosTypes.length
          ? supabase
              .from('qos_templates')
              .select('qos_type_id')
              .eq('active', true)
              .in(
                'qos_type_id',
                qosTypes.map((t) => t.id),
              )
          : Promise.resolve({ data: [] as { qos_type_id: string }[] }),
        ppoTypes.length
          ? supabase
              .from('ppo_templates')
              .select('ppo_type_id')
              .eq('active', true)
              .in(
                'ppo_type_id',
                ppoTypes.map((t) => t.id),
              )
          : Promise.resolve({ data: [] as { ppo_type_id: string }[] }),
      ])
      if (cancelled) return

      const sosWith = new Set((sosTpl.data ?? []).map((r: { sos_type_id: string }) => r.sos_type_id))
      const qosWith = new Set((qosTpl.data ?? []).map((r: { qos_type_id: string }) => r.qos_type_id))
      const ppoWith = new Set((ppoTpl.data ?? []).map((r: { ppo_type_id: string }) => r.ppo_type_id))

      const sosReadyWs = new Set<string>()
      for (const t of sosTypes) {
        if (sosWith.has(t.id)) sosReadyWs.add(t.workspace_id)
      }
      const qosReadyWs = new Set<string>()
      for (const t of qosTypes) {
        if (qosWith.has(t.id)) qosReadyWs.add(t.workspace_id)
      }
      const ppoReadyWs = new Set<string>()
      for (const t of ppoTypes) {
        if (ppoWith.has(t.id)) ppoReadyWs.add(t.workspace_id)
      }

      const linkedByActivity = new Map<string, { kind: 'sos' | 'qos' | 'ppo'; workspace_id: string }>()
      for (const l of links) {
        linkedByActivity.set(l.ldr_activity_id, { kind: l.kind, workspace_id: l.workspace_id })
      }

      const m = new Map<string, { sos: boolean; qos: boolean; ppo: boolean }>()
      for (const id of activityIds) {
        const linked = linkedByActivity.get(id)
        m.set(id, {
          sos: linked?.kind === 'sos' ? sosReadyWs.has(linked.workspace_id) : false,
          qos: linked?.kind === 'qos' ? qosReadyWs.has(linked.workspace_id) : false,
          ppo: linked?.kind === 'ppo' ? ppoReadyWs.has(linked.workspace_id) : false,
        })
      }
      setObsReadyByActivityId(m)
    }
    queueMicrotask(() => {
      void loadObsReadiness()
    })
    return () => {
      cancelled = true
    }
  }, [activities])

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

  const assignmentsByCell = useMemo(() => {
    const map = new Map<string, LdrAssignmentRow[]>()
    for (const assignment of assignments) {
      const key = `${assignment.activity_id}|${assignment.assignment_date}`
      const list = map.get(key)
      if (list) list.push(assignment)
      else map.set(key, [assignment])
    }
    return map
  }, [assignments])

  const peopleById = useMemo(() => new Map(ldrPeople.map((person) => [person.id, person])), [ldrPeople])

  const activityNameById = useMemo(() => new Map(activities.map((activity) => [activity.id, activity.name])), [activities])
  const activityWorkspaceById = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity.workspace_id ?? workspaceId])),
    [activities, workspaceId],
  )

  const ensureLegacyLocationIdForMasterCell = useCallback(
    async (
      masterCellId: string | null | undefined,
      targetWorkspaceId: string | null | undefined,
    ): Promise<string | null> => {
      const wsId = targetWorkspaceId ?? workspaceId
      const existing = legacyLocationIdForMasterCell(masterCellId, legacyLdrLocations, masterCellJoinById)
      if (existing || !masterCellId || !wsId) return existing

      const join = masterCellJoinById.get(masterCellId)
      const preferredName = join?.name?.trim() ?? ''
      if (!preferredName) return null

      const { error: insertErr } = await supabase
        .from('ldr_locations')
        .insert({ workspace_id: wsId, name: preferredName, sort_order: legacyLdrLocations.length })

      // If insert fails (e.g. duplicate), still refresh and resolve from current rows.
      if (insertErr && !/duplicate|unique/i.test(insertErr.message)) return null

      const { data: refreshedRows, error: refreshErr } = await supabase
        .from('ldr_locations')
        .select('id, name')
        .eq('workspace_id', wsId)

      if (refreshErr) return null
      const refreshed = (refreshedRows ?? []) as { id: string; name: string }[]
      setLegacyLdrLocations((prev) => {
        const byId = new Map(prev.map((row) => [row.id, row]))
        for (const row of refreshed) byId.set(row.id, row)
        return [...byId.values()]
      })
      return legacyLocationIdForMasterCell(masterCellId, refreshed, masterCellJoinById)
    },
    [legacyLdrLocations, masterCellJoinById, workspaceId],
  )

  function personConflictOnDate(ldrPersonId: string, date: string): boolean {
    return conflictKeys.has(`${ldrPersonId}|${date}`)
  }

  function assignmentsForCell(activityId: string, date: string): LdrAssignmentRow[] {
    return assignmentsByCell.get(`${activityId}|${date}`) ?? []
  }

  function cellHasWarning(activityId: string, date: string): boolean {
    return assignmentsForCell(activityId, date).some((a) => personConflictOnDate(a.ldr_person_id, date))
  }

  async function addAssignment(
    activityId: string,
    date: string,
    ldrPersonId: string,
    opts?: { masterCellId?: string; rag_status?: LdrRag; comment?: string },
  ) {
    setError(null)
    const person = peopleById.get(ldrPersonId)
    const targetWorkspaceId = activityWorkspaceById.get(activityId) ?? workspaceId
    if (!targetWorkspaceId) return
    const masterCellId =
      opts?.masterCellId ??
      (scopeLevel === 'cell' && cellId ? cellId : undefined) ??
      person?.master_cell_id ??
      null
    const rag_status = opts?.rag_status ?? 'none'
    const comment = opts?.comment?.trim() ?? ''
    const { error: e } = await supabase.from('ldr_assignments').insert({
      workspace_id: targetWorkspaceId,
      activity_id: activityId,
      assignment_date: date,
      ldr_person_id: ldrPersonId,
      master_cell_id: masterCellId,
      ldr_location_id: null,
      rag_status,
      comment,
    })
    if (e && isMissingMasterCellColumnError(e.message)) {
      const chosenMaster =
        opts?.masterCellId ??
        (scopeLevel === 'cell' && cellId ? cellId : undefined) ??
        person?.master_cell_id ??
        undefined
      const locId = await ensureLegacyLocationIdForMasterCell(chosenMaster ?? null, targetWorkspaceId)
      const { error: legacyErr } = await supabase.from('ldr_assignments').insert({
        workspace_id: targetWorkspaceId,
        activity_id: activityId,
        assignment_date: date,
        ldr_person_id: ldrPersonId,
        ldr_location_id: locId,
        rag_status,
        comment,
      })
      if (legacyErr) {
        setError(legacyErr.message)
        return
      }
    } else if (e) {
      setError(e.message)
      return
    }
    await load()
  }

  async function updateAssignment(
    id: string,
    patch: Partial<Pick<LdrAssignmentRow, 'rag_status' | 'comment' | 'master_cell_id'>>,
  ) {
    setError(null)
    const { error: e } = await supabase.from('ldr_assignments').update(patch).eq('id', id)
    if (e && isMissingMasterCellColumnError(e.message)) {
      const { master_cell_id: mc, ...legacyPatch } = patch
      const assignmentWorkspaceId = assignments.find((a) => a.id === id)?.workspace_id ?? workspaceId
      const locId =
        mc !== undefined ? await ensureLegacyLocationIdForMasterCell(mc, assignmentWorkspaceId) : undefined
      const withLoc =
        locId !== undefined
          ? {
              ...legacyPatch,
              ldr_location_id: locId,
            }
          : legacyPatch
      const { error: legacyErr } = await supabase.from('ldr_assignments').update(withLoc).eq('id', id)
      if (legacyErr) {
        setError(legacyErr.message)
        return
      }
    } else if (e) {
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
    <div className={embed ? 'flex h-full min-h-0 flex-col' : 'space-y-6'}>
      {!embed ? (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Users className="size-6" aria-hidden />
            </span>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Roster</h1>
          </div>
        </header>
      ) : null}

      {error ? (
        <p
          className={`rounded-lg border border-danger/30 bg-danger/10 text-danger ${embed ? 'px-2 py-1.5 text-[10px]' : 'rounded-xl px-4 py-3 text-sm'}`}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section
        className={
          embed
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-surface-raised/40 p-1.5'
            : 'rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6'
        }
      >
        <div className={`flex flex-wrap items-center gap-1.5 ${embed ? 'shrink-0' : 'gap-2'}`}>
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className={`rounded-lg border border-border text-muted hover:bg-black/[0.04] hover:text-fg ${embed ? 'p-1' : 'p-2'}`}
            aria-label="Previous week"
          >
            <ChevronLeft className={embed ? 'size-4' : 'size-5'} />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className={`rounded-lg border border-border text-muted hover:bg-black/[0.04] hover:text-fg ${embed ? 'p-1' : 'p-2'}`}
            aria-label="Next week"
          >
            <ChevronRight className={embed ? 'size-4' : 'size-5'} />
          </button>
          <h2 className={`px-1 font-semibold tracking-tight ${embed ? 'text-xs' : 'px-2 font-display text-lg'}`}>
            {formatWeekTitle(weekStart)}
          </h2>
          <label
            className={`ml-auto flex items-center font-medium uppercase tracking-wider text-muted ${embed ? 'gap-1 text-[9px]' : 'gap-2 text-xs'}`}
          >
            Jump
            <input
              type="date"
              value={toYMD(addDays(weekStart, 3))}
              onChange={(e) => {
                if (!e.target.value) return
                setWeekStart(startOfWeekMonday(parseYMD(e.target.value)))
              }}
              className={`rounded-lg border border-border bg-canvas text-fg ${embed ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-sm'}`}
            />
          </label>
        </div>

        {loading ? (
          <p className={`text-muted ${embed ? 'mt-1 text-[10px]' : 'mt-6 text-sm'}`}>Loading…</p>
        ) : activities.length === 0 ? (
          <p className={`text-muted ${embed ? 'mt-1 text-[10px]' : 'mt-6 text-sm'}`}>
            No activities yet. Add them under <strong className="text-fg/90">LDR tools → Admin</strong>.
          </p>
        ) : ldrPeople.length === 0 ? (
          <p className={`text-muted ${embed ? 'mt-1 text-[10px]' : 'mt-6 text-sm'}`}>
            No LDR people yet. Add people under <strong className="text-fg/90">LDR tools → Admin</strong>.
          </p>
        ) : (
          <div className={`min-h-0 overflow-auto ${embed ? 'mt-1 flex-1' : 'mt-6 overflow-x-auto'}`}>
            <table
              className={`w-full border-collapse text-left ${embed ? 'min-w-[32rem] text-[9px]' : 'min-w-[780px] text-sm'}`}
            >
              <thead>
                <tr className="border-b border-border font-medium uppercase tracking-wider text-muted">
                  <th
                    className={`sticky left-0 z-10 bg-surface ${embed ? 'min-w-[4.5rem] py-0.5 pl-1 pr-1 text-[8px]' : 'min-w-[7.5rem] py-2 pl-2 pr-2 text-xs'}`}
                  >
                    Activity
                  </th>
                  {weekDays.map((d, i) => (
                    <th
                      key={toYMD(d)}
                      className={`px-0.5 text-center ${embed ? 'min-w-[3.25rem] py-0.5 text-[8px]' : 'min-w-[5.8rem] px-1 py-2 text-xs'}`}
                    >
                      <span className="block">{dayLabels[i]}</span>
                      <span className="text-fg">{d.getDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activities.map((act) => (
                  <tr key={act.id}>
                    <td className={`sticky left-0 z-10 bg-surface font-medium text-fg ${embed ? 'py-0.5 pl-1 pr-1' : 'py-1.5 pl-2 pr-2'}`}>
                      <span className="truncate">{act.name}</span>
                    </td>
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
                            className={`w-full rounded-lg border border-border bg-canvas/40 text-left transition hover:border-accent/40 hover:bg-black/[0.02] ${
                              embed ? 'min-h-[1.75rem] p-0.5' : 'min-h-[4.25rem] p-1.5'
                            }`}
                          >
                            <div className={`flex items-center justify-end ${embed ? 'min-h-0' : 'mb-1 min-h-[1rem]'}`}>
                              {warn ? (
                                <AlertTriangle
                                  className={embed ? 'size-3 text-amber-600' : 'size-4 text-amber-600'}
                                  aria-label="Assignment conflict"
                                />
                              ) : null}
                            </div>
                            <div className={`flex flex-wrap ${embed ? 'gap-px' : 'gap-1'}`}>
                              {list.map((a) => {
                                const lp = peopleById.get(a.ldr_person_id)
                                const nm = lp ? personName(lp) : '?'
                                const assignmentCellName = ldrMasterCellName(a.master_cells)
                                const locTag = assignmentCellName
                                  ? shortLocationTagFromName(assignmentCellName)
                                  : lp
                                    ? shortCellTag(lp)
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
                                    title={a.comment?.trim() ? `${nm}\n${a.comment.trim()}` : nm}
                                    className={`inline-flex max-w-full items-center gap-0.5 rounded-md border font-semibold shadow-sm ${
                                      embed ? 'px-0.5 py-px text-[8px]' : 'gap-1 px-1 py-0.5 text-[10px]'
                                    } ${
                                      c
                                        ? 'border-amber-400/60 bg-amber-50 text-amber-950'
                                        : 'border-border bg-surface text-fg'
                                    }`}
                                  >
                                    <span className={`size-2 shrink-0 rounded-full ${ragDotClass(a.rag_status)}`} />
                                    <LdrPersonAvatar
                                      initials={lp?.initials ?? 'LD'}
                                      variant={lp?.avatar_variant ?? 1}
                                      size="xs"
                                      className="size-[18px] border-none shadow-none"
                                    />
                                    {locTag ? <span className="truncate">· {locTag}</span> : null}
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
          rosterActivityId={cellModal.activityId}
          activityName={activityNameById.get(cellModal.activityId) ?? 'Activity'}
          date={cellModal.date}
          people={ldrPeople}
          activityWorkspaceId={activityWorkspaceById.get(cellModal.activityId) ?? workspaceId ?? ''}
          rosterWorkspaceId={workspaceId ?? ''}
          scopeLevel={scopeLevel}
          contextMasterCellId={cellId}
          cells={siteCellOptions}
          legacyLdrLocations={legacyLdrLocations}
          rows={assignmentsForCell(cellModal.activityId, cellModal.date)}
          hcTemplateReadyForActivity={hcReadyByActivityId.has(cellModal.activityId)}
          obsReady={obsReadyByActivityId.get(cellModal.activityId) ?? { sos: false, qos: false, ppo: false }}
          onStartHealthCheck={(payload) => {
            stashLdrRosterReturnScope({ scopeLevel, siteId, plantId, cellId })
            const q = new URLSearchParams({
              activityId: payload.activityId,
              masterCellId: payload.masterCellId,
              completionDate: payload.completionDate,
              assignmentId: payload.assignmentId,
            })
            navigate(`/ldr-tools/health-checks/new?${q.toString()}`)
            setCellModal(null)
          }}
          onStartObs={(obsKind, payload) => {
            stashLdrRosterReturnScope({ scopeLevel, siteId, plantId, cellId })
            const q = new URLSearchParams({
              activityId: payload.activityId,
              masterCellId: payload.masterCellId,
              completionDate: payload.completionDate,
              assignmentId: payload.assignmentId,
            })
            q.set('osKind', obsKind)
            navigate(`/ldr-tools/sos/new?${q.toString()}`)
            setCellModal(null)
          }}
          onClose={() => setCellModal(null)}
          onAdd={(pid, opts) => void addAssignment(cellModal.activityId, cellModal.date, pid, opts)}
          onUpdate={(id, patch) => void updateAssignment(id, patch)}
          onRemove={(id) => void removeAssignment(id)}
        />
      ) : null}
    </div>
  )
}

function ldrPersonWorkspaceId(person: LdrPersonRow, fallbackWorkspaceId: string): string {
  return person.workspace_id ?? fallbackWorkspaceId
}

function CellEditorModal(props: {
  rosterActivityId: string
  activityName: string
  date: string
  people: LdrPersonRow[]
  /** Workspace that owns the activity row (site vs cell activity). */
  activityWorkspaceId: string
  /** Current roster workspace (cell workspace when scope is cell). */
  rosterWorkspaceId: string
  scopeLevel: 'site' | 'cell'
  contextMasterCellId: string
  cells: { id: string; label: string }[]
  legacyLdrLocations: { id: string; name: string }[]
  rows: LdrAssignmentRow[]
  hcTemplateReadyForActivity: boolean
  obsReady: { sos: boolean; qos: boolean; ppo: boolean }
  onStartHealthCheck: (payload: {
    activityId: string
    masterCellId: string
    completionDate: string
    assignmentId: string
  }) => void
  onStartObs: (
    kind: 'sos' | 'qos' | 'ppo',
    payload: { activityId: string; masterCellId: string; completionDate: string; assignmentId: string },
  ) => void
  onClose: () => void
  onAdd: (ldrPersonId: string, opts?: { masterCellId?: string; rag_status?: LdrRag; comment?: string }) => void
  onUpdate: (id: string, patch: Partial<Pick<LdrAssignmentRow, 'rag_status' | 'comment' | 'master_cell_id'>>) => void
  onRemove: (id: string) => void
}) {
  const assignedIds = useMemo(() => new Set(props.rows.map((r) => r.ldr_person_id)), [props.rows])
  const peopleById = useMemo(() => new Map(props.people.map((p) => [p.id, p])), [props.people])
  /** Cell-owned activities → cell workspace people; site activities on cell roster → that activity’s people. */
  const personPickerWorkspaceId =
    props.scopeLevel === 'cell' &&
    props.rosterWorkspaceId &&
    props.activityWorkspaceId === props.rosterWorkspaceId
      ? props.rosterWorkspaceId
      : props.activityWorkspaceId
  const addable = useMemo(() => {
    return props.people.filter((p) => {
      if (assignedIds.has(p.id)) return false
      if (ldrPersonWorkspaceId(p, personPickerWorkspaceId) !== personPickerWorkspaceId) return false
      // On cell roster for a site activity, only people assigned to this cell.
      if (
        props.scopeLevel === 'cell' &&
        props.contextMasterCellId &&
        props.rosterWorkspaceId &&
        props.activityWorkspaceId !== props.rosterWorkspaceId
      ) {
        if (p.master_cell_id && p.master_cell_id === props.contextMasterCellId) return true
        const fromLegacy = masterCellIdForLegacyLocation(p.location_id, props.legacyLdrLocations, props.cells)
        return fromLegacy === props.contextMasterCellId
      }
      return true
    })
  }, [
    props.people,
    assignedIds,
    personPickerWorkspaceId,
    props.scopeLevel,
    props.contextMasterCellId,
    props.rosterWorkspaceId,
    props.activityWorkspaceId,
    props.legacyLdrLocations,
    props.cells,
  ])
  const hasUnassignedPeople = useMemo(
    () => props.people.some((p) => !assignedIds.has(p.id)),
    [props.people, assignedIds],
  )
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [selectedCellId, setSelectedCellId] = useState('')
  const [addRag, setAddRag] = useState<LdrRag>('none')
  const [addComment, setAddComment] = useState('')

  return (
    <dialog open className="fixed inset-0 z-50 flex max-h-none max-w-none items-center justify-center bg-black/40 p-4 text-fg [color-scheme:light]">
      <div className="flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface text-fg shadow-glow">
        <div className="shrink-0 border-b border-border bg-surface px-6 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-baseline gap-2 font-display text-lg font-semibold text-fg">
                <span>{props.activityName}</span>
                <span className="text-sm font-medium text-muted">{props.date}</span>
              </h3>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-raised"
            >
              Close
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-6 py-4">
        {props.hcTemplateReadyForActivity ||
        props.obsReady.sos ||
        props.obsReady.qos ||
        props.obsReady.ppo ? (
          <p className="mt-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs text-black">
            {props.hcTemplateReadyForActivity ? (
              <>
                HC: use <strong className="font-semibold text-black">Complete HC</strong> on an assignment when an active HC template exists.
              </>
            ) : null}
            {props.obsReady.sos || props.obsReady.qos || props.obsReady.ppo ? (
              <span className="block">
                SOS / QOS / PPO: use the matching complete buttons when that system activity is linked and at least one
                active type template exists (LDR Admin → types + templates).
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Link this activity under LDR Admin (HC type or SOS/QOS/PPO system link) and set active templates to enable
            completion shortcuts from the roster.
          </p>
        )}

        <div className="mt-4 space-y-4">
          {props.rows.length === 0 ? (
            <p className="text-sm text-muted">No assignments yet.</p>
          ) : (
            props.rows.map((r) => {
              const p = peopleById.get(r.ldr_person_id)
              const assignmentCellName = ldrMasterCellName(r.master_cells)
              const compactLocation = assignmentCellName
                ? shortLocationTagFromName(assignmentCellName)
                : p
                  ? shortCellTag(p)
                  : ''
              const compact = p != null ? `${p.initials}${compactLocation ? ` · ${compactLocation}` : ''}` : 'LD'
              const effCell = effectiveMasterCellForHc(
                r,
                props.legacyLdrLocations,
                props.cells,
                props.scopeLevel,
                props.contextMasterCellId,
              )
              return (
                <AssignmentRowEditor
                  key={r.id}
                  row={r}
                  cells={props.cells}
                  cellSelectValue={assignmentCellSelectValue(r, props.legacyLdrLocations, props.cells)}
                  personLabel={compact}
                  personFullName={p ? personName(p) : 'Person'}
                  personInitials={p?.initials ?? 'LD'}
                  personAvatarVariant={p?.avatar_variant ?? 1}
                  rosterActivityId={props.rosterActivityId}
                  assignmentDate={props.date}
                  effectiveMasterCellId={effCell}
                  obsReady={props.obsReady}
                  showCompleteHcButton={props.hcTemplateReadyForActivity}
                  completeHcEnabled={!!p}
                  completeHcTitle={
                    !p ? 'Person not found for this assignment' : undefined
                  }
                  onCompleteHc={
                    props.hcTemplateReadyForActivity
                      ? () => {
                          if (!p) return
                          props.onStartHealthCheck({
                            activityId: props.rosterActivityId,
                            masterCellId: effCell ?? '',
                            completionDate: props.date,
                            assignmentId: r.id,
                          })
                        }
                      : undefined
                  }
                  onStartObs={props.onStartObs}
                  completeObsEnabled={!!effCell && !!p}
                  completeObsTitle={
                    !effCell
                      ? 'Choose a cell for this assignment (or use cell-level scope)'
                      : !p
                        ? 'Person not found for this assignment'
                        : undefined
                  }
                  onUpdate={props.onUpdate}
                  onRemove={props.onRemove}
                />
              )
            })
          )}

          {addable.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface-raised/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Add assignment</p>
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                  Person
                  <select
                    value={selectedPersonId}
                    onChange={(e) => {
                      const id = e.target.value
                      setSelectedPersonId(id)
                      if (!id) {
                        setSelectedCellId('')
                        return
                      }
                      const person = peopleById.get(id)
                      setSelectedCellId(
                        person ? personDefaultCellForPicker(person, props.legacyLdrLocations, props.cells) : '',
                      )
                    }}
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg"
                  >
                    <option value="" disabled>
                      Select person…
                    </option>
                    {addable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.initials}
                        {shortCellTag(p) ? ` · ${shortCellTag(p)}` : ''} — {personName(p)}
                      </option>
                    ))}
                  </select>
                </label>
                {props.scopeLevel === 'cell' ? null : (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Cell</p>
                    <div className="mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCellId('')}
                        className={`rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
                          !selectedCellId
                            ? 'border-violet-500 bg-violet-100 text-violet-950 ring-2 ring-offset-1 ring-offset-surface ring-violet-400/40'
                            : 'border-border bg-surface text-fg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        No cell
                      </button>
                      {props.cells.map((cell) => (
                        <button
                          key={cell.id}
                          type="button"
                          onClick={() => setSelectedCellId(cell.id)}
                          title={cell.label}
                          className={`max-w-full rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
                            selectedCellId === cell.id
                              ? 'border-violet-500 bg-violet-100 text-violet-950 ring-2 ring-offset-1 ring-offset-surface ring-violet-400/40'
                              : 'border-border bg-surface text-fg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className="line-clamp-2">{cell.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">RAG</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {LDR_RAG_OPTIONS.map((opt) => {
                      const active = addRag === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAddRag(opt.value)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? `${opt.active} ring-2 ring-offset-1 ring-offset-surface ring-slate-400/40`
                              : 'border-border bg-surface text-fg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted">
                  Comment
                  <textarea
                    value={addComment}
                    onChange={(e) => setAddComment(e.target.value)}
                    rows={2}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-fg placeholder:text-muted"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedPersonId) return
                    props.onAdd(selectedPersonId, {
                      masterCellId:
                        props.scopeLevel === 'cell'
                          ? props.contextMasterCellId || undefined
                          : selectedCellId || undefined,
                      rag_status: addRag,
                      comment: addComment,
                    })
                    setSelectedPersonId('')
                    setSelectedCellId('')
                    setAddRag('none')
                    setAddComment('')
                  }}
                  disabled={!selectedPersonId}
                  className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add assignment
                </button>
              </div>
            </div>
          ) : hasUnassignedPeople ? (
            <p className="rounded-xl border border-border bg-surface-raised/60 p-3 text-sm text-muted">
              No people available for this activity&apos;s scope. Add matching people under{' '}
              <strong className="text-fg/90">LDR tools → Admin → People</strong> for the same site or cell workspace
              as the activity.
            </p>
          ) : null}
        </div>
        </div>

      </div>
    </dialog>
  )
}

function AssignmentRowEditor(props: {
  row: LdrAssignmentRow
  cells: { id: string; label: string }[]
  cellSelectValue: string
  personLabel: string
  personFullName: string
  personInitials: string
  personAvatarVariant: number
  rosterActivityId: string
  assignmentDate: string
  effectiveMasterCellId: string | null
  obsReady: { sos: boolean; qos: boolean; ppo: boolean }
  showCompleteHcButton: boolean
  completeHcEnabled: boolean
  completeHcTitle?: string
  onCompleteHc?: () => void
  onStartObs: (
    kind: 'sos' | 'qos' | 'ppo',
    payload: { activityId: string; masterCellId: string; completionDate: string; assignmentId: string },
  ) => void
  completeObsEnabled: boolean
  completeObsTitle?: string
  onUpdate: (id: string, patch: Partial<Pick<LdrAssignmentRow, 'rag_status' | 'comment' | 'master_cell_id'>>) => void
  onRemove: (id: string) => void
}) {
  const [comment, setComment] = useState(() => props.row.comment)

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
        <div className="flex flex-wrap items-center gap-2">
          {props.showCompleteHcButton ? (
            <button
              type="button"
              title={props.completeHcTitle}
              disabled={!props.completeHcEnabled}
              onClick={() => props.onCompleteHc?.()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ClipboardCheck className="size-3.5 shrink-0" aria-hidden />
              Complete HC
            </button>
          ) : null}
          {props.obsReady.sos ? (
            <button
              type="button"
              title={props.completeObsTitle}
              disabled={!props.completeObsEnabled}
              onClick={() => {
                if (!props.completeObsEnabled || !props.effectiveMasterCellId) return
                props.onStartObs('sos', {
                  activityId: props.rosterActivityId,
                  masterCellId: props.effectiveMasterCellId,
                  completionDate: props.assignmentDate,
                  assignmentId: props.row.id,
                })
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ClipboardCheck className="size-3.5 shrink-0" aria-hidden />
              Complete SOS
            </button>
          ) : null}
          {props.obsReady.qos ? (
            <button
              type="button"
              title={props.completeObsTitle}
              disabled={!props.completeObsEnabled}
              onClick={() => {
                if (!props.completeObsEnabled || !props.effectiveMasterCellId) return
                props.onStartObs('qos', {
                  activityId: props.rosterActivityId,
                  masterCellId: props.effectiveMasterCellId,
                  completionDate: props.assignmentDate,
                  assignmentId: props.row.id,
                })
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ClipboardCheck className="size-3.5 shrink-0" aria-hidden />
              Complete QOS
            </button>
          ) : null}
          {props.obsReady.ppo ? (
            <button
              type="button"
              title={props.completeObsTitle}
              disabled={!props.completeObsEnabled}
              onClick={() => {
                if (!props.completeObsEnabled || !props.effectiveMasterCellId) return
                props.onStartObs('ppo', {
                  activityId: props.rosterActivityId,
                  masterCellId: props.effectiveMasterCellId,
                  completionDate: props.assignmentDate,
                  assignmentId: props.row.id,
                })
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ClipboardCheck className="size-3.5 shrink-0" aria-hidden />
              Complete PPOS
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => props.onRemove(props.row.id)}
            className="text-xs font-medium text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">RAG</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {LDR_RAG_OPTIONS.map((opt) => {
            const active = props.row.rag_status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => props.onUpdate(props.row.id, { rag_status: opt.value })}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? `${opt.active} ring-2 ring-offset-1 ring-offset-surface ring-slate-400/40`
                    : 'border-border bg-surface text-fg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Cell</p>
        <div className="mt-1 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-0.5">
          <button
            type="button"
            onClick={() => props.onUpdate(props.row.id, { master_cell_id: null })}
            className={`rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
              !props.cellSelectValue
                ? 'border-violet-500 bg-violet-100 text-violet-950 ring-2 ring-offset-1 ring-offset-surface ring-violet-400/40'
                : 'border-border bg-surface text-fg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            No cell
          </button>
          {props.cells.map((cell) => {
            const active = props.cellSelectValue === cell.id
            return (
              <button
                key={cell.id}
                type="button"
                onClick={() => props.onUpdate(props.row.id, { master_cell_id: cell.id })}
                title={cell.label}
                className={`max-w-full rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-violet-500 bg-violet-100 text-violet-950 ring-2 ring-offset-1 ring-offset-surface ring-violet-400/40'
                    : 'border-border bg-surface text-fg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className="line-clamp-2">{cell.label}</span>
              </button>
            )
          })}
        </div>
      </div>
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
