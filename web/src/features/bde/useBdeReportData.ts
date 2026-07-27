import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BdeActionRow, BdeCatalogOption, BdeCodeKind, BdePersonMini, BdePhotoRow, BdeRecordRow } from './bdeTypes'
import {
  type BdeEnrichedRecord,
  type BdeTimePreset,
  inTimeRange,
  matchesSearch,
  rangeForPreset,
} from './bdeReportUtils'

export type BdeRecordCodeLink = {
  bde_id: string
  code_kind: BdeCodeKind
  code_id: string
  code_label: string
}

export type BdeReportBundle = {
  loading: boolean
  error: string | null
  reload: () => void
  records: BdeEnrichedRecord[]
  actions: BdeActionRow[]
  photosByBde: Map<string, BdePhotoRow[]>
  codesByBde: Map<string, BdeRecordCodeLink[]>
  peopleById: Map<string, BdePersonMini>
  areas: { id: string; name: string }[]
  equipment: { id: string; area_id: string; name: string }[]
  lines: { id: string; name: string }[]
  problemTypes: BdeCatalogOption[]
}

export function useBdeReportBundle(cellId: string | null): BdeReportBundle {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<BdeEnrichedRecord[]>([])
  const [actions, setActions] = useState<BdeActionRow[]>([])
  const [photosByBde, setPhotosByBde] = useState<Map<string, BdePhotoRow[]>>(new Map())
  const [codesByBde, setCodesByBde] = useState<Map<string, BdeRecordCodeLink[]>>(new Map())
  const [peopleById, setPeopleById] = useState<Map<string, BdePersonMini>>(new Map())
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; area_id: string; name: string }[]>([])
  const [lines, setLines] = useState<{ id: string; name: string }[]>([])
  const [problemTypes, setProblemTypes] = useState<BdeCatalogOption[]>([])
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!cellId) {
      setRecords([])
      setActions([])
      setPhotosByBde(new Map())
      setCodesByBde(new Map())
      setAreas([])
      setEquipment([])
      setLines([])
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)

      const [areaRes, eqRes, lineRes, typeRes, recRes, peopleRes, actCodes, objCodes, dmgCodes, causeCodes] =
        await Promise.all([
          supabase.from('master_areas').select('id, name').eq('cell_id', cellId).order('sort_order').order('name'),
          supabase.from('master_equipment').select('id, area_id, name').order('sort_order').order('name'),
          supabase
            .from('dds_cell_lines')
            .select('id, name')
            .eq('master_cell_id', cellId)
            .eq('active', true)
            .order('sort_order')
            .order('name'),
          supabase.from('bde_problem_types').select('id, label, sort_order, is_active').order('sort_order'),
          supabase
            .from('bde_records')
            .select('*')
            .eq('master_cell_id', cellId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase.from('people').select('id, display_name, first_name, last_name').order('display_name').limit(500),
          supabase.from('bde_activity_codes').select('id, label'),
          supabase.from('bde_object_part_codes').select('id, label'),
          supabase.from('bde_damage_codes').select('id, label'),
          supabase.from('bde_cause_codes').select('id, label'),
        ])

      if (cancelled) return

      if (recRes.error) {
        setLoading(false)
        setError(recRes.error.message)
        return
      }

      const areaList = (areaRes.data ?? []) as { id: string; name: string }[]
      const areaIds = new Set(areaList.map((a) => a.id))
      const eqList = ((eqRes.data ?? []) as { id: string; area_id: string; name: string }[]).filter((e) =>
        areaIds.has(e.area_id),
      )
      const lineList = (lineRes.data ?? []) as { id: string; name: string }[]
      const typeList = (typeRes.data ?? []) as BdeCatalogOption[]

      const areaMap = new Map(areaList.map((a) => [a.id, a.name]))
      const eqMap = new Map(eqList.map((e) => [e.id, e.name]))
      const typeMap = new Map(typeList.map((t) => [t.id, t.label]))

      const enriched: BdeEnrichedRecord[] = ((recRes.data ?? []) as BdeRecordRow[]).map((r) => ({
        ...r,
        area_name: r.area_id ? areaMap.get(r.area_id) ?? null : null,
        equipment_name: r.equipment_id ? eqMap.get(r.equipment_id) ?? null : null,
        problem_type_label: r.problem_type_id ? typeMap.get(r.problem_type_id) ?? null : null,
        // Line is a separate dimension; v1 reports don't store line_id on BDE — leave null for filters by equipment/area.
        line_id: null,
        line_name: null,
      }))

      const ids = enriched.map((r) => r.id)
      let actionList: BdeActionRow[] = []
      let photoMap = new Map<string, BdePhotoRow[]>()
      let codeMap = new Map<string, BdeRecordCodeLink[]>()

      if (ids.length > 0) {
        const [actRes, photoRes, codeRes] = await Promise.all([
          supabase.from('bde_actions').select('*').in('bde_id', ids).is('deleted_at', null).order('created_at', {
            ascending: false,
          }),
          supabase
            .from('bde_record_photos')
            .select('id, bde_id, storage_path, file_name, sort_order, created_at')
            .in('bde_id', ids)
            .order('sort_order'),
          supabase.from('bde_record_codes').select('bde_id, code_kind, code_id').in('bde_id', ids),
        ])

        if (actRes.error || photoRes.error || codeRes.error) {
          if (!cancelled) {
            setLoading(false)
            setError(actRes.error?.message ?? photoRes.error?.message ?? codeRes.error?.message ?? 'Load failed')
          }
          return
        }

        actionList = (actRes.data ?? []) as BdeActionRow[]
        photoMap = new Map()
        for (const p of (photoRes.data ?? []) as BdePhotoRow[]) {
          const list = photoMap.get(p.bde_id) ?? []
          list.push(p)
          photoMap.set(p.bde_id, list)
        }

        const labelMaps: Record<BdeCodeKind, Map<string, string>> = {
          activity: new Map(((actCodes.data ?? []) as { id: string; label: string }[]).map((c) => [c.id, c.label])),
          object_part: new Map(((objCodes.data ?? []) as { id: string; label: string }[]).map((c) => [c.id, c.label])),
          damage: new Map(((dmgCodes.data ?? []) as { id: string; label: string }[]).map((c) => [c.id, c.label])),
          cause: new Map(((causeCodes.data ?? []) as { id: string; label: string }[]).map((c) => [c.id, c.label])),
        }

        codeMap = new Map()
        for (const c of (codeRes.data ?? []) as { bde_id: string; code_kind: BdeCodeKind; code_id: string }[]) {
          const list = codeMap.get(c.bde_id) ?? []
          list.push({
            bde_id: c.bde_id,
            code_kind: c.code_kind,
            code_id: c.code_id,
            code_label: labelMaps[c.code_kind]?.get(c.code_id) ?? c.code_id.slice(0, 8),
          })
          codeMap.set(c.bde_id, list)
        }
      }

      const peopleMap = new Map(
        ((peopleRes.data ?? []) as BdePersonMini[]).map((p) => [p.id, p] as const),
      )

      if (!cancelled) {
        setAreas(areaList)
        setEquipment(eqList)
        setLines(lineList)
        setProblemTypes(typeList)
        setRecords(enriched)
        setActions(actionList)
        setPhotosByBde(photoMap)
        setCodesByBde(codeMap)
        setPeopleById(peopleMap)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cellId, tick])

  return {
    loading,
    error,
    reload,
    records,
    actions,
    photosByBde,
    codesByBde,
    peopleById,
    areas,
    equipment,
    lines,
    problemTypes,
  }
}

