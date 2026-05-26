import { useCallback, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { DdsCellLine, DdsKpiLineEntry } from './ddsCellLines'
import { lineEntryKey } from './ddsCellLines'
import type { DdsKpiScoring } from './ddsKpiScoring'
import { evaluateKpiBlock } from './ddsKpiScoring'
import type { DdsKpiUnit } from './ddsKpiUnits'
import { formatKpiValueWithUnit } from './ddsKpiUnits'

export type ByLineKpiDef = {
  id: string
  label: string
  sort_order: number
  unit: DdsKpiUnit
  scoring: DdsKpiScoring
}

type Props = {
  cellId: string
  cellName: string
  lines: DdsCellLine[]
  kpis: ByLineKpiDef[]
  entries: DdsKpiLineEntry[]
  planDate: string
  shiftKind: string
  onSaved: () => void
}

function cellToneClass(tone: 'neutral' | 'good' | 'bad'): string {
  if (tone === 'good') return 'bg-emerald-600/15 text-emerald-950 dark:bg-emerald-900/30 dark:text-emerald-50'
  if (tone === 'bad') return 'bg-rose-600/15 text-rose-950 dark:bg-rose-900/30 dark:text-rose-50'
  return 'bg-sky-600/10 text-sky-950 dark:bg-sky-900/25 dark:text-sky-50'
}

export function SiteDdsByLineKpiTable({
  cellId,
  cellName,
  lines,
  kpis,
  entries,
  planDate,
  shiftKind,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const entryByKey = useMemo(() => {
    const m = new Map<string, DdsKpiLineEntry>()
    for (const e of entries) {
      if (e.master_cell_id !== cellId) continue
      m.set(lineEntryKey(e.line_id, e.kpi_id), e)
    }
    return m
  }, [entries, cellId])

  const saveValue = useCallback(
    async (lineId: string, kpi: ByLineKpiDef, raw: string) => {
      const key = lineEntryKey(lineId, kpi.id)
      const trimmed = raw.trim()
      const n = Number(trimmed.replace(',', '.'))
      const value_numeric = trimmed === '' || !Number.isFinite(n) ? null : n
      setSavingKey(key)
      setError(null)
      const { error: uErr } = await supabase.from('dds_kpi_line_entries').upsert(
        {
          master_cell_id: cellId,
          line_id: lineId,
          kpi_id: kpi.id,
          plan_date: planDate,
          shift_kind: shiftKind,
          value_numeric,
          updated_by: user?.id ?? null,
        },
        { onConflict: 'line_id,kpi_id,plan_date,shift_kind' },
      )
      setSavingKey(null)
      if (uErr) setError(uErr.message)
      else onSaved()
    },
    [cellId, planDate, shiftKind, user?.id, onSaved],
  )

  if (kpis.length === 0) return null

  if (lines.length === 0) {
    return (
      <div className="mt-1 rounded-md border border-dashed border-border/70 bg-canvas/30 px-2 py-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{cellName} — by line</p>
        <p className="mt-0.5 text-[10px] text-muted">
          No lines configured for this cell. Add lines under Admin → Cell lines.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-1 overflow-x-auto rounded-md border border-border/60">
      <p className="border-b border-border/60 bg-canvas/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
        {cellName} — by line
      </p>
      {error ? <p className="px-2 py-1 text-[10px] text-rose-700 dark:text-rose-300">{error}</p> : null}
      <table className="w-full min-w-[12rem] border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-border/60 bg-surface-raised/50">
            <th className="sticky left-0 z-[1] min-w-[5.5rem] border-r border-border/50 bg-surface-raised/80 px-2 py-1 text-left font-semibold text-muted">
              Metric
            </th>
            {lines.map((line) => (
              <th key={line.id} className="min-w-[3.5rem] px-1.5 py-1 text-center font-semibold text-muted">
                {line.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi) => (
            <tr key={kpi.id} className="border-b border-border/40 last:border-b-0">
              <td className="sticky left-0 z-[1] border-r border-border/50 bg-canvas/80 px-2 py-0.5 font-medium text-fg">
                {kpi.label}
              </td>
              {lines.map((line) => {
                const key = lineEntryKey(line.id, kpi.id)
                const entry = entryByKey.get(key)
                const val = entry?.value_numeric
                const tone = evaluateKpiBlock(val, kpi.scoring)
                const display =
                  val != null && Number.isFinite(val) ? formatKpiValueWithUnit(val, kpi.unit) : ''
                return (
                  <td key={line.id} className="p-0.5">
                    <label className="sr-only">
                      {kpi.label} — {line.name}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={!user || savingKey === key}
                        defaultValue={val != null && Number.isFinite(val) ? String(val) : ''}
                        key={`${key}-${val ?? 'empty'}-${planDate}-${shiftKind}`}
                        placeholder="—"
                        className={`w-full min-w-[3rem] rounded border border-transparent px-1 py-0.5 text-center text-[10px] font-semibold tabular-nums outline-none ring-accent/40 focus:border-border focus:ring-1 disabled:opacity-60 ${cellToneClass(tone)}`}
                        onBlur={(e) => {
                          const next = e.target.value
                          const prev =
                            val != null && Number.isFinite(val) ? String(val) : ''
                          if (next.trim() === prev.trim()) return
                          void saveValue(line.id, kpi, next)
                        }}
                      />
                      {savingKey === key ? (
                        <Loader2
                          className="pointer-events-none absolute right-0.5 top-1/2 size-3 -translate-y-1/2 animate-spin text-muted"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    {display && tone !== 'neutral' ? (
                      <span className="sr-only">{display}</span>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
