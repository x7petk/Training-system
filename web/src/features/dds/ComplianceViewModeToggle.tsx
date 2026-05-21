import { CalendarDays, LayoutList, Rows3 } from 'lucide-react'
import type { ComplianceKpiViewMode } from './ddsComplianceConstants'

const MODES: { id: ComplianceKpiViewMode; label: string; icon: typeof CalendarDays }[] = [
  { id: 'day', label: 'Day', icon: CalendarDays },
  { id: 'week', label: 'Week', icon: Rows3 },
  { id: 'table', label: 'Table', icon: LayoutList },
]

type Props = {
  value: ComplianceKpiViewMode
  onChange: (mode: ComplianceKpiViewMode) => void
}

export function ComplianceViewModeToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-border bg-surface-raised/50 p-0.5"
      role="group"
      aria-label="KPI view"
    >
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition ${
            value === id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          <Icon className="size-3" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
