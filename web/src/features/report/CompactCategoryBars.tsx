import type { ReactNode } from 'react'

const CHART_BAR_AREA_PX = 150

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

export function CompactCategoryBars(props: {
  title: string
  subtitle?: string
  items: Array<{ key: string; label: string; value: number }>
  selectedKey: string | null
  onToggleKey: (key: string) => void
  controls?: ReactNode
  emptyHint?: string
  barClassName?: string
  selectedBarClassName?: string
  barClassByKey?: Partial<Record<string, string>>
  selectedBarClassByKey?: Partial<Record<string, string>>
}) {
  const {
    title,
    subtitle,
    items,
    selectedKey,
    onToggleKey,
    controls,
    emptyHint,
    barClassName,
    selectedBarClassName,
    barClassByKey,
    selectedBarClassByKey,
  } = props

  const values = items.map((x) => x.value)
  const maxChart = Math.max(1, ...values)
  const ticks = chartYTicks(maxChart)
  const normalBarCls = barClassName ?? 'bg-sky-500 hover:brightness-110'
  const selectedBarCls = selectedBarClassName ?? 'bg-sky-600'

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
        <p className="mt-3 text-xs text-muted">{emptyHint ?? 'No data in this view.'}</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {controls ?? null}
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
          <div className="flex items-end gap-0.5" role="group" aria-label={title}>
            {items.map((item) => {
              const barPx = Math.max(3, Math.round((item.value / maxChart) * CHART_BAR_AREA_PX))
              const selected = selectedKey === item.key
              const itemNormalCls = barClassByKey?.[item.key] ?? normalBarCls
              const itemSelectedCls = selectedBarClassByKey?.[item.key] ?? selectedBarCls
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onToggleKey(item.key)}
                  aria-pressed={selected}
                  title={`${item.label}: ${item.value}`}
                  className={`flex min-w-[1.75rem] flex-1 flex-col items-stretch gap-0.5 rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    selected ? 'ring-2 ring-sky-600 ring-offset-1 ring-offset-canvas' : ''
                  }`}
                >
                  <span className="text-center text-[9px] font-semibold tabular-nums">{item.value}</span>
                  <div className="flex flex-col justify-end" style={{ height: CHART_BAR_AREA_PX }}>
                    <span
                      className={`w-full rounded-t-sm transition-colors ${selected ? itemSelectedCls : itemNormalCls}`}
                      style={{ height: `${barPx}px` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-0.5 flex gap-1.5 border-t border-border/50 pt-1">
        <div className="w-6 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {items.map((item) => (
            <div key={`label-${item.key}`} className="min-w-[1.75rem] flex-1 text-center text-[8px] leading-tight text-muted">
              <span title={item.label} className="line-clamp-2">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
