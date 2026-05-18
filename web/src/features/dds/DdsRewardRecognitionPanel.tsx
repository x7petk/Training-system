import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { ArrowUpRight, Building2, Clock, ListTree, Loader2, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  type DdsRrBehaviourOption,
  type DdsRrEntryRow,
  type DdsRrSurfaceKey,
  type DdsRrValueOption,
  DDS_RR_SURFACE_LABELS,
  ddsRrPromoteTarget,
  ddsRrShowPromotedCellName,
} from './ddsRewardRecognition'
import { type DdsPlantRollupMode, ddsPlantRollupVisibleSurface } from './ddsPlantRollup'
import {
  DdsRewardRecognitionEntryModal,
  entryToDraft,
  type DdsRrEntryDraft,
} from './DdsRewardRecognitionEntryModal'

type PersonLite = {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
}

function personLabel(p: PersonLite): string {
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return a || p.display_name || p.id.slice(0, 8)
}

const SURFACE_ICON: Record<DdsRrSurfaceKey, typeof Clock> = {
  'shift-dds': Clock,
  'line-dds': ListTree,
  'site-dds': Building2,
}

const ROW_H = 22

export type DdsRewardRecognitionPanelHandle = {
  openCreate: () => void
}

type Props = {
  planDate: string
  shiftKind: string
  shellLoading?: boolean
  cellId?: string
  surface?: DdsRrSurfaceKey
  cellIds?: string[]
  plantRollup?: DdsPlantRollupMode
}

