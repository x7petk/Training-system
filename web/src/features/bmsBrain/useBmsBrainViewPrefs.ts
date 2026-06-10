import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DEFAULT_BMS_FILTERS, DEFAULT_BMS_VIEWPORT, type BmsViewFilters, type BmsViewViewport } from './types'

const VIEW_KEY = 'matrix'

export function useBmsBrainViewPrefs(userId: string | undefined) {
  const [filters, setFilters] = useState<BmsViewFilters>(DEFAULT_BMS_FILTERS)
  const [viewport, setViewport] = useState<BmsViewViewport>(DEFAULT_BMS_VIEWPORT)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!userId) return
    void (async () => {
      const { data } = await supabase
        .from('bms_brain_user_views')
        .select('filters, viewport')
        .eq('user_id', userId)
        .eq('view_key', VIEW_KEY)
        .maybeSingle()
      if (data?.filters) setFilters({ ...DEFAULT_BMS_FILTERS, ...(data.filters as BmsViewFilters) })
      if (data?.viewport) {
        const raw = data.viewport as Record<string, unknown>
        const rawMode = typeof raw.viewMode === 'string' ? raw.viewMode : undefined
        const viewMode =
          rawMode === 'matrixAi' || rawMode === 'roleForum'
            ? 'matrixAi'
            : rawMode === 'roleSummaries' || rawMode === 'flow'
              ? 'roleSummaries'
              : rawMode === 'matrix'
                ? 'matrix'
                : DEFAULT_BMS_VIEWPORT.viewMode
        setViewport({ ...DEFAULT_BMS_VIEWPORT, ...(data.viewport as BmsViewViewport), viewMode })
      }
      setLoaded(true)
    })()
  }, [userId])

  const persist = useCallback(
    (nextFilters: BmsViewFilters, nextViewport: BmsViewViewport) => {
      if (!userId) return
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        void supabase.from('bms_brain_user_views').upsert({
          user_id: userId,
          view_key: VIEW_KEY,
          filters: nextFilters,
          viewport: nextViewport,
          updated_at: new Date().toISOString(),
        })
      }, 400)
    },
    [userId],
  )

  const updateFilters = useCallback(
    (patch: Partial<BmsViewFilters>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch }
        persist(next, viewport)
        return next
      })
    },
    [persist, viewport],
  )

  const updateViewport = useCallback(
    (patch: Partial<BmsViewViewport>) => {
      setViewport((prev) => {
        const next = { ...prev, ...patch }
        persist(filters, next)
        return next
      })
    },
    [persist, filters],
  )

  const resetView = useCallback(() => {
    setFilters(DEFAULT_BMS_FILTERS)
    setViewport(DEFAULT_BMS_VIEWPORT)
    persist(DEFAULT_BMS_FILTERS, DEFAULT_BMS_VIEWPORT)
  }, [persist])

  return { filters, viewport, loaded, updateFilters, updateViewport, resetView, setFilters, setViewport }
}
