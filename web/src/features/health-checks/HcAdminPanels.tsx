import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLdrWorkspace } from '../ldr/LdrWorkspaceContext'
import type { HcTemplateQuestionRow, HcTemplateRow, HcTypeRow } from './types'

type LdrActivityOption = { id: string; name: string; sort_order: number }

export function LdrAdminHcTypesPanel() {
  const { workspaceId } = useLdrWorkspace()
  const [rows, setRows] = useState<HcTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'link' | { edit: HcTypeRow } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    if (!workspaceId) {
      setLoading(false)
      setRows([])
      return
    }
    setLoading(true)
    const res = await supabase
      .from('hc_types')
      .select('*, ldr_activities!inner(name, workspace_id)')
      .eq('ldr_activities.workspace_id', workspaceId)
      .order('sort_order')
      .order('name')
    setLoading(false)
    if (res.error) {
      setError(res.error.message)
      setRows([])
      return
    }
    setRows((res.data ?? []) as HcTypeRow[])
  }, [workspaceId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function removeType(row: HcTypeRow) {
    setError(null)
    const { count, error: cErr } = await supabase
      .from('hc_templates')
      .select('id', { count: 'exact', head: true })
      .eq('hc_type_id', row.id)
    if (cErr) {
      setError(cErr.message)
      return
    }
    if (count && count > 0) {
      setError('Remove or reassign templates for this type before unlinking.')
      return
    }
    if (!window.confirm(`Remove health check type for activity “${row.name}”?`)) return
    const del = await supabase.from('hc_types').delete().eq('id', row.id)
    if (del.error) setError(del.error.message)
    else void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Each HC type is tied to one <strong className="font-medium text-fg">LDR activity</strong> in the current
          workspace. Add by choosing an activity that does not already have a type.
        </p>
        <button
          type="button"
          onClick={() => setDialog('link')}
          disabled={!workspaceId}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500"
        >
          <Link2 className="size-4" aria-hidden />
          Link activity
        </button>
      </div>
      {!workspaceId ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Open LDR tools with a resolved workspace (site or cell scope in the bar above) to manage HC types.
        </p>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Activity / type name</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Sort</th>
              <th className="px-4 py-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No types linked yet. Use <strong className="font-medium text-fg">Link activity</strong> after
                  activities exist under LDR Admin → Activities.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/80">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.active ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 tabular-nums">{r.sort_order}</td>
                  <td className="space-x-2 px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setDialog({ edit: r })}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-teal-700 hover:bg-teal-500/10 dark:text-teal-300"
                    >
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeType(r)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Unlink
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialog === 'link' && workspaceId ? (
        <HcLinkActivityDialog
          workspaceId={workspaceId}
          linkedActivityIds={new Set(rows.map((r) => r.ldr_activity_id))}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            void load()
          }}
        />
      ) : null}
      {dialog && dialog !== 'link' ? (
        <HcTypeEditDialog
          row={dialog.edit}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function HcLinkActivityDialog(props: {
  workspaceId: string
  linkedActivityIds: ReadonlySet<string>
  onClose: () => void
  onSaved: () => void
}) {
  const [activities, setActivities] = useState<LdrActivityOption[]>([])
  const [activityId, setActivityId] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('0')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingActs, setLoadingActs] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingActs(true)
      const res = await supabase
        .from('ldr_activities')
        .select('id, name, sort_order')
        .eq('workspace_id', props.workspaceId)
        .order('sort_order')
        .order('name')
      if (cancelled) return
      setLoadingActs(false)
      if (res.error) {
        setErr(res.error.message)
        setActivities([])
        return
      }
      setActivities((res.data ?? []) as LdrActivityOption[])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.workspaceId])

  const available = useMemo(
    () => activities.filter((a) => !props.linkedActivityIds.has(a.id)),
    [activities, props.linkedActivityIds],
  )

  async function save() {
    setErr(null)
    if (!activityId) {
      setErr('Choose an activity.')
      return
    }
    const so = Number.parseInt(sortOrder, 10)
    if (Number.isNaN(so)) {
      setErr('Sort order must be a number.')
      return
    }
    const act = activities.find((a) => a.id === activityId)
    if (!act) {
      setErr('Invalid activity.')
      return
    }
    setSaving(true)
    const res = await supabase.from('hc_types').insert({
      ldr_activity_id: activityId,
      name: act.name,
      description: description.trim() || null,
      active,
      sort_order: so,
    })
    setSaving(false)
    if (res.error) {
      setErr(res.error.message)
      return
    }
    props.onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Link LDR activity</h2>
        <p className="mt-1 text-xs text-muted">The type label matches the activity name (updates if you rename the activity).</p>
        {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        <label className="mt-4 block text-xs font-medium text-muted">
          Activity
          <select
            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
            disabled={loadingActs}
          >
            <option value="">— Select —</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {available.length === 0 && !loadingActs ? (
          <p className="mt-2 text-sm text-muted">All activities are already linked, or there are no activities in this workspace.</p>
        ) : null}
        <label className="mt-3 block text-xs font-medium text-muted">
          Description (optional)
          <textarea
            className="mt-1 min-h-[3rem] w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Sort order
          <input
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !activityId}
            onClick={() => void save()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HcTypeEditDialog(props: { row: HcTypeRow; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState(props.row.description ?? '')
  const [active, setActive] = useState(props.row.active)
  const [sortOrder, setSortOrder] = useState(String(props.row.sort_order))
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setErr(null)
    const so = Number.parseInt(sortOrder, 10)
    if (Number.isNaN(so)) {
      setErr('Sort order must be a number.')
      return
    }
    setSaving(true)
    const res = await supabase
      .from('hc_types')
      .update({
        description: description.trim() || null,
        active,
        sort_order: so,
      })
      .eq('id', props.row.id)
    setSaving(false)
    if (res.error) {
      setErr(res.error.message)
      return
    }
    props.onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Edit HC type</h2>
        <p className="mt-1 text-sm text-muted">
          Activity: <span className="font-medium text-fg">{props.row.name}</span>
        </p>
        {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        <label className="mt-4 block text-xs font-medium text-muted">
          Description
          <textarea
            className="mt-1 min-h-[3rem] w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Sort order
          <input
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LdrAdminHcTemplatesPanel() {
  const { workspaceId } = useLdrWorkspace()
  const [types, setTypes] = useState<HcTypeRow[]>([])
  const [typeId, setTypeId] = useState('')
  const [templates, setTemplates] = useState<HcTemplateRow[]>([])
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<HcTemplateQuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tplDialog, setTplDialog] = useState<'add' | null>(null)
  const [qDialog, setQDialog] = useState<'add' | { edit: HcTemplateQuestionRow } | null>(null)

  const loadTypes = useCallback(async () => {
    if (!workspaceId) {
      setTypes([])
      setTypeId('')
      return
    }
    const res = await supabase
      .from('hc_types')
      .select('*, ldr_activities!inner(workspace_id)')
      .eq('ldr_activities.workspace_id', workspaceId)
      .order('sort_order')
      .order('name')
    if (!res.error && res.data) {
      const list = res.data as HcTypeRow[]
      setTypes(list)
      setTypeId((prev) => (prev && list.some((t) => t.id === prev) ? prev : list[0]?.id || ''))
    }
  }, [workspaceId])

  const loadTemplates = useCallback(async () => {
    if (!typeId) {
      setTemplates([])
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    const res = await supabase
      .from('hc_templates')
      .select('*')
      .eq('hc_type_id', typeId)
      .order('version', { ascending: false })
    setLoading(false)
    if (res.error) {
      setError(res.error.message)
      setTemplates([])
      return
    }
    setTemplates((res.data ?? []) as HcTemplateRow[])
  }, [typeId])

  const loadQuestions = useCallback(async (templateId: string) => {
    const res = await supabase
      .from('hc_template_questions')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order')
      .order('question_text')
    if (!res.error && res.data) setQuestions(res.data as HcTemplateQuestionRow[])
    else setQuestions([])
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void loadTypes()
    })
  }, [loadTypes])

  useEffect(() => {
    queueMicrotask(() => {
      void loadTemplates()
    })
  }, [loadTemplates])

  useEffect(() => {
    queueMicrotask(() => {
      if (selectedTplId) void loadQuestions(selectedTplId)
      else setQuestions([])
    })
  }, [selectedTplId, loadQuestions])

  async function activateTemplate(templateId: string) {
    if (!typeId) return
    setError(null)
    const d = await supabase.from('hc_templates').update({ active: false }).eq('hc_type_id', typeId)
    if (d.error) {
      setError(d.error.message)
      return
    }
    const a = await supabase.from('hc_templates').update({ active: true }).eq('id', templateId)
    if (a.error) setError(a.error.message)
    await loadTemplates()
  }

  async function moveQuestion(q: HcTemplateQuestionRow, dir: -1 | 1) {
    const idx = questions.findIndex((x) => x.id === q.id)
    const swap = questions[idx + dir]
    if (!swap) return
    const a1 = supabase.from('hc_template_questions').update({ sort_order: swap.sort_order }).eq('id', q.id)
    const a2 = supabase.from('hc_template_questions').update({ sort_order: q.sort_order }).eq('id', swap.id)
    const [r1, r2] = await Promise.all([a1, a2])
    if (r1.error || r2.error) setError(r1.error?.message ?? r2.error?.message ?? 'Move failed')
    if (selectedTplId) await loadQuestions(selectedTplId)
  }

  return (
    <div className="space-y-6">
      {!workspaceId ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Resolve LDR workspace (scope bar) to manage templates for activity-linked HC types.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-xs font-medium text-muted">
          HC type
          <select
            className="mt-1 h-10 min-w-[12rem] rounded-lg border border-border bg-surface px-3 text-sm"
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value)
              setSelectedTplId(null)
            }}
            disabled={!workspaceId}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setTplDialog('add')}
          disabled={!typeId}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500"
        >
          <Plus className="size-4" aria-hidden />
          New template
        </button>
      </div>
      {error ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-2 text-sm font-semibold">Templates</div>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-raised/60 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Ver</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No templates. Create one to add questions.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="border-b border-border/80">
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 tabular-nums">{t.version}</td>
                  <td className="px-4 py-2">{t.active ? 'Yes' : 'No'}</td>
                  <td className="space-x-2 px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedTplId(t.id)}
                      className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
                    >
                      Questions
                    </button>
                    {!t.active ? (
                      <button
                        type="button"
                        onClick={() => void activateTemplate(t.id)}
                        className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
                      >
                        Set active
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTplId ? (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Questions for selected template</h3>
            <button
              type="button"
              onClick={() => setQDialog('add')}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white dark:bg-teal-500"
            >
              <Plus className="size-3.5" aria-hidden />
              Add question
            </button>
          </div>
          <ul className="space-y-3">
            {questions.map((q) => (
              <li
                key={q.id}
                className="flex flex-col gap-2 rounded-xl border border-border-strong p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="font-medium">{q.question_text}</div>
                  <div className="mt-1 text-xs text-muted line-clamp-2">{q.expected_standard}</div>
                  <div className="mt-1 text-xs text-muted">
                    Sort: {q.sort_order} · Active: {q.active ? 'yes' : 'no'}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    title="Move up"
                    onClick={() => void moveQuestion(q, -1)}
                    className="rounded-lg border border-border p-2 text-muted hover:bg-surface-raised"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    onClick={() => void moveQuestion(q, 1)}
                    className="rounded-lg border border-border p-2 text-muted hover:bg-surface-raised"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQDialog({ edit: q })}
                    className="rounded-lg border border-border p-2 text-teal-700 dark:text-teal-300"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void supabase
                        .from('hc_template_questions')
                        .delete()
                        .eq('id', q.id)
                        .then(async ({ error }) => {
                          if (error) setError(error.message)
                          else if (selectedTplId) await loadQuestions(selectedTplId)
                        })
                    }}
                    className="rounded-lg border border-border p-2 text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tplDialog === 'add' && typeId ? (
        <HcTemplateDialog
          hcTypeId={typeId}
          onClose={() => setTplDialog(null)}
          onSaved={() => {
            setTplDialog(null)
            void loadTemplates()
          }}
        />
      ) : null}

      {qDialog && selectedTplId ? (
        <HcQuestionDialog
          templateId={selectedTplId}
          initial={qDialog === 'add' ? null : qDialog.edit}
          nextSortOrder={questions.length ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 0}
          onClose={() => setQDialog(null)}
          onSaved={() => {
            setQDialog(null)
            void loadQuestions(selectedTplId)
          }}
        />
      ) : null}
    </div>
  )
}

function HcTemplateDialog(props: {
  hcTypeId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1')
  const [description, setDescription] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setErr(null)
    const n = name.trim()
    if (!n) {
      setErr('Name is required.')
      return
    }
    const v = Number.parseInt(version, 10)
    if (Number.isNaN(v) || v < 1) {
      setErr('Version must be a positive integer.')
      return
    }
    setSaving(true)
    const res = await supabase.from('hc_templates').insert({
      hc_type_id: props.hcTypeId,
      name: n,
      version: v,
      description: description.trim() || null,
      active: false,
    })
    setSaving(false)
    if (res.error) {
      setErr(res.error.message)
      return
    }
    props.onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">New template</h2>
        <p className="mt-1 text-xs text-muted">Starts inactive. Use “Set active” after adding questions.</p>
        {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        <label className="mt-4 block text-xs font-medium text-muted">
          Name
          <input
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Version
          <input
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Description
          <textarea
            className="mt-1 min-h-[3rem] w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HcQuestionDialog(props: {
  templateId: string
  initial: HcTemplateQuestionRow | null
  nextSortOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [questionText, setQuestionText] = useState(props.initial?.question_text ?? '')
  const [expectedStandard, setExpectedStandard] = useState(props.initial?.expected_standard ?? '')
  const [helpText, setHelpText] = useState(props.initial?.help_text ?? '')
  const [sortOrder, setSortOrder] = useState(String(props.initial?.sort_order ?? props.nextSortOrder))
  const [active, setActive] = useState(props.initial?.active ?? true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setErr(null)
    const qt = questionText.trim()
    if (!qt) {
      setErr('Question text is required.')
      return
    }
    const so = Number.parseInt(sortOrder, 10)
    if (Number.isNaN(so)) {
      setErr('Sort order must be a number.')
      return
    }
    setSaving(true)
    const payload = {
      template_id: props.templateId,
      question_text: qt,
      expected_standard: expectedStandard.trim(),
      help_text: helpText.trim() || null,
      sort_order: so,
      is_critical: false,
      active,
    }
    const res = props.initial
      ? await supabase.from('hc_template_questions').update(payload).eq('id', props.initial.id)
      : await supabase.from('hc_template_questions').insert(payload)
    setSaving(false)
    if (res.error) {
      setErr(res.error.message)
      return
    }
    props.onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{props.initial ? 'Edit question' : 'New question'}</h2>
        {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        <label className="mt-4 block text-xs font-medium text-muted">
          Question
          <textarea
            className="mt-1 min-h-[4rem] w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Expected standard
          <textarea
            className="mt-1 min-h-[4rem] w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={expectedStandard}
            onChange={(e) => setExpectedStandard(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Help text (optional)
          <textarea
            className="mt-1 min-h-[3rem] w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={helpText}
            onChange={(e) => setHelpText(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Sort order
          <input
            className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
