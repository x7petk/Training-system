import type { Plan24SubTask } from './plan24Types'

export type Plan24ClQualityVariant = 'cl' | 'quality'

export function valueOutsideLimits(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min != null && value < min) return true
  if (max != null && value > max) return true
  return false
}

type RouteStepKind = 'pass_fail' | 'number' | 'range' | 'text'

/** Effective step kind for UI and completion (Quality is always pass/fail; CL never uses pass_fail). */
export function plan24ClQualityEffectiveStepKind(
  variant: Plan24ClQualityVariant,
  input_kind?: string | null,
): RouteStepKind {
  if (variant === 'quality') return 'pass_fail'
  const raw = String(input_kind ?? 'number').toLowerCase()
  if (raw === 'text') return 'text'
  if (raw === 'range') return 'range'
  if (raw === 'number') return 'number'
  return 'number'
}

function clSubTaskDataEntryComplete(s: Plan24SubTask): boolean {
  const ik = plan24ClQualityEffectiveStepKind('cl', s.input_kind)
  if (ik === 'number' || ik === 'range') {
    if (s.entered_value == null || Number.isNaN(Number(s.entered_value))) return false
    return !valueOutsideLimits(Number(s.entered_value), s.min_value, s.max_value)
  }
  if (ik === 'text') {
    return Boolean((s.text_value ?? '').trim())
  }
  return false
}

/** True when operator has satisfied this sub-task for route completion (non-admin). */
export function plan24ClQualitySubTaskComplete(s: Plan24SubTask, variant: Plan24ClQualityVariant): boolean {
  if (variant === 'quality') {
    return s.result === 'pass' || s.result === 'fail'
  }
  return clSubTaskDataEntryComplete(s)
}
