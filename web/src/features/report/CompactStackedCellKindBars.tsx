import type { ObsKind } from '../observations/obsKind'

const CHART_BAR_AREA_PX = 180

function chartYTicks(maxValue: number): number[] {
  const max = Math.max(0, maxValue)
  if (max === 0) return [0]
  const segments = 4
  const set = new Set<number>()
  for (let i = 0; i <= segments; i++) {
    set.add(Math.round((max * (segments - i)) / segments))
  }
  return [...set].sort((a, b) => b - a)
}

/** DOM top → bottom = PPOS, QOS, SOS (SOS at foot of bar) */
const STACK_ORDER: ObsKind[] = ['ppo', 'qos', 'sos']

function segmentClass(kind: ObsKind, selected: boolean): string {
  if (kind === 'sos') return selected ? 'bg-emerald-600' : 'bg-emerald-500'
  if (kind === 'qos') return selected ? 'bg-sky-600' : 'bg-sky-500'
  return selected ? 'bg-violet-600' : 'bg-violet-500'
}

export type CellKindCounts = { cellId: string; label: string; sos: number; qos: number; ppo: number }

export function CompactStackedCellKindBars(props: {
  title: string
  subtitle?: string
  cells: CellKindCounts[]
  selectedCellId: string | null
  onToggleCell: (cellId: string) => void
  emptyHint?: string
}) {
  const { title, subtitle, cells, selectedCellId, onToggleCell, emptyHint } = props

  const totals = cells.map((c) => c.sos + c.qos + c.ppo)
  const maxChart = Math.max(1, ...totals)
  const ticks = chartYTicks(maxChart)

  if (cells.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
        <p className="mt-3 text-xs text-muted">{emptyHint ?? 'No cells in scope.'}</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-500" aria-hidden />
            SOS
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-sky-500" aria-hidden />
            QOS
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-violet-500" aria-hidden />
            PPOS
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        <div className="flex shrink-0 flex-col justify-end" aria-hidden>
          <div className="h-4 shrink-0" />
          <div
            className="flex w-6 flex-col justify-between text-right text-[9px] tabular-nums text-muted"
            style={{ height: CHART_BAR_AREA_PX }}
          >
            {ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-0.5">
          <div className="flex items-end gap-1" role="group" aria-label={title}>
            {cells.map((c) => {
              const total = c.sos + c.qos + c.ppo
              const selected = selectedCellId === c.cellId
              const stackPx = total === 0 ? 3 : Math.max(4, Math.round((total / maxChart) * CHART_BAR_AREA_PX))
              const seg = (n: number) => (total === 0 ? 0 : Math.round((n / total) * stackPx))

              return (
                <button
                  key={c.cellId}
                  type="button"
                  onClick={() => onToggleCell(c.cellId)}
                  aria-pressed={selected}
                  title={`${c.label}: ${total} (SOS ${c.sos}, QOS ${c.qos}, PPOS ${c.ppo})`}
                  className={`flex min-w-[2.25rem] max-w-[8rem] flex-1 flex-col items-stretch gap-0.5 rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    selected ? 'ring-2 ring-sky-600 ring-offset-1 ring-offset-canvas' : ''
                  }`}
                >
                  <span className="text-center text-[9px] font-semibold tabular-nums">{total}</span>
                  <div className="flex flex-col justify-end" style={{ height: CHART_BAR_AREA_PX }}>
                    {total === 0 ? (
                      <div className="flex h-full w-full items-end">
                        <div className="h-1 w-full rounded-sm bg-border/80" title="0" />
                      </div>
                    ) : (
                      <div className="flex w-full flex-col overflow-hidden rounded-t-sm" style={{ height: `${stackPx}px` }}>
                        {STACK_ORDER.map((k) => {
                          const n = k === 'sos' ? c.sos : k === 'qos' ? c.qos : c.ppo
                          if (n <= 0) return null
                          const h = seg(n)
                          return (
                            <div
                              key={k}
                              className={`w-full shrink-0 ${segmentClass(k, selected)} ${selected ? '' : 'hover:brightness-110'}`}
                              style={{ height: `${Math.max(2, h)}px` }}
                              title={`${k.toUpperCase()}: ${n}`}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-0.5 flex gap-1.5 border-t border-border/50 pt-1">
        <div className="w-6 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {cells.map((c) => (
            <div
              key={`label-${c.cellId}`}
              className="min-w-[2.25rem] max-w-[8rem] flex-1 text-center text-[8px] leading-tight text-muted"
            >
              <span title={c.label} className="line-clamp-3">
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
