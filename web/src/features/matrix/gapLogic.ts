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
      return 'bg-rose-100 text-rose-900 ring-1 ring-rose-200/90'
    case 'minor':
      return 'bg-amber-100 text-amber-950 ring-1 ring-amber-200/90'
    case 'meet':
      return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/90'
    case 'exceed':
      return 'bg-teal-100 text-teal-900 ring-1 ring-teal-200/90'
    case 'extra':
      return 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/90'
    case 'na':
    default:
      return 'bg-zinc-100/90 text-zinc-600 ring-1 ring-zinc-200/80'
  }
}

export function formatLevel(kind: SkillKind, level: number | null): string {
  if (level == null) return '—'
  if (kind === 'certification') {
    return level >= 1 ? 'Y' : 'N'
  }
  return String(level)
}
