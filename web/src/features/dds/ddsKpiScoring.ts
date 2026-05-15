/**
 * KPI scoring / colour rules (stored as JSON on `dds_kpis.scoring`).
 * UI: Shift DDS shows green/red blocks from `evaluateKpiBlock`; no target → blue.
 */

export type DdsKpiScoring =
  | { kind: 'no_target' }
  | { kind: 'min_red'; target: number }
  | { kind: 'max_red'; target: number }
  | { kind: 'range_green'; min: number; max: number }
  | { kind: 'symmetric_abs'; target: number; tolerance: number }
  | { kind: 'symmetric_pct'; target: number; tolerancePct: number }

export type KpiBlockTone = 'neutral' | 'good' | 'bad'

const DEFAULT_SCORING: DdsKpiScoring = { kind: 'no_target' }

function fmtTarget(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Number.isInteger(n)) return String(n)
  return String(n)
}

/** Target line on KPI blocks: digits only (and spaces between numbers where needed). */
export function scoringTargetNumbersOnly(s: DdsKpiScoring): string {
  switch (s.kind) {
    case 'no_target':
      return ''
    case 'min_red':
    case 'max_red':
      return fmtTarget(s.target)
    case 'range_green':
      return `${fmtTarget(s.min)} ${fmtTarget(s.max)}`
    case 'symmetric_abs':
      return `${fmtTarget(s.target)} ${fmtTarget(s.tolerance)}`
    case 'symmetric_pct':
      return `${fmtTarget(s.target)} ${fmtTarget(s.tolerancePct)}`
    default:
      return ''
  }
}

export function parseDdsKpiScoring(raw: unknown): DdsKpiScoring {
  if (!raw || typeof raw !== 'object') return DEFAULT_SCORING
  const o = raw as Record<string, unknown>
  const kind = o.kind
  if (kind === 'no_target') return { kind: 'no_target' }
  if (kind === 'min_red' && typeof o.target === 'number' && Number.isFinite(o.target)) return { kind: 'min_red', target: o.target }
  if (kind === 'max_red' && typeof o.target === 'number' && Number.isFinite(o.target)) return { kind: 'max_red', target: o.target }
  if (
    kind === 'range_green' &&
    typeof o.min === 'number' &&
    typeof o.max === 'number' &&
    Number.isFinite(o.min) &&
    Number.isFinite(o.max)
  ) {
    return { kind: 'range_green', min: o.min, max: o.max }
  }
  if (
    kind === 'symmetric_abs' &&
    typeof o.target === 'number' &&
    typeof o.tolerance === 'number' &&
    Number.isFinite(o.target) &&
    Number.isFinite(o.tolerance) &&
    o.tolerance >= 0
  ) {
    return { kind: 'symmetric_abs', target: o.target, tolerance: o.tolerance }
  }
  if (
    kind === 'symmetric_pct' &&
    typeof o.target === 'number' &&
    typeof o.tolerancePct === 'number' &&
    Number.isFinite(o.target) &&
    Number.isFinite(o.tolerancePct) &&
    o.tolerancePct >= 0
  ) {
    return { kind: 'symmetric_pct', target: o.target, tolerancePct: o.tolerancePct }
  }
  // Legacy pass_fail removed — treat as no target.
  if (kind === 'pass_fail') return { kind: 'no_target' }
  return DEFAULT_SCORING
}

export function scoringHint(s: DdsKpiScoring): string {
  switch (s.kind) {
    case 'no_target':
      return 'No target'
    case 'min_red':
      return `≥ ${s.target} ok`
    case 'max_red':
      return `≤ ${s.target} ok`
    case 'range_green':
      return `${s.min}–${s.max}`
    case 'symmetric_abs':
      return `${s.target} ± ${s.tolerance}`
    case 'symmetric_pct':
      return `${s.target} ± ${s.tolerancePct}%`
    default:
      return ''
  }
}

/** When value is null/undefined, tone is neutral (prompt to enter). */
export function evaluateKpiBlock(value: number | null | undefined, s: DdsKpiScoring): KpiBlockTone {
  if (value == null || !Number.isFinite(value)) return 'neutral'
  const v = value
  switch (s.kind) {
    case 'no_target':
      return 'neutral'
    case 'min_red':
      return v < s.target ? 'bad' : 'good'
    case 'max_red':
      return v > s.target ? 'bad' : 'good'
    case 'range_green':
      return v >= s.min && v <= s.max ? 'good' : 'bad'
    case 'symmetric_abs':
      return Math.abs(v - s.target) <= s.tolerance ? 'good' : 'bad'
    case 'symmetric_pct': {
      const tol = (Math.abs(s.target) * s.tolerancePct) / 100
      return Math.abs(v - s.target) <= tol ? 'good' : 'bad'
    }
    default:
      return 'neutral'
  }
}

export const DDS_KPI_SCORING_KIND_OPTIONS: { value: DdsKpiScoring['kind']; label: string }[] = [
  { value: 'no_target', label: 'No target (blue)' },
  { value: 'min_red', label: 'Below target = red' },
  { value: 'max_red', label: 'Above target = red' },
  { value: 'range_green', label: 'Inside min–max = green' },
  { value: 'symmetric_abs', label: '± absolute from target' },
  { value: 'symmetric_pct', label: '± % from target' },
]
