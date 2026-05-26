import type { DdsKpiScoring } from './ddsKpiScoring'

type Props = {
  scoring: DdsKpiScoring
  valueStr: string
  onChange: (valueStr: string) => void
  disabled?: boolean
  inputClassName?: string
  placeholder?: string
}

export function isDdsKpiPassFailScoring(scoring: DdsKpiScoring): boolean {
  return scoring.kind === 'pass_fail'
}

/** Pass/fail KPIs: Yes = 1 (pass), No = 0 (fail). Other scoring kinds use a numeric text input. */
export function DdsKpiValueField({
  scoring,
  valueStr,
  onChange,
  disabled,
  inputClassName = 'mt-1 w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2',
  placeholder = 'e.g. 98.5',
}: Props) {
  if (isDdsKpiPassFailScoring(scoring)) {
    const yesSelected = valueStr === '1'
    const noSelected = valueStr === '0'
    return (
      <div
        className="mt-1 inline-flex items-center gap-0.5 rounded-md border border-border/80 bg-surface-raised/30 p-0.5"
        role="group"
        aria-label="Yes or no"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('1')}
          className={`h-8 min-w-[3.25rem] rounded px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
            yesSelected
              ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/40'
              : 'text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('0')}
          className={`h-8 min-w-[3.25rem] rounded px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
            noSelected
              ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-500/40'
              : 'text-rose-800 hover:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/20'
          }`}
        >
          No
        </button>
      </div>
    )
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      className={inputClassName}
      value={valueStr}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}
