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
  start: 'border-emerald-400 bg-emerald-50 text-emerald-900',
  end: 'border-slate-400 bg-slate-100 text-slate-800',
  decision: 'border-amber-500 bg-amber-50 text-amber-950',
  process: 'border-sky-300 bg-sky-50 text-sky-950',
  review: 'border-violet-400 bg-violet-50 text-violet-950',
  document: 'border-indigo-400 bg-indigo-50 text-indigo-950',
  subprocess: 'border-pink-400 bg-pink-50 text-pink-950',
}

export function bmsBlockShape(kind: BmsNodeKind): BmsBlockShape {
  if (kind === 'start' || kind === 'end') return 'oval'
  if (kind === 'decision') return 'diamond'
  return 'rectangle'
}

export function bmsBlockRadiusClass(kind: BmsNodeKind): string {
  return bmsBlockShape(kind) === 'oval' ? 'rounded-full' : 'rounded-lg'
}
