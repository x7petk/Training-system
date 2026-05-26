import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { normalizeWorkspace } from './normalizeWorkspace'
import { hydrateKpiCascadeDemoIfEmpty, KPI_CASCADE_SEED } from './seed'
import type { KpiCascadeCatalogKey, KpiCascadeWorkspace } from './types'

type DbRow = {
  id: string
  workspace: Record<string, unknown> | null
}

export function useKpiCascadeStore() {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState<KpiCascadeWorkspace>(KPI_CASCADE_SEED)
  const [rowId, setRowId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowIdRef = useRef<string | null>(null)

  const flushSave = useCallback(
    async (next: KpiCascadeWorkspace, id: string | null) => {
      if (!user?.id) return
      setSaving(true)
      setError(null)
      const payload = { workspace: next as unknown as Record<string, unknown> }
      if (id) {
        const { error: err } = await supabase.from('kpi_cascade_workspaces').update(payload).eq('id', id)
        setSaving(false)
        if (err) setError(err.message)
      } else {
        const { data, error: err } = await supabase
          .from('kpi_cascade_workspaces')
          .insert({ user_id: user.id, ...payload })
          .select('id')
          .single()
        setSaving(false)
        if (err) setError(err.message)
        else setRowId((data as { id: string }).id)
      }
    },
    [user?.id],
  )

  const persist = useCallback(
    (next: KpiCascadeWorkspace) => {
      setWorkspace(next)
      if (!user?.id) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => void flushSave(next, rowIdRef.current), 500)
    },
    [flushSave, user?.id],
  )

  useEffect(() => {
    rowIdRef.current = rowId
  }, [rowId])

  useEffect(() => {
    if (!user?.id) {
      setWorkspace(structuredClone(KPI_CASCADE_SEED))
      setReady(true)
      return
    }

    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error: err } = await supabase
        .from('kpi_cascade_workspaces')
        .select('id, workspace')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      setLoading(false)

      if (err) {
        setWorkspace(structuredClone(KPI_CASCADE_SEED))
        setError(err.message.includes('kpi_cascade_workspaces') ? null : err.message)
        setReady(true)
        return
      }

      const row = data as DbRow | null
      const normalized = normalizeWorkspace(row?.workspace)
      if (normalized) {
        const { workspace: hydrated, changed } = hydrateKpiCascadeDemoIfEmpty(normalized)
        setWorkspace(hydrated)
        const id = row?.id ?? null
        setRowId(id)
        setReady(true)
        if (changed && id) void flushSave(hydrated, id)
        return
      }

      const seed = structuredClone(KPI_CASCADE_SEED)
      setWorkspace(seed)
      const { data: inserted, error: insErr } = await supabase
        .from('kpi_cascade_workspaces')
        .insert({ user_id: user.id, workspace: seed as unknown as Record<string, unknown> })
        .select('id')
        .single()

      if (!cancelled) {
        if (insErr) setError(insErr.message)
        else setRowId((inserted as { id: string } | null)?.id ?? null)
        setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, flushSave])

  const updateCatalog = useCallback(
    (key: KpiCascadeCatalogKey, items: KpiCascadeWorkspace[typeof key]) => {
      persist({ ...workspace, [key]: items })
    },
    [persist, workspace],
  )

  const replaceWorkspace = useCallback(
    (next: KpiCascadeWorkspace) => {
      persist(next)
    },
    [persist],
  )

  const resetToSeed = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const seed = structuredClone(KPI_CASCADE_SEED)
    setWorkspace(seed)
    void flushSave(seed, rowIdRef.current)
  }, [flushSave])

  return {
    workspace,
    ready,
    loading,
    saving,
    error,
    updateCatalog,
    replaceWorkspace,
    resetToSeed,
  }
}
