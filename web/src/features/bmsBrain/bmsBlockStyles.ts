import type { BmsNodeKind } from './types'

export type BmsBlockShape = 'oval' | 'rectangle' | 'diamond'

export type BmsBlockLegendItem = {
  kind: BmsNodeKind
  label: string
  description: string
  shape: BmsBlockShape
}

export const BMS_BLOCK_LEGEND: BmsBlockLegendItem[] = [
  { kind: 'start', label: 'Start', description: 'Entry point or trigger that begins the flow.', shape: 'oval' },
  { kind: 'process', label: 'Process', description: 'Action step — work performed by a role.', shape: 'rectangle' },
  { kind: 'decision', label: 'Decision', description: 'Branch point — yes/no or multiple paths.', shape: 'diamond' },
  { kind: 'review', label: 'Review', description: 'Review, sign-off, or forum checkpoint.', shape: 'rectangle' },
  { kind: 'document', label: 'Document', description: 'Reference record, form, or artefact.', shape: 'rectangle' },
  { kind: 'subprocess', label: 'Subprocess', description: 'Linked sub-flow or nested process.', shape: 'rectangle' },
  { kind: 'end', label: 'End', description: 'Outcome — flow complete or hand-off done.', shape: 'oval' },
]

export const bmsBlockClass: Record<BmsNodeKind, string> = {
  start: 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 text-emerald-950',
  end: 'border-slate-300 bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900',
  decision: 'border-amber-400 bg-gradient-to-br from-amber-50 via-white to-orange-100 text-amber-950',
  process: 'border-sky-300 bg-gradient-to-br from-sky-50 via-white to-cyan-100 text-sky-950',
  review: 'border-violet-300 bg-gradient-to-br from-violet-50 via-white to-fuchsia-100 text-violet-950',
  document: 'border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-blue-100 text-indigo-950',
  subprocess: 'border-pink-300 bg-gradient-to-br from-pink-50 via-white to-rose-100 text-pink-950',
}

export const bmsBlockAccentClass: Record<BmsNodeKind, string> = {
  start: 'bg-emerald-500',
  end: 'bg-slate-500',
  decision: 'bg-amber-500',
  process: 'bg-sky-500',
  review: 'bg-violet-500',
  document: 'bg-indigo-500',
  subprocess: 'bg-pink-500',
}

export const bmsBlockSoftBadgeClass: Record<BmsNodeKind, string> = {
  start: 'bg-emerald-500/10 text-emerald-800',
  end: 'bg-slate-500/10 text-slate-700',
  decision: 'bg-amber-500/10 text-amber-800',
  process: 'bg-sky-500/10 text-sky-800',
  review: 'bg-violet-500/10 text-violet-800',
  document: 'bg-indigo-500/10 text-indigo-800',
  subprocess: 'bg-pink-500/10 text-pink-800',
}

export const bmsBlockInteractiveClass =
  'shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_20px_rgba(15,23,42,0.04)] hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:translate-y-0'

export const bmsBlockSurfaceClass =
  'shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-white/60'

export const bmsBlockKindLabel: Record<BmsNodeKind, string> = {
  start: 'Start',
  end: 'End',
  decision: 'Decision',
  process: 'Process',
  review: 'Review',
  document: 'Doc',
  subprocess: 'Subflow',
}

export function bmsBlockShape(kind: BmsNodeKind): BmsBlockShape {
  if (kind === 'start' || kind === 'end') return 'oval'
  if (kind === 'decision') return 'diamond'
  return 'rectangle'
}

export function bmsBlockRadiusClass(kind: BmsNodeKind): string {
  return bmsBlockShape(kind) === 'oval' ? 'rounded-full' : 'rounded-lg'
}
