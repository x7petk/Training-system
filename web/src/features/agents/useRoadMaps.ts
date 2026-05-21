import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  EMPTY_INPUTS,
  type RoadMapInputs,
  type RoadMapResult,
  type RoadMapRow,
  type RoadMapViewMode,
} from './roadMapBuilderTypes'

type DbRoadMapRow = {
  id: string
  user_id: string
  title: string
  inputs: Record<string, unknown> | null
  result: Record<string, unknown> | null
  view_mode: RoadMapViewMode
  created_at: string
  updated_at: string
}

function normalizeRow(row: DbRoadMapRow): RoadMapRow {
  const rawInputs = (row.inputs ?? {}) as Partial<RoadMapInputs>
  const inputs: RoadMapInputs = { ...EMPTY_INPUTS, ...rawInputs }
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    inputs,
    result: (row.result as RoadMapResult | null) ?? null,
    view_mode: row.view_mode,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function useRoadMaps() {
  const { user } = useAuth()
  const [rows, setRows] = useState<RoadMapRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('road_maps')
      .select('id, user_id, title, inputs, result, view_mode, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setRows((data as DbRoadMapRow[]).map(normalizeRow))
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const createRoadMap = useCallback(
    async (title: string, inputs: RoadMapInputs): Promise<RoadMapRow | null> => {
      if (!user) return null
      setError(null)
      const { data, error: err } = await supabase
        .from('road_maps')
        .insert({
          user_id: user.id,
          title: title.trim() || 'Untitled roadmap',
          inputs,
          view_mode: inputs.preferredView,
        })
        .select('id, user_id, title, inputs, result, view_mode, created_at, updated_at')
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      const next = normalizeRow(data as DbRoadMapRow)
      setRows((prev) => [next, ...prev])
      return next
    },
    [user],
  )

  const updateRoadMap = useCallback(
    async (
      id: string,
      patch: Partial<{ title: string; inputs: RoadMapInputs; result: RoadMapResult | null; view_mode: RoadMapViewMode }>,
    ): Promise<RoadMapRow | null> => {
      setError(null)
      const { data, error: err } = await supabase
        .from('road_maps')
        .update(patch)
        .eq('id', id)
        .select('id, user_id, title, inputs, result, view_mode, created_at, updated_at')
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      const next = normalizeRow(data as DbRoadMapRow)
      setRows((prev) => prev.map((r) => (r.id === id ? next : r)))
      return next
    },
    [],
  )

  const deleteRoadMap = useCallback(async (id: string): Promise<boolean> => {
    setError(null)
    const { error: err } = await supabase.from('road_maps').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return false
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
    return true
  }, [])

  return { rows, loading, error, reload: load, createRoadMap, updateRoadMap, deleteRoadMap }
}
