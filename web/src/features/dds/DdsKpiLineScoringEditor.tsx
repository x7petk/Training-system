import type { DdsCellLine } from './ddsCellLines'
import { ddsKpiCellColumnLabel } from './ddsCellLines'
import {
  defaultScoringForKind,
  scoringHint,
  scoringKindNeedsLineTargets,
  type DdsKpiScoring,
} from './ddsKpiScoring'
import { ddsInput } from './ddsAdminCompactClasses'

export type AdminLineWithCell = DdsCellLine & {
  cellName: string
}

type Props = {
  kind: DdsKpiScoring['kind']
  lines: AdminLineWithCell[]
  lineScoringByLineId: Record<string, DdsKpiScoring>
  onChange: (lineId: string, scoring: DdsKpiScoring) => void
}

function lineScoringForKind(
  kind: DdsKpiScoring['kind'],
  lineId: string,
  lineScoringByLineId: Record<string, DdsKpiScoring>,
): DdsKpiScoring {
  const existing = lineScoringByLineId[lineId]
  if (existing && existing.kind === kind) return existing
  return defaultScoringForKind(kind)
}

function numInput(label: string, val: number, onChange: (n: number) => void) {
  return (
    <label className="min-w-0">
      <span className="text-[10px] font-medium text-muted">{label}</span>
      <input
        type="number"
        className={ddsInput}
        value={Number.isFinite(val) ? val : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function lineTargetFields(
  lineId: string,
  s: DdsKpiScoring,
  onChange: (lineId: string, scoring: DdsKpiScoring) => void,
) {
  switch (s.kind) {
    case 'min_red':
      return numInput('Target', s.target, (n) => onChange(lineId, { kind: 'min_red', target: n }))
    case 'max_red':
      return numInput('Target', s.target, (n) => onChange(lineId, { kind: 'max_red', target: n }))
    case 'range_green':
      return (
        <div className="grid grid-cols-2 gap-2">
          {numInput('Min', s.min, (n) => onChange(lineId, { kind: 'range_green', min: n, max: s.max }))}
          {numInput('Max', s.max, (n) => onChange(lineId, { kind: 'range_green', min: s.min, max: n }))}
        </div>
      )
    case 'symmetric_abs':
      return (
        <div className="grid grid-cols-2 gap-2">
          {numInput('Target', s.target, (n) =>
            onChange(lineId, { kind: 'symmetric_abs', target: n, tolerance: s.tolerance }),
          )}
          {numInput('± absolute', s.tolerance, (n) =>
            onChange(lineId, { kind: 'symmetric_abs', target: s.target, tolerance: Math.max(0, n) }),
          )}
        </div>
      )
    case 'symmetric_pct':
      return (
        <div className="grid grid-cols-2 gap-2">
          {numInput('Target', s.target, (n) =>
            onChange(lineId, { kind: 'symmetric_pct', target: n, tolerancePct: s.tolerancePct }),
          )}
          {numInput('± %', s.tolerancePct, (n) =>
            onChange(lineId, { kind: 'symmetric_pct', target: s.target, tolerancePct: Math.max(0, n) }),
          )}
        </div>
      )
    default:
      return null
  }
}

export function DdsKpiLineScoringEditor({ kind, lines, lineScoringByLineId, onChange }: Props) {
  if (!scoringKindNeedsLineTargets(kind)) {
    return <p className="text-[10px] text-muted">{scoringHint(defaultScoringForKind(kind))}</p>
  }

  if (lines.length === 0) {
    return (
      <p className="text-[10px] text-muted">
        No active lines yet. Add lines under Admin → Cell lines for each cell, then set a target per line here.
      </p>
    )
  }

  const multiCell = new Set(lines.map((l) => l.master_cell_id)).size > 1

  return (
    <div className="overflow-x-auto rounded border border-border/60">
      <table className="w-full min-w-[20rem] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border/60 bg-surface-raised/40 text-[10px] text-muted">
            <th className="px-2 py-1.5 font-semibold">Line</th>
            {multiCell ? <th className="px-2 py-1.5 font-semibold">Cell</th> : null}
            <th className="px-2 py-1.5 font-semibold">Target</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const scoring = lineScoringForKind(kind, line.id, lineScoringByLineId)
            return (
              <tr key={line.id} className="border-b border-border/40 last:border-b-0">
                <td className="px-2 py-1.5 font-medium text-fg">{line.name}</td>
                {multiCell ? (
                  <td className="px-2 py-1.5 text-muted">{ddsKpiCellColumnLabel(line.cellName)}</td>
                ) : null}
                <td className="px-2 py-1.5">{lineTargetFields(line.id, scoring, onChange)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function buildInitialLineScoringDrafts(
  kind: DdsKpiScoring['kind'],
  lines: AdminLineWithCell[],
  template: DdsKpiScoring,
  existingByLineId: Record<string, DdsKpiScoring>,
): Record<string, DdsKpiScoring> {
  const next: Record<string, DdsKpiScoring> = {}
  for (const line of lines) {
    const existing = existingByLineId[line.id]
    if (existing && existing.kind === kind) {
      next[line.id] = existing
    } else if (template.kind === kind && scoringKindNeedsLineTargets(kind)) {
      next[line.id] = template
    } else {
      next[line.id] = defaultScoringForKind(kind)
    }
  }
  return next
}
