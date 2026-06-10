import { bmsBlockAccentClass, bmsBlockClass, bmsBlockRadiusClass, bmsBlockSoftBadgeClass, bmsBlockSurfaceClass } from './bmsBlockStyles'
import { MATRIX_CELL_NO_DATA } from './matrixCellNoData'
import type { RoleForumMatrixCell } from './roleForumMatrixTypes'
import type { MatrixDensity } from './matrixLayout'

type Props = {
  cell: RoleForumMatrixCell | null
  hasSteps: boolean
  density: MatrixDensity
  fontSize: number
}

export function BmsBrainRoleForumCell({ cell, hasSteps, density, fontSize }: Props) {
  if (!hasSteps) {
    return <p className="text-[10px] italic text-muted/70">{MATRIX_CELL_NO_DATA}</p>
  }

  if (!cell) {
    return <p className="text-[10px] text-muted">Analysing cell…</p>
  }

  if (!cell.headline && !cell.groups.length && !cell.gap) {
    return <p className="text-[10px] text-muted">Analysing cell…</p>
  }

  const tight = density === 'tight'
  const tagSize = Math.max(8, fontSize - 1)

  return (
    <div className="min-w-0 space-y-1 leading-snug" style={{ fontSize }}>
      {cell.headline ? (
        <p className="font-semibold leading-snug text-fg">{cell.headline}</p>
      ) : null}

      <div className={['flex min-w-0 flex-col', tight ? 'gap-0.5' : 'gap-1'].join(' ')}>
        {cell.groups.map((group) => (
          <div
            key={group.title}
            className={[
              'relative min-w-0 overflow-hidden border px-1.5 py-1 pl-2',
              bmsBlockClass.process,
              bmsBlockRadiusClass('process'),
              bmsBlockSurfaceClass,
            ].join(' ')}
          >
            <span className={['absolute inset-y-0 left-0 w-1 opacity-75', bmsBlockAccentClass.process].join(' ')} aria-hidden />
            <div className="flex min-w-0 items-start justify-between gap-1">
              <div className="truncate font-semibold leading-tight tracking-[-0.01em]">{group.title}</div>
              {!tight ? (
                <span className={['shrink-0 rounded-full px-1 py-px font-semibold uppercase leading-none', bmsBlockSoftBadgeClass.process].join(' ')} style={{ fontSize: tagSize }}>
                  Group
                </span>
              ) : null}
            </div>
            {group.items.length ? (
              <ul className="mt-0.5 list-none space-y-px pl-0">
                {group.items.slice(0, tight ? 2 : 4).map((item) => (
                  <li key={item} className="flex gap-1 leading-snug opacity-90">
                    <span className="mt-[0.3rem] size-0.5 shrink-0 rounded-full bg-current" aria-hidden />
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {!tight && group.systems?.length ? (
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {group.systems.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="rounded bg-black/[0.06] px-0.5 font-medium leading-none text-fg/80"
                    style={{ fontSize: tagSize }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {cell.systems.length ? (
        <div className="flex flex-wrap gap-0.5 pt-0.5">
          {cell.systems.slice(0, tight ? 3 : 5).map((s) => (
            <span
              key={s}
              className="rounded bg-accent/10 px-1 py-px font-medium text-accent"
              style={{ fontSize: tagSize }}
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {cell.gap && cell.gap !== MATRIX_CELL_NO_DATA ? (
        <p className="text-[10px] italic text-amber-800/80">{cell.gap}</p>
      ) : null}
    </div>
  )
}
