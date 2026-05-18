import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { ArrowUpRight, Building2, ListTree, Loader2, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  type DdsTlConfigOption,
  type DdsTlEntryRow,
  type DdsTlSurfaceKey,
  DDS_TL_SURFACE_LABELS,
  ddsTlPromoteTarget,
  ddsTlShowPromotedCellName,
} from './ddsTopLosses'
import { type DdsPlantRollupMode, ddsPlantRollupVisibleSurface } from './ddsPlantRollup'
import {
  DdsTopLossesEntryModal,
  entryToDraft,
  type DdsTlEntryDraft,
} from './DdsTopLossesEntryModal'

const SURFACE_ICON: Record<DdsTlSurfaceKey, typeof ListTree> = {
  'line-dds': ListTree,
  'site-dds': Building2,
}

const ROW_H = 22

export type DdsTopLossesPanelHandle = {
  openCreate: () => void
}

type Props = {
  planDate: string
  shiftKind: string
  shellLoading?: boolean
  /** Single cell (Line / Site DDS). */
  cellId?: string
  surface?: DdsTlSurfaceKey
  /** Plant roll-up across cells. */
  cellIds?: string[]
  plantRollup?: DdsPlantRollupMode
}

export const DdsTopLossesPanel = forwardRef<DdsTopLossesPanelHandle, Props>(function DdsTopLossesPanel(
  { cellId, cellIds, plantRollup, planDate, shiftKind, surface, shellLoading },
  ref,
) {
  const plantMode = Boolean(cellIds?.length)
  const effectiveSurface = plantMode
    ? ddsPlantRollupVisibleSurface(plantRollup ?? 'all')
    : (surface ?? 'line-dds')
  const displayContext: DdsTlSurfaceKey | 'plant-dds' = plantMode ? 'plant-dds' : effectiveSurface
  const { user } = useAuth()
  const [types, setTypes] = useState<DdsTlConfigOption[]>([])
  const [rootCauses, setRootCauses] = useState<DdsTlConfigOption[]>([])
  const [problemSolves, setProblemSolves] = useState<DdsTlConfigOption[]>([])
  const [cellNames, setCellNames] = useState<Record<string, string>>({})
  const [entries, setEntries] = useState<DdsTlEntryRow[]>([])
  const [promotedToTarget, setPromotedToTarget] = useState<Map<string, DdsTlSurfaceKey>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<DdsTlEntryRow | null>(null)

  const openCreate = useCallback(() => {
    setEditRow(null)
    setModalOpen(true)
  }, [])

  useImperativeHandle(ref, () => ({ openCreate }), [openCreate])

  const typeLabel = useMemo(() => new Map(types.map((t) => [t.id, t.label])), [types])
  const rootLabel = useMemo(() => new Map(rootCauses.map((t) => [t.id, t.label])), [rootCauses])
  const psLabel = useMemo(() => new Map(problemSolves.map((t) => [t.id, t.label])), [problemSolves])

  const load = useCallback(async () => {
    const masterIds = plantMode ? cellIds! : cellId ? [cellId] : []
    if (masterIds.length === 0 || !planDate || !shiftKind) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [typeRes, rootRes, psRes, cellRes] = await Promise.all([
      supabase.from('dds_tl_type_options').select('id, sort_order, label').order('sort_order'),
      supabase.from('dds_tl_root_cause_options').select('id, sort_order, label').order('sort_order'),
      supabase.from('dds_tl_problem_solve_options').select('id, sort_order, label').order('sort_order'),
      supabase.from('master_cells').select('id, name'),
    ])
    if (typeRes.error || rootRes.error || psRes.error || cellRes.error) {
      setError(typeRes.error?.message ?? rootRes.error?.message ?? psRes.error?.message ?? cellRes.error?.message ?? 'Load failed')
      setLoading(false)
      return
    }
    setTypes((typeRes.data ?? []) as DdsTlConfigOption[])
    setRootCauses((rootRes.data ?? []) as DdsTlConfigOption[])
    setProblemSolves((psRes.data ?? []) as DdsTlConfigOption[])
    const cn: Record<string, string> = {}
    for (const c of cellRes.data ?? []) {
      cn[(c as { id: string; name: string }).id] = (c as { id: string; name: string }).name
    }
    setCellNames(cn)

    const { data: entRaw, error: entErr } = await supabase
      .from('dds_tl_entries')
      .select(
        'id, root_entry_id, master_cell_id, plan_date, shift_kind, visible_surface, created_on_surface, top_loss, amount, type_option_id, immediate_cause, immediate_action, root_cause_option_id, problem_solve_option_id, promoted_from_entry_id, promoted_from_surface, promoted_from_cell_id, created_by, updated_by, created_at, updated_at',
      )
      .in('master_cell_id', masterIds)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
      .eq('visible_surface', effectiveSurface)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (entErr) {
      setError(entErr.message)
      setLoading(false)
      return
    }
    setEntries(
      (entRaw ?? []).map((e) => ({
        ...(e as Omit<DdsTlEntryRow, 'visible_surface' | 'created_on_surface' | 'promoted_from_surface'>),
        visible_surface: (e as { visible_surface: string }).visible_surface as DdsTlSurfaceKey,
        created_on_surface: (e as { created_on_surface: string }).created_on_surface as DdsTlSurfaceKey,
        promoted_from_surface: (e as { promoted_from_surface: string | null }).promoted_from_surface as DdsTlSurfaceKey | null,
      })),
    )

    const { data: promoRaw } = await supabase
      .from('dds_tl_entries')
      .select('promoted_from_entry_id, visible_surface')
      .in('master_cell_id', masterIds)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
      .is('deleted_at', null)
      .not('promoted_from_entry_id', 'is', null)
    const promoMap = new Map<string, DdsTlSurfaceKey>()
    for (const p of promoRaw ?? []) {
      promoMap.set(
        (p as { promoted_from_entry_id: string }).promoted_from_entry_id,
        (p as { visible_surface: string }).visible_surface as DdsTlSurfaceKey,
      )
    }
    setPromotedToTarget(promoMap)
    setLoading(false)
  }, [cellId, cellIds, plantMode, effectiveSurface, planDate, shiftKind])

  useEffect(() => {
    void load()
  }, [load])

  function sourceBadge(row: DdsTlEntryRow) {
    if (!row.promoted_from_surface || !row.promoted_from_cell_id) return null
    const Icon = SURFACE_ICON[row.promoted_from_surface]
    const cell = cellNames[row.promoted_from_cell_id] ?? row.promoted_from_cell_id.slice(0, 8)
    const showCell = ddsTlShowPromotedCellName(displayContext)
    const title = showCell
      ? `From ${DDS_TL_SURFACE_LABELS[row.promoted_from_surface]} · ${cell}`
      : `From ${DDS_TL_SURFACE_LABELS[row.promoted_from_surface]}`
    return (
      <span
        className="inline-flex shrink-0 items-center rounded border border-emerald-600/40 bg-emerald-500/10 p-px text-emerald-900 dark:text-emerald-100"
        title={title}
      >
        <Icon className="size-2.5 shrink-0" aria-hidden />
        {showCell ? (
          <span className="max-w-[3.5rem] truncate px-0.5 text-[8px] font-medium leading-none">{cell}</span>
        ) : null}
      </span>
    )
  }

  async function saveDraft(draft: DdsTlEntryDraft, existing: DdsTlEntryRow | null) {
    if (!user?.id || !cellId) return
    setSaving(true)
    setError(null)
    const payload = {
      top_loss: draft.topLoss,
      amount: draft.amount,
      type_option_id: draft.typeOptionId,
      immediate_cause: draft.immediateCause,
      immediate_action: draft.immediateAction,
      root_cause_option_id: draft.rootCauseOptionId,
      problem_solve_option_id: draft.problemSolveOptionId,
      updated_by: user.id,
    }
    try {
      if (existing) {
        const { error: uErr } = await supabase.from('dds_tl_entries').update(payload).eq('id', existing.id)
        if (uErr) throw uErr
      } else {
        const { data: ins, error: iErr } = await supabase
          .from('dds_tl_entries')
          .insert({
            ...payload,
            master_cell_id: cellId,
            plan_date: planDate,
            shift_kind: shiftKind,
            visible_surface: surface,
            created_on_surface: surface,
            created_by: user.id,
          })
          .select('id')
          .single()
        if (iErr) throw iErr
        const newId = (ins as { id: string }).id
        await supabase.from('dds_tl_entries').update({ root_entry_id: newId }).eq('id', newId)
      }
      setModalOpen(false)
      setEditRow(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  async function promoteRow(row: DdsTlEntryRow) {
    const target = ddsTlPromoteTarget(surface ?? 'line-dds')
    if (!target || !user?.id) return
    if (promotedToTarget.get(row.id) === target) return
    setSaving(true)
    setError(null)
    const rootId = row.root_entry_id ?? row.id
    try {
      const { data: copy, error: cErr } = await supabase
        .from('dds_tl_entries')
        .insert({
          root_entry_id: rootId,
          master_cell_id: cellId,
          plan_date: planDate,
          shift_kind: shiftKind,
          visible_surface: target,
          created_on_surface: target,
          top_loss: row.top_loss,
          amount: row.amount,
          type_option_id: row.type_option_id,
          immediate_cause: row.immediate_cause,
          immediate_action: row.immediate_action,
          root_cause_option_id: row.root_cause_option_id,
          problem_solve_option_id: row.problem_solve_option_id,
          promoted_from_entry_id: row.id,
          promoted_from_surface: surface,
          promoted_from_cell_id: cellId,
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id')
        .single()
      if (cErr) throw cErr
      const { error: prErr } = await supabase.from('dds_tl_promotions').insert({
        from_entry_id: row.id,
        to_entry_id: (copy as { id: string }).id,
        from_surface: surface,
        to_surface: target,
        promoted_by: user.id,
      })
      if (prErr) throw prErr
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promote failed')
    }
    setSaving(false)
  }

  async function deleteRow(row: DdsTlEntryRow) {
    const comment = window.prompt('Delete comment (required):', '')
    if (comment == null || !comment.trim()) return
    if (!user?.id) return
    setSaving(true)
    setError(null)
    const { error: dErr } = await supabase
      .from('dds_tl_entries')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        delete_comment: comment.trim(),
      })
      .eq('id', row.id)
    setSaving(false)
    if (dErr) setError(dErr.message)
    else await load()
  }

  const promoteTarget = plantMode ? null : ddsTlPromoteTarget(surface ?? 'line-dds')

  function cellLabel(row: DdsTlEntryRow) {
    return cellNames[row.master_cell_id] ?? row.master_cell_id.slice(0, 8)
  }

  if (shellLoading) {
    return (
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
      </p>
    )
  }

  if (!shiftKind) {
    return <p className="mt-2 text-[11px] text-muted">Select a shift.</p>
  }

  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col">
      {promoteTarget ? (
        <p
          className="mb-0.5 truncate text-[8px] text-muted"
          title={`Promote copies to ${DDS_TL_SURFACE_LABELS[promoteTarget]} (original stays here)`}
        >
          ↑ {DDS_TL_SURFACE_LABELS[promoteTarget]}
        </p>
      ) : null}

      {error ? <p className="mb-0.5 text-[9px] text-rose-700 dark:text-rose-300">{error}</p> : null}

      {loading ? (
        <p className="flex items-center gap-1 text-[11px] text-muted" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
        </p>
      ) : entries.length === 0 ? (
        <p className="py-2 text-center text-[10px] text-muted">
          {plantMode ? 'No entries for this scope.' : 'No entries yet.'}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-md border border-border/70">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-[10px] leading-none">
            <colgroup>
              {plantMode ? <col className="w-[4.5rem]" /> : null}
              <col className="w-[17%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[3.25rem]" />
              <col className="w-[3.25rem]" />
              {plantMode ? null : <col className="w-[3rem]" />}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface-raised/50 text-[9px]">
                {plantMode ? <th className="px-1 py-0.5 font-medium text-muted">Cell</th> : null}
                <th className="px-1 py-0.5 font-medium text-muted">Top loss</th>
                <th className="px-1 py-0.5 font-medium text-muted">Amount</th>
                <th className="px-1 py-0.5 font-medium text-muted">Type</th>
                <th className="px-1 py-0.5 font-medium text-muted">Imm. cause</th>
                <th className="px-1 py-0.5 font-medium text-muted">Imm. action</th>
                <th className="px-1 py-0.5 font-medium text-muted">Root</th>
                <th className="px-1 py-0.5 font-medium text-muted">P.Solve</th>
                {plantMode ? null : <th className="w-[3rem] px-0.5 py-0.5" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => {
                const canPromote = !plantMode && promoteTarget != null && promotedToTarget.get(row.id) !== promoteTarget
                const typ = typeLabel.get(row.type_option_id) ?? '—'
                const root = rootLabel.get(row.root_cause_option_id) ?? '—'
                const ps = psLabel.get(row.problem_solve_option_id) ?? '—'
                return (
                  <tr key={row.id} className="border-b border-border/40 odd:bg-surface/30" style={{ height: ROW_H }}>
                    {plantMode ? (
                      <td className="px-1 py-0 align-middle text-muted" title={cellLabel(row)}>
                        <span className="block truncate font-medium">{cellLabel(row)}</span>
                      </td>
                    ) : null}
                    <td className="px-1 py-0 align-middle">
                      <div className="flex min-w-0 items-center gap-0.5" title={row.top_loss}>
                        {sourceBadge(row)}
                        <span className="min-w-0 truncate font-medium text-fg">{row.top_loss}</span>
                      </div>
                    </td>
                    <td className="px-1 py-0 align-middle text-fg" title={row.amount}>
                      <span className="block truncate">{row.amount || '—'}</span>
                    </td>
                    <td className="px-1 py-0 align-middle text-muted" title={typ}>
                      <span className="block truncate">{typ}</span>
                    </td>
                    <td className="px-1 py-0 align-middle text-fg" title={row.immediate_cause}>
                      <span className="block truncate">{row.immediate_cause || '—'}</span>
                    </td>
                    <td className="px-1 py-0 align-middle text-fg" title={row.immediate_action}>
                      <span className="block truncate">{row.immediate_action || '—'}</span>
                    </td>
                    <td className="px-0.5 py-0 align-middle text-center text-muted" title={root}>
                      <span className="block truncate">{root}</span>
                    </td>
                    <td className="px-0.5 py-0 align-middle text-center text-muted" title={ps}>
                      <span className="block truncate">{ps}</span>
                    </td>
                    {plantMode ? null : (
                      <td className="px-1 py-0 align-middle">
                        <div className="flex items-center justify-end gap-px">
                          <button
                            type="button"
                            title="Edit"
                            disabled={saving || !user}
                            className="rounded p-px text-muted hover:bg-black/[0.06] hover:text-fg"
                            onClick={() => {
                              setEditRow(row)
                              setModalOpen(true)
                            }}
                          >
                            <Pencil className="size-3" aria-hidden />
                          </button>
                          {canPromote ? (
                            <button
                              type="button"
                              title={`Promote to ${DDS_TL_SURFACE_LABELS[promoteTarget!]}`}
                              disabled={saving || !user}
                              className="rounded p-px text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                              onClick={() => void promoteRow(row)}
                            >
                              <ArrowUpRight className="size-3" aria-hidden />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title="Delete"
                            disabled={saving || !user}
                            className="rounded p-px text-muted hover:bg-rose-500/10 hover:text-rose-700"
                            onClick={() => void deleteRow(row)}
                          >
                            <Trash2 className="size-3" aria-hidden />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!plantMode ? (
        <DdsTopLossesEntryModal
          open={modalOpen}
          title={editRow ? 'Edit top loss' : 'New top loss'}
          types={types}
          rootCauses={rootCauses}
          problemSolves={problemSolves}
          initial={editRow ? entryToDraft(editRow) : null}
          saving={saving}
          onClose={() => {
            if (saving) return
            setModalOpen(false)
            setEditRow(null)
          }}
          onSave={(draft) => void saveDraft(draft, editRow)}
        />
      ) : null}
    </div>
  )
})
