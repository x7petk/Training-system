import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { BmsProcessFlow, BmsProcessRow, BmsProcessStatus } from './types'

export function useBmsBrainProcesses(includeDrafts: boolean) {
  const [rows, setRows] = useState<BmsProcessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let q = supabase.from('bms_brain_processes').select('*').order('updated_at', { ascending: false })
    if (!includeDrafts) q = q.eq('status', 'published')
    const { data, error: e } = await q
    if (e) {
      setError(e.message)
      setRows([])
    } else {
      setRows((data ?? []) as BmsProcessRow[])
    }
    setLoading(false)
  }, [includeDrafts])

  useEffect(() => {
    void load()
  }, [load])

  return { rows, loading, error, reload: load, setRows }
}

export async function saveBmsProcess(
  id: string | null,
  patch: {
    name: string
    description: string
    status: BmsProcessStatus
    flow: BmsProcessFlow
    owner_role_id: string | null
    catalog_system_id?: string | null
  },
  userId: string,
): Promise<{ row: BmsProcessRow | null; error: string | null }> {
  if (id) {
    const { data, error } = await supabase
      .from('bms_brain_processes')
      .update({ ...patch, updated_by: userId })
      .eq('id', id)
      .select('*')
      .single()
    return { row: (data as BmsProcessRow) ?? null, error: error?.message ?? null }
  }
  const { data, error } = await supabase
    .from('bms_brain_processes')
    .insert({ ...patch, created_by: userId, updated_by: userId })
    .select('*')
    .single()
  return { row: (data as BmsProcessRow) ?? null, error: error?.message ?? null }
}

export async function publishBmsProcess(
  process: BmsProcessRow,
  userId: string,
  note = '',
): Promise<{ error: string | null }> {
  const { count } = await supabase
    .from('bms_brain_process_versions')
    .select('*', { count: 'exact', head: true })
    .eq('process_id', process.id)
  const versionNo = (count ?? 0) + 1
  const { error: vErr } = await supabase.from('bms_brain_process_versions').insert({
    process_id: process.id,
    version_no: versionNo,
    snapshot: process,
    published_by: userId,
    note,
  })
  if (vErr) return { error: vErr.message }
  const { error } = await supabase
    .from('bms_brain_processes')
    .update({ status: 'published', updated_by: userId })
    .eq('id', process.id)
  return { error: error?.message ?? null }
}
