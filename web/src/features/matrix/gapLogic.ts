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

export function gapKindClasses(kind: GapKind): string {
  switch (kind) {
    case 'critical':
      return 'bg-rose-500/35 text-rose-50 ring-1 ring-rose-400/40'
    case 'minor':
      return 'bg-amber-500/25 text-amber-50 ring-1 ring-amber-400/35'
    case 'meet':
      return 'bg-emerald-500/25 text-emerald-50 ring-1 ring-emerald-400/30'
    case 'exceed':
      return 'bg-teal-600/30 text-teal-50 ring-1 ring-teal-400/35'
    case 'extra':
      return 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/25'
    case 'na':
    default:
      return 'bg-white/[0.03] text-muted'
  }
}

export function formatLevel(kind: SkillKind, level: number | null): string {
  if (level == null) return '—'
  if (kind === 'certification') {
    return level >= 1 ? 'Y' : 'N'
  }
  return String(level)
}
