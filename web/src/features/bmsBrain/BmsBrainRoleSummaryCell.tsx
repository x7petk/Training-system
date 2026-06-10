import { MATRIX_CELL_NO_DATA } from './matrixCellNoData'
import type { RoleSummaryCell } from './roleSummaryMatrixTypes'
import type { MatrixDensity } from './matrixLayout'

type Props = {
  cell: RoleSummaryCell | null
  hasSteps: boolean
  density: MatrixDensity
  fontSize: number
}

function BulletList({ label, items, fontSize }: { label: string; items: string[]; fontSize: number }) {
  if (!items.length) return null
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <ul className="mt-0.5 list-none space-y-0.5 pl-0">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5 leading-snug" style={{ fontSize }}>
            <span className="mt-[0.35rem] size-1 shrink-0 rounded-full bg-accent/60" aria-hidden />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BmsBrainRoleSummaryCell({ cell, hasSteps, density, fontSize }: Props) {
  if (!hasSteps) {
    return <p className="text-[10px] italic text-muted/70">{MATRIX_CELL_NO_DATA}</p>
  }

  if (!cell) {
    return <p className="text-[10px] text-muted">Generating summary…</p>
  }

  const tight = density === 'tight'

  return (
    <div className="min-w-0 space-y-1.5 leading-snug" style={{ fontSize }}>
      {cell.purpose ? (
        <p className="font-medium leading-snug text-fg">{cell.purpose}</p>
      ) : null}
      {cell.systems.length && !tight ? (
        <div className="flex flex-wrap gap-0.5">
          {cell.systems.map((s) => (
            <span key={s} className="rounded bg-accent/10 px-1 py-px text-[9px] font-medium text-accent">
              {s}
            </span>
          ))}
        </div>
      ) : null}
      <BulletList label="Must do" items={cell.mustDo} fontSize={fontSize} />
      {!tight ? <BulletList label="Decisions" items={cell.decisions} fontSize={fontSize} /> : null}
      {!tight ? <BulletList label="Handoffs" items={cell.handoffs} fontSize={fontSize} /> : null}
      {cell.gap && cell.gap !== MATRIX_CELL_NO_DATA ? (
        <p className="text-[10px] italic text-amber-800/80">{cell.gap}</p>
      ) : null}
    </div>
  )
}
