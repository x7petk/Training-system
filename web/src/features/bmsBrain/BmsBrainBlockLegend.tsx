import { BMS_BLOCK_LEGEND, bmsBlockClass, type BmsBlockShape } from './bmsBlockStyles'

function LegendShape({ shape, kind }: { shape: BmsBlockShape; kind: (typeof BMS_BLOCK_LEGEND)[number]['kind'] }) {
  const cls = bmsBlockClass[kind]

  if (shape === 'diamond') {
    return (
      <span className="relative flex size-7 shrink-0 items-center justify-center" aria-hidden>
        <span className={['absolute inset-0.5 rotate-45 rounded-sm border-2', cls].join(' ')} />
      </span>
    )
  }

  if (shape === 'oval') {
    return (
      <span
        className={['inline-flex h-5 min-w-[2.75rem] shrink-0 items-center justify-center rounded-full border-2', cls].join(' ')}
        aria-hidden
      />
    )
  }

  return (
    <span
      className={['inline-flex h-5 w-9 shrink-0 items-center justify-center rounded-md border-2', cls].join(' ')}
      aria-hidden
    />
  )
}

type Props = {
  compact?: boolean
  className?: string
}

export function BmsBrainBlockLegend({ compact, className = '' }: Props) {
  return (
    <section
      className={[
        'rounded-2xl border border-border bg-surface-raised/50',
        compact ? 'p-3' : 'p-4',
        className,
      ].join(' ')}
      aria-label="Flow block legend"
    >
      <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">Block legend</h3>
      <ul className={['mt-2 grid gap-2', compact ? 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7' : 'sm:grid-cols-2 lg:grid-cols-3'].join(' ')}>
        {BMS_BLOCK_LEGEND.map((item) => (
          <li key={item.kind} className="flex items-start gap-2 text-xs">
            <LegendShape shape={item.shape} kind={item.kind} />
            <div className="min-w-0">
              <p className="font-semibold text-fg">{item.label}</p>
              {!compact ? <p className="mt-0.5 text-[11px] leading-snug text-muted">{item.description}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
