import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { workspaceOrSeed } from './normalizeWorkspace'
import { SWP_SEED } from './seed'
import type { SwpProcessFlow, SwpSystem, SwpWorkspace } from './types'

type DbRow = {
  id: string
  workspace: Record<string, unknown> | null
}

export function useSwpStore() {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState<SwpWorkspace>(SWP_SEED)
  const [rowId, setRowId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowIdRef = useRef<string | null>(null)

  const flushSave = useCallback(
    async (next: SwpWorkspace, id: string | null) => {
      if (!user?.id) return
      setSaving(true)
      setError(null)
      const payload = { workspace: next as unknown as Record<string, unknown> }
      if (id) {
        const { error: err } = await supabase.from('swp_workspaces').update(payload).eq('id', id)
        setSaving(false)
        if (err) setError(err.message)
      } else {
        const { data, error: err } = await supabase
          .from('swp_workspaces')
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
    (next: SwpWorkspace) => {
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
      setWorkspace(structuredClone(SWP_SEED))
      setReady(true)
      return
    }

    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error: err } = await supabase
        .from('swp_workspaces')
        .select('id, workspace')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      setLoading(false)

      if (err) {
        setError(err.message)
        setReady(true)
        return
      }

      const row = data as DbRow | null
      if (row?.workspace) {
        setWorkspace(workspaceOrSeed(row.workspace))
        setRowId(row.id)
        setReady(true)
        return
      }

      const seed = structuredClone(SWP_SEED)
      setWorkspace(seed)
      const { data: inserted, error: insErr } = await supabase
        .from('swp_workspaces')
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
  }, [user?.id])

  const updateSystems = useCallback(
    (systems: SwpSystem[]) => {
      persist({ ...workspace, systems })
    },
    [persist, workspace],
  )

  const updateFlow = useCallback(
    (flow: SwpProcessFlow) => {
      const flows = workspace.flows.map((f) => (f.systemId === flow.systemId ? flow : f))
      if (!flows.some((f) => f.systemId === flow.systemId)) flows.push(flow)
      persist({ ...workspace, flows })
    },
    [persist, workspace],
  )

  const resetToSeed = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const seed = structuredClone(SWP_SEED)
    setWorkspace(seed)
    void flushSave(seed, rowIdRef.current)
  }, [flushSave])

  return {
    workspace,
    ready,
    loading,
    saving,
    error,
    updateSystems,
    updateFlow,
    resetToSeed,
  }
}
