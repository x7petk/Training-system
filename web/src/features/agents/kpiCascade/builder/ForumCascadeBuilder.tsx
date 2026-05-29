import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CascadeForumBuilderState, CascadeMetricKind } from '../cascadeTypes'
import type { CascadeKpiOverlayItem } from '../cascadeTypes'
import {
  boardRowForForumGroup,
  buildKpiOverlaysForForumBox,
  canLinkForumMetrics,
  forumBoardRow,
  forumCascadeBoardSlotCount,
  forumCascadeOverlayMetricIds,
  forumGroupsWithMetrics,
  levelsToColumns,
  normalizeBoardRow,
  pruneEmptyForumGroups,
  pruneInvalidForumLinks,
  sortedActiveLevels,
} from '../cascadeUtils'
import type { KpiCascadeWorkspace } from '../types'
import { CascadeAddBlockButton } from './CascadeAddBlockButton'
import { CascadeFilterBar } from './CascadeFilterBar'
import { CascadeGridBoard } from './CascadeGridBoard'

function newMetricId() {
  return `cfm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newLinkId() {
  return `cfl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newGroupId() {
  return `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type Props = {
  workspace: KpiCascadeWorkspace
  onUpdate: (workspace: KpiCascadeWorkspace) => void
  loadError?: string | null
}

export function ForumCascadeBuilder({ workspace, onUpdate, loadError }: Props) {
  const forumCascade = workspace.forumCascade
  const orderedLevels = useMemo(() => sortedActiveLevels(workspace.levels), [workspace.levels])
  const columns = useMemo(() => levelsToColumns(orderedLevels), [orderedLevels])
  const activeLevelIds = useMemo(() => new Set(orderedLevels.map((l) => l.id)), [orderedLevels])
  const boardMetrics = useMemo(
    () => forumCascade.metrics.filter((m) => activeLevelIds.has(m.levelId)),
    [forumCascade.metrics, activeLevelIds],
  )
  const slotCount = useMemo(
    () => forumCascadeBoardSlotCount(forumCascade.groups, boardMetrics, workspace.forums),
    [forumCascade.groups, boardMetrics, workspace.forums],
  )
  const boardRowForGroupFn = useCallback(
    (group: (typeof forumCascade.groups)[number]) =>
      boardRowForForumGroup(group, boardMetrics, workspace.forums),
    [boardMetrics, workspace.forums],
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

  const updateForumCascade = useCallback(
    (next: CascadeForumBuilderState) => {
      onUpdate({ ...workspace, forumCascade: next })
    },
    [onUpdate, workspace],
  )

  const commitCascade = useCallback(
    (partial: Partial<CascadeForumBuilderState>) => {
      const metrics = partial.metrics ?? forumCascade.metrics
      const groups = pruneEmptyForumGroups(partial.groups ?? forumCascade.groups, metrics)
      const links = pruneInvalidForumLinks(metrics, partial.links ?? forumCascade.links, orderedLevels)
      updateForumCascade({ ...forumCascade, ...partial, metrics, groups, links })
    },
    [forumCascade, orderedLevels, updateForumCascade],
  )

  const placeGroupAtRow = useCallback(
    (groupId: string, levelId: string, targetRow: number) => {
      const moving = forumCascade.groups.find((g) => g.id === groupId && g.levelId === levelId)
      if (!moving) return
      const nextRow = normalizeBoardRow(targetRow)
      const currentRow = normalizeBoardRow(moving.boardRow)
      if (currentRow === nextRow) return

      const occupants = forumCascade.groups.filter(
        (g) =>
          g.levelId === levelId &&
          g.id !== groupId &&
          normalizeBoardRow(g.boardRow) === nextRow,
      )

      const groups = forumCascade.groups.map((g) => {
        if (g.id === groupId) return { ...g, boardRow: nextRow }
        const occIdx = occupants.findIndex((o) => o.id === g.id)
        if (occIdx >= 0) return { ...g, boardRow: currentRow + occIdx }
        return g
      })
      commitCascade({ groups })
    },
    [forumCascade.groups, commitCascade],
  )

  const createBox = useCallback(
    (levelId: string, boardRow: number) => {
      const g = {
        id: newGroupId(),
        levelId,
        title: '',
        collapsed: false,
        sortOrder: forumCascade.groups.filter((x) => x.levelId === levelId).length,
        boardRow,
      }
      return g
    },
    [forumCascade.groups],
  )

  const addBlock = useCallback(
    (levelId: string, forumId: string, kind: CascadeMetricKind = 'primary') => {
      const forum = workspace.forums.find((f) => f.id === forumId)
      const boardRow = forum ? forumBoardRow(forum, levelId) : 1
      const box = createBox(levelId, boardRow)
      const metrics = [
        ...forumCascade.metrics,
        {
          id: newMetricId(),
          levelId,
          groupId: box.id,
          forumId,
          kind,
          budget: 0,
          fact: 0,
          sortOrder: 0,
        },
      ]
      commitCascade({ groups: [...forumCascade.groups, box], metrics })
    },
    [commitCascade, createBox, forumCascade.groups, forumCascade.metrics, workspace.forums],
  )

  const deleteMetric = useCallback(
    (metricId: string) => {
      const metrics = forumCascade.metrics.filter((m) => m.id !== metricId)
      const links = forumCascade.links.filter(
        (l) => l.fromMetricId !== metricId && l.toMetricId !== metricId,
      )
      commitCascade({ metrics, links })
      if (linkSourceId === metricId) clearLinkSelection()
    },
    [forumCascade, commitCascade, clearLinkSelection, linkSourceId],
  )

  const deleteLink = useCallback(
    (linkId: string) => {
      const links = forumCascade.links.filter((l) => l.id !== linkId)
      if (links.length === forumCascade.links.length) return
      updateForumCascade({ ...forumCascade, links })
    },
    [forumCascade, updateForumCascade],
  )

  const addLink = useCallback(
    (fromMetricId: string, toMetricId: string): boolean => {
      const from = forumCascade.metrics.find((m) => m.id === fromMetricId)
      const to = forumCascade.metrics.find((m) => m.id === toMetricId)
      if (!from || !to) {
        setLinkHint('Could not find one of the blocks.')
        return false
      }
      if (!canLinkForumMetrics(from, to, orderedLevels)) {
        setLinkHint('Links must go from a block in a column on the right to a block on the left.')
        return false
      }
      if (
        forumCascade.links.some(
          (l) => l.fromMetricId === fromMetricId && l.toMetricId === toMetricId,
        )
      ) {
        setLinkHint('This link already exists.')
        return false
      }
      setLinkHint(null)
      updateForumCascade({
        ...forumCascade,
        links: [...forumCascade.links, { id: newLinkId(), fromMetricId, toMetricId }],
      })
      clearLinkSelection()
      return true
    },
    [forumCascade, clearLinkSelection, orderedLevels, updateForumCascade],
  )

  const moveMetricToBox = useCallback(
    (metricId: string, toLevelId: string, toBoxId: string) => {
      const metric = forumCascade.metrics.find((m) => m.id === metricId)
      const box = forumCascade.groups.find((g) => g.id === toBoxId && g.levelId === toLevelId)
      if (!metric || !box) return
      if (metric.groupId === toBoxId && metric.levelId === toLevelId) return

      const sortOrder = forumCascade.metrics.filter(
        (m) => m.groupId === toBoxId && m.id !== metricId,
      ).length
      const metrics = forumCascade.metrics.map((m) =>
        m.id === metricId ? { ...m, levelId: toLevelId, groupId: toBoxId, sortOrder } : m,
      )
      const links = pruneInvalidForumLinks(metrics, forumCascade.links, orderedLevels)
      commitCascade({ metrics, links })
    },
    [forumCascade, commitCascade, orderedLevels],
  )

  const moveMetricToRow = useCallback(
    (metricId: string, toLevelId: string, toRow: number) => {
      const metric = forumCascade.metrics.find((m) => m.id === metricId)
      if (!metric) return
      const targetRow = normalizeBoardRow(toRow)
      const siblingsInGroup = forumCascade.metrics.filter((m) => m.groupId === metric.groupId)
      const isSoloInGroup = siblingsInGroup.length <= 1

      if (metric.levelId === toLevelId && isSoloInGroup) {
        placeGroupAtRow(metric.groupId, toLevelId, targetRow)
        return
      }

      const fromGroup = forumCascade.groups.find((g) => g.id === metric.groupId)
      const fromRow = normalizeBoardRow(fromGroup?.boardRow)
      const box = createBox(toLevelId, targetRow)
      const occupant = forumCascade.groups.find(
        (g) =>
          g.levelId === toLevelId &&
          g.id !== box.id &&
          g.id !== metric.groupId &&
          normalizeBoardRow(g.boardRow) === targetRow,
      )

      let groups = [...forumCascade.groups, box]
      if (occupant) {
        groups = groups.map((g) => (g.id === occupant.id ? { ...g, boardRow: fromRow } : g))
      }

      const metrics = forumCascade.metrics.map((m) =>
        m.id === metricId ? { ...m, levelId: toLevelId, groupId: box.id, sortOrder: 0 } : m,
      )
      const links = pruneInvalidForumLinks(metrics, forumCascade.links, orderedLevels)
      commitCascade({ groups, metrics, links })
    },
    [
      forumCascade.groups,
      forumCascade.metrics,
      forumCascade.links,
      commitCascade,
      createBox,
      orderedLevels,
      placeGroupAtRow,
    ],
  )

  const moveMetricToColumn = useCallback(
    (metricId: string, toLevelId: string) => {
      const metric = forumCascade.metrics.find((m) => m.id === metricId)
      const forum = metric ? workspace.forums.find((f) => f.id === metric.forumId) : undefined
      const boardRow = forum ? forumBoardRow(forum, toLevelId) : 1
      moveMetricToRow(metricId, toLevelId, boardRow)
    },
    [forumCascade.metrics, moveMetricToRow, workspace.forums],
  )

  const onStartLink = useCallback(
    (metricId: string) => {
      const m = forumCascade.metrics.find((x) => x.id === metricId)
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
    [addLink, forumCascade.metrics, clearLinkSelection, linkSourceId],
  )

  const completeLink = useCallback(
    (targetMetricId: string) => {
      if (!linkSourceId || linkSourceId === targetMetricId) return
      addLink(linkSourceId, targetMetricId)
    },
    [addLink, linkSourceId],
  )

  const activeForums = useMemo(() => workspace.forums.filter((f) => f.active), [workspace.forums])

  const { closure: linkedMetricClosure, focus: focusMetricIdSet } = useMemo(
    () =>
      forumCascadeOverlayMetricIds(
        workspace.cascade.metrics,
        forumCascade.filters.kpiIds,
        activeLevelIds,
        forumCascade.filters.onlyConnected,
        workspace.cascade.links,
      ),
    [
      activeLevelIds,
      forumCascade.filters.kpiIds,
      forumCascade.filters.onlyConnected,
      workspace.cascade.links,
      workspace.cascade.metrics,
    ],
  )

  const kpiOverlaysByBoxId = useMemo(() => {
    const map = new Map<string, CascadeKpiOverlayItem[]>()
    if (linkedMetricClosure.size === 0) return map

    for (const box of forumCascade.groups) {
      if (!activeLevelIds.has(box.levelId)) continue
      const forumMetrics = boardMetrics.filter((m) => m.groupId === box.id)
      const forumIds = [
        ...new Set(
          forumMetrics.map((m) => m.forumId).filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ]
      if (forumIds.length === 0) continue

      const merged: CascadeKpiOverlayItem[] = []
      const seen = new Set<string>()
      for (const forumId of forumIds) {
        for (const item of buildKpiOverlaysForForumBox(
          forumId,
          box.levelId,
          linkedMetricClosure,
          focusMetricIdSet,
          workspace.cascade.metrics,
          workspace,
        )) {
          if (seen.has(item.metricId)) continue
          seen.add(item.metricId)
          merged.push(item)
        }
      }
      if (merged.length > 0) map.set(box.id, merged)
    }
    return map
  }, [
    activeLevelIds,
    boardMetrics,
    focusMetricIdSet,
    forumCascade.groups,
    linkedMetricClosure,
    workspace,
  ])

  const setFilters = useCallback(
    (filters: typeof forumCascade.filters) => {
      updateForumCascade({ ...forumCascade, filters })
    },
    [forumCascade, updateForumCascade],
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <CascadeFilterBar
        mode="forum-cascade"
        filters={forumCascade.filters}
        levels={workspace.levels}
        kpis={workspace.kpis}
        forums={workspace.forums}
        onChange={setFilters}
      />
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
          catalogLabel="Forum"
          catalogItems={activeForums.map((f) => ({ id: f.id, name: f.name }))}
          addButtonLabel="Add forum block"
          panelTitle="Add forum to board"
          emptyCatalogHint="No forums yet. Create them in the Admin tab first."
          onAddBlock={addBlock}
        />
      </div>
      {columns.length === 0 ? (
        <p className="rounded-lg border border-[#c5cad3] bg-[#f7f8fa] px-4 py-8 text-center text-sm text-[#5c6570]">
          No active levels. Add levels in the Admin tab first.
        </p>
      ) : (
        <CascadeGridBoard
          columns={columns}
          metrics={boardMetrics}
          links={forumCascade.links}
          groups={forumCascade.groups}
          kpis={[]}
          forums={workspace.forums}
          slotCount={slotCount}
          kpiOverlaysByBoxId={kpiOverlaysByBoxId}
          boardRowForGroup={(g) => boardRowForGroupFn(g as (typeof forumCascade.groups)[number])}
          groupsWithMetricsForColumn={(groups, metrics, columnId) =>
            forumGroupsWithMetrics(
              groups as typeof forumCascade.groups,
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
      )}
    </div>
  )
}
