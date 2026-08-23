import { ChevronLeft, ChevronRight } from 'lucide-react'
import { resolveNextShift, resolvePreviousShift } from '../plan24/plan24ShiftUtils'

type ShiftOption = { kind: string; display_name: string | null }
type RoleOption = { id: string; name: string }

type Props = {
  planDate: string
  shiftKind: string
  roleId: string
  shifts: ShiftOption[]
  roles: RoleOption[]
  onPlanDateChange: (ymd: string) => void
  onShiftKindChange: (kind: string) => void
  onRoleIdChange: (id: string) => void
  disabled?: boolean
  className?: string
}

const navBtn =
  'inline-flex size-6 shrink-0 items-center justify-center rounded text-muted hover:bg-black/[0.06] hover:text-fg disabled:opacity-35 dark:hover:bg-white/[0.06]'
const selectClass =
  'h-6 max-w-[7.5rem] shrink-0 rounded border border-border/80 bg-surface px-1 text-[11px] outline-none ring-accent/30 focus:border-accent/50 focus:ring-1 disabled:opacity-50'
const dateClass =
  'h-6 w-[6.75rem] shrink-0 rounded border border-border/80 bg-surface px-1 text-[11px] font-medium tabular-nums outline-none ring-accent/30 focus:border-accent/50 focus:ring-1 disabled:opacity-50'

export function DdsP2pScopeFilterBar({
  planDate,
  shiftKind,
  roleId,
  shifts,
  roles,
  onPlanDateChange,
  onShiftKindChange,
  onRoleIdChange,
  disabled = false,
  className = '',
}: Props) {
  function stepShift(delta: -1 | 1) {
    if (!planDate || !shiftKind || shifts.length === 0) return
    const next =
      delta === 1
        ? resolveNextShift(planDate, shiftKind, shifts)
        : resolvePreviousShift(planDate, shiftKind, shifts)
    onPlanDateChange(next.planDate)
    onShiftKindChange(next.shiftKind)
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`.trim()}>
      <div className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 bg-surface-raised/40 p-0.5">
        <button
          type="button"
          className={navBtn}
          aria-label="Previous shift"
          disabled={disabled || shifts.length === 0}
          onClick={() => stepShift(-1)}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </button>
        <input
          type="date"
          className={dateClass}
          value={planDate}
          disabled={disabled}
          aria-label="Plan date"
          onChange={(e) => onPlanDateChange(e.target.value)}
        />
        <button
          type="button"
          className={navBtn}
          aria-label="Next shift"
          disabled={disabled || shifts.length === 0}
          onClick={() => stepShift(1)}
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
      <select
        className={selectClass}
        value={shiftKind}
        disabled={disabled || shifts.length === 0}
        aria-label="Shift"
        onChange={(e) => onShiftKindChange(e.target.value)}
      >
        {shifts.map((s) => (
          <option key={s.kind} value={s.kind}>
            {s.display_name?.trim() || s.kind}
          </option>
        ))}
      </select>
      <select
        className={`${selectClass} min-w-[5rem] max-w-[9rem]`}
        value={roleId}
        disabled={disabled || roles.length === 0}
        aria-label="Role"
        onChange={(e) => onRoleIdChange(e.target.value)}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  )
}