export type BdeReportFilters = {
  preset: BdeTimePreset
  search: string
  areaId: string
  equipmentId: string
  createdBy: string
  statusFilter: '' | 'saved' | 'completed'
  problemTypeLabel: string
}

export function filterRecords(
  records: BdeEnrichedRecord[],
  filters: BdeReportFilters,
): BdeEnrichedRecord[] {
  const { from, to } = rangeForPreset(filters.preset)
  const q = filters.search.trim().toLowerCase()
  return records.filter((r) => {
    if (!inTimeRange(r.created_at, from, to)) return false
    if (!matchesSearch(r, q)) return false
    if (filters.areaId && r.area_id !== filters.areaId) return false
    if (filters.equipmentId && r.equipment_id !== filters.equipmentId) return false
    if (filters.createdBy && (r.created_by_name ?? '') !== filters.createdBy) return false
    if (filters.statusFilter && r.status !== filters.statusFilter) return false
    if (filters.problemTypeLabel) {
      const label = r.problem_type_label?.trim() || 'Unspecified'
      if (label !== filters.problemTypeLabel) return false
    }
    return true
  })
}

export function useFilteredRecords(records: BdeEnrichedRecord[], filters: BdeReportFilters) {
  return useMemo(() => filterRecords(records, filters), [records, filters])
}
