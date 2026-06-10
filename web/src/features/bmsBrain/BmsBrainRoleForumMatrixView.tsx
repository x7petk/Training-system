import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { BmsBrainRoleForumCell } from './BmsBrainRoleForumCell'
import { computeMatrixLayout, matrixBlockTypography } from './matrixLayout'
import { roleForumCellKey, type RoleForumMatrixCell } from './roleForumMatrixTypes'
import type { BmsCatalogRow } from './types'

type Props = {
  roles: BmsCatalogRow[]
  forums: BmsCatalogRow[]
  filters: { systemIds: string[]; roleIds: string[]; forumIds: string[] }
  viewportWidth: number
  zoom: number
  cells: Map<string, RoleForumMatrixCell>
  stepPresence: Map<string, boolean>
  loading: boolean
  error: string | null
}

export function BmsBrainRoleForumMatrixView({
  roles,
  forums,
  filters,
  viewportWidth,
  zoom,
  cells,
  stepPresence,
  loading,
  error,
}: Props) {
  const visibleRoles = roles.filter((r) => !filters.roleIds.length || filters.roleIds.includes(r.id))
  const visibleForums = forums.filter((f) => !filters.forumIds.length || filters.forumIds.includes(f.id))

  const layout = useMemo(
    () => computeMatrixLayout(viewportWidth, visibleRoles.length, zoom),
    [viewportWidth, visibleRoles.length, zoom],
  )

  const { labelW, cellMinH, headerH, density, blockScale, gridW } = layout
  const cellPad = density === 'tight' ? 'p-1.5' : 'p-2'
  const summaryCellMinH = Math.max(cellMinH, Math.round(96 * blockScale))
  const fontSize = matrixBlockTypography(blockScale).label

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Generating simplified matrix summaries…
        </div>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <div
        className="overflow-auto rounded-2xl border border-border bg-white shadow-sm"
        style={{ maxHeight: 'min(75vh, 900px)' }}
      >
        <div className="relative w-full" style={{ width: gridW, minWidth: '100%' }}>
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `${labelW}px repeat(${visibleRoles.length}, minmax(0, 1fr))`,
              gridTemplateRows: `${headerH}px repeat(${visibleForums.length}, minmax(${summaryCellMinH}px, auto))`,
            }}
          >
            <div
              className={[
                'sticky left-0 top-0 z-20 border-b border-r border-border bg-surface-raised/90 font-semibold',
                density === 'tight' ? 'p-1 text-[9px]' : 'p-1.5 text-[10px]',
              ].join(' ')}
            >
              Forum / Role
            </div>
            {visibleRoles.map((r) => (
              <div
                key={r.id}
                className={[
                  'sticky top-0 z-10 border-b border-r border-border bg-surface-raised/90 text-center font-semibold',
                  density === 'tight' ? 'p-1 text-[9px]' : 'p-1.5 text-[10px]',
                ].join(' ')}
                style={{ color: r.color }}
              >
                {r.name}
              </div>
            ))}
            {visibleForums.map((forum) => (
              <div key={forum.id} className="contents">
                <div
                  className={[
                    'sticky left-0 z-10 border-b border-r border-border bg-surface-raised/80 font-medium',
                    density === 'tight' ? 'p-1 text-[9px]' : 'p-1.5 text-[10px]',
                  ].join(' ')}
                  style={{ color: forum.color }}
                >
                  <div className="font-semibold">{forum.name}</div>
                  {density !== 'tight' ? (
                    <div className="line-clamp-2 text-[9px] text-muted">{forum.description}</div>
                  ) : null}
                </div>
                {visibleRoles.map((role) => {
                  const key = roleForumCellKey(role.id, forum.id)
                  const hasSteps = stepPresence.get(key) ?? false
                  const cell = cells.get(key) ?? null
                  return (
                    <div
                      key={key}
                      className={['border-b border-r border-border/70 bg-canvas/20 align-top', cellPad].join(' ')}
                      style={{ minHeight: summaryCellMinH }}
                    >
                      <BmsBrainRoleForumCell
                        cell={cell}
                        hasSteps={hasSteps}
                        density={density}
                        fontSize={fontSize}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
