import { AlertTriangle, Database } from 'lucide-react'
import type { EvidenceItem, MockDefect } from '../types'

export function EvidenceHub(props: {
  items: EvidenceItem[]
  defects: MockDefect[]
  loading?: boolean
}) {
  const { items, defects, loading } = props

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-accent" aria-hidden />
        <h3 className="font-display text-sm font-semibold">AI Evidence Hub</h3>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          Mock connected systems
        </span>
      </div>
      <p className="text-xs text-muted">
        Facts pulled from process & historian, alarms, quality/lab, CMMS, MES, standards, and previous issues.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Collecting evidence…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((ev) => (
            <li
              key={ev.id}
              className={[
                'rounded-xl border px-3 py-2',
                ev.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50'
                  : ev.severity === 'warn'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-border bg-surface-raised',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                {ev.severity !== 'info' ? (
                  <AlertTriangle
                    className={`mt-0.5 size-3.5 shrink-0 ${ev.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-fg">{ev.title}</p>
                    <span className="text-[10px] text-muted">{new Date(ev.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{ev.source}</p>
                  <p className="mt-0.5 text-xs text-fg/80">{ev.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {defects.length ? (
        <div className="rounded-xl border border-border bg-canvas px-3 py-2">
          <p className="text-xs font-semibold text-fg">Linked defects (mock)</p>
          <ul className="mt-1 space-y-1">
            {defects.map((d) => (
              <li key={d.id} className="flex justify-between gap-2 text-xs">
                <span>
                  {d.title} — {d.description}
                </span>
                <span className={d.status === 'open' ? 'text-amber-700' : 'text-emerald-700'}>{d.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
