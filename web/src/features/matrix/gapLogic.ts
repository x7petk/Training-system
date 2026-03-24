/** Matches skill_matrix.md §9 (numeric scale 1–4; certification 0/1). */

export type GapKind =
  | 'na'
  | 'critical'
  | 'minor'
  | 'meet'
  | 'exceed'
  | 'extra'

export type SkillKind = 'numeric' | 'certification'

export function classifyCell(params: {
  kind: SkillKind
  required: number | null
  actual: number | null
  isExtra: boolean
}): GapKind {
  const { kind, required, actual, isExtra } = params

  const hasActual = actual != null
  const hasRequired = required != null

  if (!hasRequired && !hasActual) return 'na'

  if (isExtra || (!hasRequired && hasActual)) return 'extra'

  if (!hasRequired) return 'na'

  if (kind === 'certification') {
    if (required >= 1) {
      if (actual == null || actual < 1) return 'critical'
      return 'meet'
    }
    return 'na'
  }

  if (actual == null) return 'critical'

  const delta = actual - required
  if (delta <= -2) return 'critical'
  if (delta === -1) return 'minor'
  if (delta === 0) return 'meet'
  return 'exceed'
}

const GAP_PALETTE: Record<
  GapKind,
  { surface: string; ringIdle: string; ringSelected: string }
> = {
  critical: {
    surface: 'bg-rose-100 text-rose-900',
    ringIdle: 'ring-1 ring-rose-200/90',
    ringSelected: 'ring-4 ring-rose-400/80',
  },
  minor: {
    surface: 'bg-amber-100 text-amber-950',
    ringIdle: 'ring-1 ring-amber-200/90',
    ringSelected: 'ring-4 ring-amber-400/80',
  },
  meet: {
    surface: 'bg-emerald-100 text-emerald-900',
    ringIdle: 'ring-1 ring-emerald-200/90',
    ringSelected: 'ring-4 ring-emerald-400/80',
  },
  exceed: {
    surface: 'bg-teal-100 text-teal-900',
    ringIdle: 'ring-1 ring-teal-200/90',
    ringSelected: 'ring-4 ring-teal-400/80',
  },
  extra: {
    surface: 'bg-sky-100 text-sky-900',
    ringIdle: 'ring-1 ring-sky-200/90',
    ringSelected: 'ring-4 ring-sky-400/80',
  },
  na: {
    surface: 'bg-zinc-100/90 text-zinc-600',
    ringIdle: 'ring-1 ring-zinc-200/80',
    ringSelected: 'ring-4 ring-zinc-400/70',
  },
}

/** Matrix cell chip (heatmap). */
export function gapKindClasses(kind: GapKind): string {
  const p = GAP_PALETTE[kind]
  return `${p.surface} ${p.ringIdle}`
}

/** Editor option button: same colours as the matrix for the resulting gap. */
export function gapKindEditorOptionClasses(kind: GapKind, selected: boolean): string {
  const p = GAP_PALETTE[kind]
  const base = `${p.surface} transition-[box-shadow,opacity,transform]`
  if (selected) {
    return `${base} ${p.ringSelected} ring-offset-2 ring-offset-surface-raised shadow-md`
  }
  return `${base} ${p.ringIdle} opacity-[0.88] hover:opacity-100`
}

/** Short label aligned with matrix legend copy. */
export function gapKindLegendLabel(kind: GapKind): string {
  switch (kind) {
    case 'critical':
      return 'Critical gap'
    case 'minor':
      return 'Minor gap'
    case 'meet':
      return 'Meets'
    case 'exceed':
      return 'Exceeds'
    case 'extra':
      return 'Extra skill'
    case 'na':
    default:
      return 'N/A'
  }
}

export function formatLevel(kind: SkillKind, level: number | null): string {
  if (level == null) return '—'
  if (kind === 'certification') {
    return level >= 1 ? 'Y' : 'N'
  }
  return String(level)
}