export const DdsRewardRecognitionPanel = forwardRef<DdsRewardRecognitionPanelHandle, Props>(function DdsRewardRecognitionPanel(
  { cellId, cellIds, plantRollup, planDate, shiftKind, surface, shellLoading },
  ref,
) {
  const plantMode = Boolean(cellIds?.length)
  const effectiveSurface = plantMode
    ? ddsPlantRollupVisibleSurface(plantRollup ?? 'all')
    : (surface ?? 'line-dds')
  const displayContext: DdsRrSurfaceKey | 'plant-dds' = plantMode ? 'plant-dds' : effectiveSurface
  const { user } = useAuth()
  const [values, setValues] = useState<DdsRrValueOption[]>([])
  const [behaviours, setBehaviours] = useState<DdsRrBehaviourOption[]>([])
  const [people, setPeople] = useState<PersonLite[]>([])
  const [cellNames, setCellNames] = useState<Record<string, string>>({})
  const [entries, setEntries] = useState<DdsRrEntryRow[]>([])
  /** entry id → surface already promoted to (from any copy in this cell/date/shift). */
  const [promotedToTarget, setPromotedToTarget] = useState<Map<string, DdsRrSurfaceKey>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<DdsRrEntryRow | null>(null)

  const openCreate = useCallback(() => {
    setEditRow(null)
    setModalOpen(true)
  }, [])

  useImperativeHandle(ref, () => ({ openCreate }), [openCreate])

  const valueLabel = useMemo(() => new Map(values.map((v) => [v.id, v.label])), [values])
  const behaviourLabel = useMemo(() => new Map(behaviours.map((b) => [b.id, b.label])), [behaviours])
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const load = useCallback(async () => {
    const masterIds = plantMode ? cellIds! : cellId ? [cellId] : []
    if (masterIds.length === 0 || !planDate || !shiftKind) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [cfgVal, cfgBeh, peRes, cellRes] = await Promise.all([
      supabase.from('dds_rr_value_options').select('id, sort_order, label').order('sort_order'),
      supabase.from('dds_rr_behaviour_options').select('id, value_option_id, sort_order, label').order('sort_order'),
      supabase.from('people').select('id, display_name, first_name, last_name').order('display_name').limit(500),
      supabase.from('master_cells').select('id, name'),
    ])
    if (cfgVal.error || cfgBeh.error || peRes.error || cellRes.error) {
      setError(cfgVal.error?.message ?? cfgBeh.error?.message ?? peRes.error?.message ?? cellRes.error?.message ?? 'Load failed')
      setLoading(false)
      return
    }
    setValues((cfgVal.data ?? []) as DdsRrValueOption[])
    setBehaviours((cfgBeh.data ?? []) as DdsRrBehaviourOption[])
    setPeople((peRes.data ?? []) as PersonLite[])
    const cn: Record<string, string> = {}
    for (const c of cellRes.data ?? []) {
      cn[(c as { id: string; name: string }).id] = (c as { id: string; name: string }).name
    }
    setCellNames(cn)

    const { data: entRaw, error: entErr } = await supabase
      .from('dds_rr_entries')
      .select(
        'id, root_entry_id, master_cell_id, plan_date, shift_kind, visible_surface, created_on_surface, name_mode, free_text_names, reason, value_option_id, behaviour_option_id, promoted_from_entry_id, promoted_from_surface, promoted_from_cell_id, created_by, updated_by, created_at, updated_at',
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
    const entList = (entRaw ?? []) as Omit<DdsRrEntryRow, 'person_ids'>[]
    const ids = entList.map((e) => e.id)
    let personLinks: { entry_id: string; person_id: string }[] = []
    if (ids.length > 0) {
      const { data: pl, error: plErr } = await supabase
        .from('dds_rr_entry_people')
        .select('entry_id, person_id')
        .in('entry_id', ids)
      if (plErr) {
        setError(plErr.message)
        setLoading(false)
        return
      }
      personLinks = (pl ?? []) as { entry_id: string; person_id: string }[]
    }
    const byEntry = new Map<string, string[]>()
    for (const l of personLinks) {
      if (!byEntry.has(l.entry_id)) byEntry.set(l.entry_id, [])
      byEntry.get(l.entry_id)!.push(l.person_id)
    }
    setEntries(
      entList.map((e) => ({
        ...e,
        visible_surface: e.visible_surface as DdsRrSurfaceKey,
        created_on_surface: e.created_on_surface as DdsRrSurfaceKey,
        name_mode: e.name_mode as DdsRrEntryRow['name_mode'],
        promoted_from_surface: e.promoted_from_surface as DdsRrSurfaceKey | null,
        person_ids: byEntry.get(e.id) ?? [],
      })),
    )

    const { data: promoRaw } = await supabase
      .from('dds_rr_entries')
      .select('promoted_from_entry_id, visible_surface')
      .in('master_cell_id', masterIds)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
      .is('deleted_at', null)
      .not('promoted_from_entry_id', 'is', null)
    const promoMap = new Map<string, DdsRrSurfaceKey>()
    for (const p of promoRaw ?? []) {
      const fromId = (p as { promoted_from_entry_id: string }).promoted_from_entry_id
      const vis = (p as { visible_surface: string }).visible_surface as DdsRrSurfaceKey
      promoMap.set(fromId, vis)
    }
    setPromotedToTarget(promoMap)

    setLoading(false)
  }, [cellId, cellIds, plantMode, effectiveSurface, planDate, shiftKind])

  useEffect(() => {
    void load()
  }, [load])

  function displayNames(row: DdsRrEntryRow): string {
    if (row.name_mode === 'free_text') return row.free_text_names?.trim() ?? '—'
    const labels = row.person_ids.map((id) => {
      const p = peopleById.get(id)
      return p ? personLabel(p) : id.slice(0, 8)
    })
    return labels.length ? labels.join(', ') : '—'
  }

  function sourceBadge(row: DdsRrEntryRow) {
    if (!row.promoted_from_surface || !row.promoted_from_cell_id) return null
    const Icon = SURFACE_ICON[row.promoted_from_surface]
    const cell = cellNames[row.promoted_from_cell_id] ?? row.promoted_from_cell_id.slice(0, 8)
    const showCell = ddsRrShowPromotedCellName(displayContext)
    const title = showCell
      ? `From ${DDS_RR_SURFACE_LABELS[row.promoted_from_surface]} · ${cell}`
      : `From ${DDS_RR_SURFACE_LABELS[row.promoted_from_surface]}`
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

  async function persistPeople(entryId: string, draft: DdsRrEntryDraft) {
    await supabase.from('dds_rr_entry_people').delete().eq('entry_id', entryId)
    if (draft.nameMode !== 'free_text' && draft.personIds.length > 0) {
      const { error: insPe } = await supabase.from('dds_rr_entry_people').insert(
        draft.personIds.map((person_id) => ({ entry_id: entryId, person_id })),
      )
      if (insPe) throw insPe
    }
  }

  async function saveDraft(draft: DdsRrEntryDraft, existing: DdsRrEntryRow | null) {
    if (!user?.id || !cellId) return
    setSaving(true)
    setError(null)
    const payload = {
      name_mode: draft.nameMode,
      free_text_names: draft.nameMode === 'free_text' ? draft.freeTextNames : null,
      reason: draft.reason,
      value_option_id: draft.valueOptionId,
      behaviour_option_id: draft.behaviourOptionId,
      updated_by: user.id,
    }
    try {
      if (existing) {
        const { error: uErr } = await supabase.from('dds_rr_entries').update(payload).eq('id', existing.id)
        if (uErr) throw uErr
        await persistPeople(existing.id, draft)
      } else {
        const { data: ins, error: iErr } = await supabase
          .from('dds_rr_entries')
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
        await persistPeople((ins as { id: string }).id, draft)
        const newId = (ins as { id: string }).id
        await supabase.from('dds_rr_entries').update({ root_entry_id: newId }).eq('id', newId)
      }
      setModalOpen(false)
      setEditRow(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  async function promoteRow(row: DdsRrEntryRow) {
    const target = ddsRrPromoteTarget(surface ?? 'line-dds')
    if (!target || !user?.id) return
    if (promotedToTarget.get(row.id) === target) return
    setSaving(true)
    setError(null)
    const rootId = row.root_entry_id ?? row.id
    try {
      const { data: copy, error: cErr } = await supabase
        .from('dds_rr_entries')
        .insert({
          root_entry_id: rootId,
          master_cell_id: cellId,
          plan_date: planDate,
          shift_kind: shiftKind,
          visible_surface: target,
          created_on_surface: target,
          name_mode: row.name_mode,
          free_text_names: row.free_text_names,
          reason: row.reason,
          value_option_id: row.value_option_id,
          behaviour_option_id: row.behaviour_option_id,
          promoted_from_entry_id: row.id,
          promoted_from_surface: surface,
          promoted_from_cell_id: cellId,
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id')
        .single()
      if (cErr) throw cErr
      const newId = (copy as { id: string }).id
      if (row.person_ids.length > 0) {
        const { error: pErr } = await supabase.from('dds_rr_entry_people').insert(
          row.person_ids.map((person_id) => ({ entry_id: newId, person_id })),
        )
        if (pErr) throw pErr
      }
      const { error: prErr } = await supabase.from('dds_rr_promotions').insert({
        from_entry_id: row.id,
        to_entry_id: newId,
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

  async function deleteRow(row: DdsRrEntryRow) {
    const comment = window.prompt('Delete comment (required):', '')
    if (comment == null || !comment.trim()) return
    if (!user?.id) return
    setSaving(true)
    setError(null)
    const { error: dErr } = await supabase
      .from('dds_rr_entries')
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

  const promoteTarget = plantMode ? null : ddsRrPromoteTarget(surface ?? 'line-dds')

  function cellLabel(row: DdsRrEntryRow) {
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
          title={`Promote copies to ${DDS_RR_SURFACE_LABELS[promoteTarget]} (original stays here)`}
        >
          ↑ {DDS_RR_SURFACE_LABELS[promoteTarget]}
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
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/70">
          <table className="w-full table-fixed border-collapse text-left text-[10px] leading-none">
            <colgroup>
              {plantMode ? <col className="w-[4.5rem]" /> : null}
              <col className="w-[25%]" />
              <col className="w-[31%]" />
              <col className="w-[17%]" />
              <col className="w-[17%]" />
              {plantMode ? null : <col className="w-[3rem]" />}
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface-raised/50 text-[9px]">
                {plantMode ? <th className="px-1 py-0.5 font-medium text-muted">Cell</th> : null}
                <th className="px-1 py-0.5 font-medium text-muted">Names</th>
                <th className="px-1 py-0.5 font-medium text-muted">Reason</th>
                <th className="px-1 py-0.5 font-medium text-muted">Value</th>
                <th className="px-1 py-0.5 font-medium text-muted">Beh.</th>
                {plantMode ? null : <th className="w-[3rem] px-0.5 py-0.5" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => {
                const canPromote = !plantMode && promoteTarget != null && promotedToTarget.get(row.id) !== promoteTarget
                const names = displayNames(row)
                const reason = row.reason
                const val = valueLabel.get(row.value_option_id) ?? '—'
                const beh = behaviourLabel.get(row.behaviour_option_id) ?? '—'
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 odd:bg-surface/30"
                    style={{ height: ROW_H }}
                  >
                    {plantMode ? (
                      <td className="px-1 py-0 align-middle text-muted" title={cellLabel(row)}>
                        <span className="block truncate font-medium">{cellLabel(row)}</span>
                      </td>
                    ) : null}
                    <td className="px-1 py-0 align-middle">
                      <div className="flex min-w-0 items-center gap-0.5" title={names}>
                        {sourceBadge(row)}
                        <span className="min-w-0 truncate font-medium text-fg">{names}</span>
                      </div>
                    </td>
                    <td className="px-1 py-0 align-middle text-fg" title={reason}>
                      <span className="block truncate">{reason}</span>
                    </td>
                    <td className="px-1 py-0 align-middle text-muted" title={val}>
                      <span className="block truncate">{val}</span>
                    </td>
                    <td className="px-1 py-0 align-middle text-muted" title={beh}>
                      <span className="block truncate">{beh}</span>
                    </td>
                    {plantMode ? null : (
                      <td className="px-0.5 py-0 align-middle">
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
                              title={`Promote to ${DDS_RR_SURFACE_LABELS[promoteTarget!]}`}
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
        <DdsRewardRecognitionEntryModal
          open={modalOpen}
          title={editRow ? 'Edit entry' : 'New entry'}
          values={values}
          behaviours={behaviours}
          people={people}
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
