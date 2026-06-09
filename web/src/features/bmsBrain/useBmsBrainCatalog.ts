import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BmsCatalogKind, BmsCatalogRow } from './types'

const TABLE: Record<BmsCatalogKind, string> = {
  roles: 'bms_brain_roles',
  forums: 'bms_brain_forums',
  systems: 'bms_brain_systems',
}

export function useBmsBrainCatalog(kind: BmsCatalogKind, includeInactive = false) {
  const [rows, setRows] = useState<BmsCatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase.from(TABLE[kind]).select('*').order('sort_order').order('name')
    if (!includeInactive) q = q.eq('is_active', true)
    const { data, error: e } = await q
    if (e) {
      setError(e.message)
      setRows([])
    } else {
      setRows((data ?? []) as BmsCatalogRow[])
    }
    setLoading(false)
  }, [kind, includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  return { rows, loading, error, reload: load, setRows }
}

export function useBmsBrainFullCatalog() {
  const roles = useBmsBrainCatalog('roles')
  const forums = useBmsBrainCatalog('forums')
  const systems = useBmsBrainCatalog('systems')
  const loading = roles.loading || forums.loading || systems.loading
  const error = roles.error ?? forums.error ?? systems.error
  const reload = useCallback(async () => {
    await Promise.all([roles.reload(), forums.reload(), systems.reload()])
  }, [roles, forums, systems])
  return { roles: roles.rows, forums: forums.rows, systems: systems.rows, loading, error, reload }
}
