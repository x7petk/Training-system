import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CascadeBuilderState, CascadeMetricKind } from '../cascadeTypes'
import {
  boardRowForGroup,
  canLinkMetrics,
  cascadeBoardSlotCount,
  groupsWithMetrics,
  kpiBoardRow,
  levelsToColumns,
  normalizeBoardRow,
  pruneEmptyGroups,
  pruneInvalidLinks,
  sortedActiveLevels,
} from '../cascadeUtils'
import type { KpiCascadeWorkspace } from '../types'
import { CascadeAddBlockButton } from './CascadeAddBlockButton'
import { CascadeGridBoard } from './CascadeGridBoard'

function newMetricId() {
  return `cm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newLinkId() {
  return `cl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newGroupId() {
  return `cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type Props = {
  workspace: KpiCascadeWorkspace
  onUpdate: (workspace: KpiCascadeWorkspace) => void
  loadError?: string | null
}

export function KpiCascadeBuilder({ workspace, onUpdate, loadError }: Props) {
  const cascade = workspace.cascade
  const orderedLevels = useMemo(() => sortedActiveLevels(workspace.levels), [workspace.levels])
  const columns = useMemo(() => levelsToColumns(orderedLevels), [orderedLevels])
  const activeLevelIds = useMemo(() => new Set(orderedLevels.map((l) => l.id)), [orderedLevels])
  const boardMetrics = useMemo(
    () => cascade.metrics.filter((m) => activeLevelIds.has(m.levelId)),
    [cascade.metrics, activeLevelIds],
  )
  const slotCount = useMemo(
    () => cascadeBoardSlotCount(cascade.groups, boardMetrics, workspace.kpis),
    [cascade.groups, boardMetrics, workspace.kpis],
  )
  const boardRowForGroupFn = useCallback(
    (group: (typeof cascade.groups)[number]) => boardRowForGroup(group, boardMetrics, workspace.kpis),
    [boardMetrics, workspace.kpis],
  )

  const [linkSourceId, setLinkSourceId] = useState<string | null>(null)
  const [linkHint, setLinkHint] = useState<string | null>(null)

  const clearLinkSelection = useCallback(() => {
    setLinkSourceId(null)
    setLinkHint(null)
  }, [])

  useEffect(() => {
    if (!linkSourceId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearLinkSelection()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [linkSourceId, clearLinkSelection])

  const updateCascade = useCallback(
    (next: CascadeBuilderState) => {
      onUpdate({ ...workspace, cascade: next })
    },
    [onUpdate, workspace],
  )

  const commitCascade = useCallback(
    (partial: Partial<CascadeBuilderState>) => {
      const metrics = partial.metrics ?? cascade.metrics
      const groups = pruneEmptyGroups(partial.groups ?? cascade.groups, metrics)
      const links = pruneInvalidLinks(metrics, partial.links ?? cascade.links, orderedLevels)
      updateCascade({ ...cascade, ...partial, metrics, groups, links })
    },
    [cascade, orderedLevels, updateCascade],
  )

  const placeGroupAtRow = useCallback(
    (groupId: string, levelId: string, targetRow: number) => {
      const moving = cascade.groups.find((g) => g.id === groupId && g.levelId === levelId)
      if (!moving) return
      const nextRow = normalizeBoardRow(targetRow)
      const currentRow = normalizeBoardRow(moving.boardRow)
      if (currentRow === nextRow) return

      const occupants = cascade.groups.filter(
        (g) =>
          g.levelId === levelId &&
          g.id !== groupId &&
          normalizeBoardRow(g.boardRow) === nextRow,
      )

      const groups = cascade.groups.map((g) => {
        if (g.id === groupId) return { ...g, boardRow: nextRow }
        const occIdx = occupants.findIndex((o) => o.id === g.id)
        if (occIdx >= 0) return { ...g, boardRow: currentRow + occIdx }
        return g
      })
      commitCascade({ groups })
    },
    [cascade.groups, commitCascade],
  )

  const createBox = useCallback(
    (levelId: string, boardRow: number) => {
      const g = {
        id: newGroupId(),
        levelId,
        title: '',
        collapsed: false,
        sortOrder: cascade.groups.filter((x) => x.levelId === levelId).length,
        boardRow,
      }
      return g
    },
    [cascade.groups],
  )

  const addBlock = useCallback(
    (levelId: string, kpiId: string, kind: CascadeMetricKind = 'primary') => {
      const kpi = workspace.kpis.find((k) => k.id === kpiId)
      const boardRow = kpi ? kpiBoardRow(kpi, levelId) : 1
      const box = createBox(levelId, boardRow)
      const sortOrder = 0
      const metrics = [
        ...cascade.metrics,
        {
          id: newMetricId(),
          levelId,
          groupId: box.id,
          kpiId,
          kind,
          budget: 0,
          fact: 0,
          sortOrder,
        },
      ]
      commitCascade({ groups: [...cascade.groups, box], metrics })
    },
    [cascade.groups, cascade.metrics, commitCascade, createBox, workspace.kpis],
  )

  const deleteMetric = useCallback(
    (metricId: string) => {
      const metrics = cascade.metrics.filter((m) => m.id !== metricId)
      const links = cascade.links.filter((l) => l.fromMetricId !== metricId && l.toMetricId !== metricId)
      commitCascade({ metrics, links })
      if (linkSourceId === metricId) clearLinkSelection()
    },
    [cascade, commitCascade, clearLinkSelection, linkSourceId],
  )

  const deleteLink = useCallback(
    (linkId: string) => {
      const links = cascade.links.filter((l) => l.id !== linkId)
      if (links.length === cascade.links.length) return
      updateCascade({ ...cascade, links })
    },
    [cascade, updateCascade],
  )

  const addLink = useCallback(
    (fromMetricId: string, toMetricId: string): boolean => {
      const from = cascade.metrics.find((m) => m.id === fromMetricId)
      const to = cascade.metrics.find((m) => m.id === toMetricId)
      if (!from || !to) {
        setLinkHint('Could not find one of the blocks.')
        return false
      }
      if (!canLinkMetrics(from, to, orderedLevels)) {
        setLinkHint('Links must go from a block in a column on the right to a block on the left.')
        return false
      }
      if (cascade.links.some((l) => l.fromMetricId === fromMetricId && l.toMetricId === toMetricId)) {
        setLinkHint('This link already exists.')
        return false
      }
      setLinkHint(null)
      updateCascade({
        ...cascade,
        links: [...cascade.links, { id: newLinkId(), fromMetricId, toMetricId }],
      })
      clearLinkSelection()
      return true
    },
    [cascade, clearLinkSelection, orderedLevels, updateCascade],
  )

  const moveMetricToBox = useCallback(
    (metricId: string, toLevelId: string, toBoxId: string) => {
      const metric = cascade.metrics.find((m) => m.id === metricId)
      const box = cascade.groups.find((g) => g.id === toBoxId && g.levelId === toLevelId)
      if (!metric || !box) return
      if (metric.groupId === toBoxId && metric.levelId === toLevelId) return

      const sortOrder = cascade.metrics.filter((m) => m.groupId === toBoxId && m.id !== metricId).length
      const metrics = cascade.metrics.map((m) =>
        m.id === metricId ? { ...m, levelId: toLevelId, groupId: toBoxId, sortOrder } : m,
      )
      const links = pruneInvalidLinks(metrics, cascade.links, orderedLevels)
      commitCascade({ metrics, links })
    },
    [cascade, commitCascade, orderedLevels],
  )

  const moveMetricToRow = useCallback(
    (metricId: string, toLevelId: string, toRow: number) => {
      const metric = cascade.metrics.find((m) => m.id === metricId)
      if (!metric) return
      const targetRow = normalizeBoardRow(toRow)
      const siblingsInGroup = cascade.metrics.filter((m) => m.groupId === metric.groupId)
      const isSoloInGroup = siblingsInGroup.length <= 1

      if (metric.levelId === toLevelId && isSoloInGroup) {
        placeGroupAtRow(metric.groupId, toLevelId, targetRow)
        return
      }

      const fromGroup = cascade.groups.find((g) => g.id === metric.groupId)
      const fromRow = normalizeBoardRow(fromGroup?.boardRow)
      const box = createBox(toLevelId, targetRow)
      const occupant = cascade.groups.find(
        (g) =>
          g.levelId === toLevelId &&
          g.id !== box.id &&
          g.id !== metric.groupId &&
          normalizeBoardRow(g.boardRow) === targetRow,
      )

      let groups = [...cascade.groups, box]
      if (occupant) {
        groups = groups.map((g) => (g.id === occupant.id ? { ...g, boardRow: fromRow } : g))
      }

      const sortOrder = 0
      const metrics = cascade.metrics.map((m) =>
        m.id === metricId ? { ...m, levelId: toLevelId, groupId: box.id, sortOrder } : m,
      )
      const links = pruneInvalidLinks(metrics, cascade.links, orderedLevels)
      commitCascade({ groups, metrics, links })
    },
    [cascade.groups, cascade.metrics, cascade.links, commitCascade, createBox, orderedLevels, placeGroupAtRow],
  )

  const moveMetricToColumn = useCallback(
    (metricId: string, toLevelId: string) => {
      const metric = cascade.metrics.find((m) => m.id === metricId)
      const kpi = metric ? workspace.kpis.find((k) => k.id === metric.kpiId) : undefined
      const boardRow = kpi ? kpiBoardRow(kpi, toLevelId) : 1
      moveMetricToRow(metricId, toLevelId, boardRow)
    },
    [moveMetricToRow, workspace.kpis, cascade.metrics],
  )

  const onStartLink = useCallback(
    (metricId: string) => {
      const m = cascade.metrics.find((x) => x.id === metricId)
      if (!m || m.kind !== 'primary') return

      if (linkSourceId === metricId) {
        clearLinkSelection()
        return
      }

      if (linkSourceId) {
        addLink(linkSourceId, metricId)
        return
      }

      setLinkHint(null)
      setLinkSourceId(metricId)
    },
    [addLink, cascade.metrics, clearLinkSelection, linkSourceId],
  )

  const completeLink = useCallback(
    (targetMetricId: string) => {
      if (!linkSourceId || linkSourceId === targetMetricId) return
      addLink(linkSourceId, targetMetricId)
    },
    [addLink, linkSourceId],
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-lg border border-[#c5cad3] bg-[#f7f8fa] px-3 py-2 shadow-sm">
        {loadError ? (
          <p className="mr-auto text-xs text-danger" role="alert">
            {loadError}
          </p>
        ) : null}
        {linkSourceId ? (
          <>
            <p className="mr-auto text-xs text-[#5c6570]">
              Linking… click a block on the left, or press Esc to cancel
            </p>
            <button
              type="button"
              onClick={clearLinkSelection}
              className="inline-flex h-8 items-center rounded-md border border-[#c5cad3] bg-white px-3 text-xs font-medium text-[#333] hover:bg-[#eef1f5]"
            >
              Cancel link
            </button>
          </>
        ) : linkHint ? (
          <p className="mr-auto text-xs text-amber-800" role="status">
            {linkHint}
          </p>
        ) : (
          <p className="mr-auto text-xs text-[#8a939e]">Click an arrow to remove it</p>
        )}
        <CascadeAddBlockButton
          columns={columns}
          catalogItems={workspace.kpis
            .filter((k) => k.active)
            .map((k) => ({ id: k.id, name: k.name, suffix: k.measure }))}
          onAddBlock={addBlock}
        />
      </div>
      <CascadeGridBoard
        columns={columns}
        metrics={boardMetrics}
        links={cascade.links}
        groups={cascade.groups}
        kpis={workspace.kpis}
        forums={[]}
        slotCount={slotCount}
        boardRowForGroup={(g) => boardRowForGroupFn(g as (typeof cascade.groups)[number])}
        groupsWithMetricsForColumn={(groups, metrics, columnId) =>
          groupsWithMetrics(
            groups as typeof cascade.groups,
            metrics as typeof boardMetrics,
            columnId,
          )
        }
        linkSourceId={linkSourceId}
        onStartLink={onStartLink}
        onCompleteLink={completeLink}
        onCancelLinking={clearLinkSelection}
        onDeleteLink={deleteLink}
        onDeleteMetric={deleteMetric}
        onMoveMetricToColumn={moveMetricToColumn}
        onMoveMetricToRow={moveMetricToRow}
        onMoveMetricToBox={moveMetricToBox}
      />
    </div>
  )
}
