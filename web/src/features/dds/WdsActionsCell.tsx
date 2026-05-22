import { useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { localYMD } from '../../lib/dueDateUtils'
import {
  WDS_ACTION_KIND_LABELS,
  WDS_ACTION_KINDS,
  WDS_ACTION_STATUS_LABELS,
  WDS_ACTION_STATUSES,
  wdsActionCounts,
  wdsActionIsOverdue,
  wdsActionKindClass,
  wdsActionStatusClass,
  wdsFilterActions,
  type WdsActionKind,
  type WdsActionRow,
  type WdsActionStatus,
} from './wdsActions'
import { ddsBtn, ddsBtnGhost } from './ddsAdminCompactClasses'

type HcTypeOption = { id: string; name: string }

type Draft = {
  kind: WdsActionKind
  title: string
  owner_name: string
  target_date: string
  status: WdsActionStatus
  hc_type_id: string
}

const fieldLabel = 'text-[10px] font-semibold uppercase tracking-wide text-muted'
const fieldInput =
  'mt-0.5 h-8 w-full rounded-lg border border-border/80 bg-surface px-2.5 text-xs text-fg outline-none ring-accent/25 transition-shadow focus:border-accent/45 focus:ring-2'
const fieldSelect = `${fieldInput} appearance-none`
const tableInput =
  'h-8 w-full min-w-0 rounded-md border border-border/80 bg-surface px-2 text-xs text-fg outline-none focus:border-accent/45 focus:ring-1 focus:ring-accent/25'
const tableSelect = `${tableInput} appearance-none font-semibold`

function emptyDraft(todayYmd: string): Draft {
  return {
    kind: 'system',
    title: '',
    owner_name: '',
    target_date: todayYmd,
    status: 'not_started',
    hc_type_id: '',
  }
}

type Props = {
  columnId: string
  columnHeader: string
  cellId: string
  actions: WdsActionRow[]
  hcTypes: HcTypeOption[]
  onReload: () => void
}

export function WdsActionsCell({ columnId, columnHeader, cellId, actions, hcTypes, onReload }: Props) {
  const todayYmd = localYMD(new Date())
  const defaultFilter = { showCompleted: false, showNotRequired: false }
  const activeActions = useMemo(() => wdsFilterActions(actions, defaultFilter), [actions])
  const { total, overdue } = useMemo(() => wdsActionCounts(activeActions, todayYmd), [activeActions, todayYmd])
  const hcNameById = useMemo(() => new Map(hcTypes.map((t) => [t.id, t.name])), [hcTypes])

  const [zoomOpen, setZoomOpen] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showNotRequired, setShowNotRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(todayYmd))

  const listFilter = useMemo(() => ({ showCompleted, showNotRequired }), [showCompleted, showNotRequired])

  const visibleActions = useMemo(
    () =>
      wdsFilterActions(actions, listFilter).sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.sort_order - b.sort_order || a.title.localeCompare(b.title),
      ),
    [actions, listFilter],
  )

  const hiddenCount = actions.length - visibleActions.length

  function handleCloseModal() {
    setZoomOpen(false)
    setShowCreate(false)
    setShowCompleted(false)
    setShowNotRequired(false)
    setError(null)
  }

  async function savePatch(id: string, patch: Partial<WdsActionRow>) {
    setSaving(true)
    setError(null)
    const { error: upErr } = await supabase.from('dds_wds_actions').update(patch).eq('id', id).eq('master_cell_id', cellId)
    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    onReload()
  }

  async function createAction() {
    if (!draft.title.trim()) {
      setError('Title is required.')
      return
    }
    if (!draft.owner_name.trim()) {
      setError('Owner is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: insErr } = await supabase.from('dds_wds_actions').insert({
      dds_wds_column_id: columnId,
      master_cell_id: cellId,
      kind: draft.kind,
      title: draft.title.trim(),
      owner_name: draft.owner_name.trim(),
      target_date: draft.target_date,
      status: draft.status,
      hc_type_id: draft.hc_type_id || null,
      sort_order: actions.length,
    })
    setSaving(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setDraft(emptyDraft(todayYmd))
    setShowCreate(false)
    onReload()
  }

  async function removeAction(id: string) {
    setSaving(true)
    setError(null)
    const { error: delErr } = await supabase.from('dds_wds_actions').delete().eq('id', id).eq('master_cell_id', cellId)
    setSaving(false)
    if (delErr) {
      setError(delErr.message)
      return
    }
    onReload()
  }

  function renderActionRow(a: WdsActionRow) {
    const isOverdue = wdsActionIsOverdue(a, todayYmd)

    return (
      <tr
        key={a.id}
        className={`group border-b border-border/60 last:border-b-0 ${isOverdue ? 'bg-rose-500/[0.06]' : 'hover:bg-surface-raised/40'}`}
      >
        <td className="px-2 py-1.5 align-middle">
          <span
            className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${wdsActionKindClass(a.kind)}`}
          >
            {WDS_ACTION_KIND_LABELS[a.kind]}
          </span>
        </td>
        <td className="min-w-[10rem] px-2 py-1.5 align-middle">
          <input
            className={tableInput}
            defaultValue={a.title}
            placeholder="Title"
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== a.title) void savePatch(a.id, { title: v })
            }}
          />
        </td>
        <td className="w-[7rem] px-2 py-1.5 align-middle">
          <input
            className={tableInput}
            defaultValue={a.owner_name}
            placeholder="Owner"
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v !== a.owner_name) void savePatch(a.id, { owner_name: v })
            }}
          />
        </td>
        <td className="w-[8.5rem] px-2 py-1.5 align-middle">
          <input
            type="date"
            className={`${tableInput} tabular-nums ${isOverdue ? 'border-rose-500/50 bg-rose-500/5' : ''}`}
            defaultValue={a.target_date}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== a.target_date) {
                void savePatch(a.id, { target_date: e.target.value })
              }
            }}
          />
        </td>
        <td className="w-[8.5rem] px-2 py-1.5 align-middle">
          <select
            className={`${tableSelect} ${wdsActionStatusClass(a.status)}`}
            value={a.status}
            disabled={saving}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => void savePatch(a.id, { status: e.target.value as WdsActionStatus })}
          >
            {WDS_ACTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {WDS_ACTION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </td>
        <td className="min-w-[8rem] px-2 py-1.5 align-middle">
          <select
            className={tableSelect}
            value={a.hc_type_id ?? ''}
            disabled={saving}
            title={a.hc_type_id ? hcNameById.get(a.hc_type_id) ?? '' : undefined}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => void savePatch(a.id, { hc_type_id: e.target.value || null })}
          >
            <option value="">Not linked</option>
            {hcTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </td>
        <td className="w-10 px-1 py-1.5 align-middle text-center">
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted opacity-60 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            aria-label="Delete action"
            disabled={saving}
            onClick={() => void removeAction(a.id)}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <button
        type="button"
        className="flex min-h-[6.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-gradient-to-b from-surface-raised/30 to-surface px-2 py-2 transition hover:border-border hover:shadow-sm"
        onClick={() => setZoomOpen(true)}
        aria-label="Open actions"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-blue-500/40 bg-blue-500/12 px-2 text-[11px] font-bold tabular-nums text-blue-800 shadow-sm dark:text-blue-200"
            title="Open actions"
          >
            {total}
          </span>
          {overdue > 0 ? (
            <span
              className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/12 px-2 text-[11px] font-bold tabular-nums text-rose-800 shadow-sm dark:text-rose-200"
              title="Overdue actions"
            >
              {overdue}
            </span>
          ) : null}
        </div>
        <span className="text-[9px] font-medium text-muted">System &amp; capability</span>
      </button>

      {zoomOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-[1px] sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={handleCloseModal}
        >
          <div
            className="flex max-h-[80dvh] w-[min(56rem,96vw)] flex-col overflow-hidden rounded-2xl border border-border/90 bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 border-b border-border/80 bg-surface-raised/40 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{columnHeader}</p>
                  <p className="text-xs text-muted">WDS actions</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-blue-500/35 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-800 dark:text-blue-200">
                      <span className="tabular-nums">{total}</span> open
                    </span>
                    {overdue > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                        <span className="tabular-nums">{overdue}</span> overdue
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={`${ddsBtn} h-8 gap-1 px-2.5 text-xs`}
                    onClick={() => {
                      setShowCreate((v) => !v)
                      setDraft(emptyDraft(todayYmd))
                    }}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 text-muted hover:bg-surface-raised hover:text-fg"
                    aria-label="Close"
                    onClick={handleCloseModal}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Include</span>
                <button
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    showCompleted
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
                      : 'border-border/80 bg-surface text-muted hover:border-border-strong'
                  }`}
                  onClick={() => setShowCompleted((v) => !v)}
                >
                  Completed
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    showNotRequired
                      ? 'border-zinc-500/50 bg-zinc-400/20 text-fg'
                      : 'border-border/80 bg-surface text-muted hover:border-border-strong'
                  }`}
                  onClick={() => setShowNotRequired((v) => !v)}
                >
                  Not required
                </button>
                {hiddenCount > 0 ? (
                  <span className="text-[10px] text-muted">{hiddenCount} hidden</span>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              {showCreate ? (
                <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3 shadow-sm">
                  <p className="mb-2 text-xs font-semibold text-fg">New action</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className={fieldLabel}>
                      Kind
                      <select
                        className={fieldSelect}
                        value={draft.kind}
                        onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as WdsActionKind }))}
                      >
                        {WDS_ACTION_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {WDS_ACTION_KIND_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={`${fieldLabel} sm:col-span-2`}>
                      Title
                      <input
                        className={fieldInput}
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      />
                    </label>
                    <label className={fieldLabel}>
                      Owner
                      <input
                        className={fieldInput}
                        value={draft.owner_name}
                        onChange={(e) => setDraft((d) => ({ ...d, owner_name: e.target.value }))}
                      />
                    </label>
                    <label className={fieldLabel}>
                      Target date
                      <input
                        type="date"
                        className={fieldInput}
                        value={draft.target_date}
                        onChange={(e) => setDraft((d) => ({ ...d, target_date: e.target.value }))}
                      />
                    </label>
                    <label className={fieldLabel}>
                      Status
                      <select
                        className={fieldSelect}
                        value={draft.status}
                        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as WdsActionStatus }))}
                      >
                        {WDS_ACTION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {WDS_ACTION_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={fieldLabel}>
                      System (HC type)
                      <select
                        className={fieldSelect}
                        value={draft.hc_type_id}
                        onChange={(e) => setDraft((d) => ({ ...d, hc_type_id: e.target.value }))}
                      >
                        <option value="">Not linked</option>
                        {hcTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" className={`${ddsBtnGhost} h-8 px-3 text-xs`} onClick={() => setShowCreate(false)}>
                      Cancel
                    </button>
                    <button type="button" className={`${ddsBtn} h-8 px-3 text-xs`} disabled={saving} onClick={() => void createAction()}>
                      Save action
                    </button>
                  </div>
                </div>
              ) : null}

              {visibleActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface-raised/20 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-fg">No actions to show</p>
                  <p className="mt-1 max-w-xs text-xs text-muted">
                    {actions.length === 0
                      ? 'Create your first system or capability action with Add.'
                      : 'Turn on Completed or Not required, or add a new open action.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/80">
                  <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-raised/60 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        <th className="px-2 py-2">Kind</th>
                        <th className="px-2 py-2">Title</th>
                        <th className="px-2 py-2">Owner</th>
                        <th className="px-2 py-2">Due</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">System (HC)</th>
                        <th className="px-1 py-2 w-10" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>{visibleActions.map(renderActionRow)}</tbody>
                  </table>
                </div>
              )}
            </div>

            {saving ? (
              <footer className="shrink-0 border-t border-border/80 px-4 py-2 text-xs text-muted">Saving…</footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
