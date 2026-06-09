import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { BmsProcessVersionRow } from './types'

type Props = {
  processId: string
}

export function BmsBrainVersionHistory({ processId }: Props) {
  const [rows, setRows] = useState<BmsProcessVersionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const { data } = await supabase
        .from('bms_brain_process_versions')
        .select('*')
        .eq('process_id', processId)
        .order('version_no', { ascending: false })
      setRows((data ?? []) as BmsProcessVersionRow[])
      setLoading(false)
    })()
  }, [processId])

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/50 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
        <History className="size-4 text-muted" aria-hidden />
        Version history
      </h3>
      {loading ? <p className="mt-2 text-xs text-muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No published versions yet.</p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {rows.map((v) => (
          <li key={v.id} className="rounded-lg border border-border/70 bg-canvas/40 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">v{v.version_no}</span>
              <span className="text-muted">{new Date(v.published_at).toLocaleString()}</span>
            </div>
            {v.note ? <p className="mt-1 text-muted">{v.note}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
