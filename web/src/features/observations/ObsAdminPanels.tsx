import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useLdrWorkspace } from '../ldr/LdrWorkspaceContext'
import type { ObsKind } from './obsKind'
import { obsLabel } from './obsKind'
import { obsStorageBucket } from './obsStorage'

type LdrActivityOption = { id: string; name: string; sort_order: number }

type ObsTypeRow = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  active: boolean
  sort_order: number
  standard_url?: string | null
}

type ObsTemplateRow = {
  id: string
  name: string
  version: number
  active: boolean
  description: string | null
}

type ObsQuestionRow = {
  id: string
  template_id: string
  question_text: string
  expected_standard: string
  sort_order: number
  active: boolean
  is_critical: boolean
  help_text: string | null
  good_image_path: string
  bad_image_path: string
}

function typesTable(k: ObsKind) {
  return k === 'sos' ? 'sos_types' : k === 'qos' ? 'qos_types' : 'ppo_types'
}

function formatObsTypeSaveError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('standard_url') && (m.includes('schema cache') || m.includes('pgrst'))) {
    return `${message} — In Supabase → SQL, run scripts/apply-obs-types-standard-url.sql for this project, then save again.`
  }
  return message
}
function templatesTable(k: ObsKind) {
  return k === 'sos' ? 'sos_templates' : k === 'qos' ? 'qos_templates' : 'ppo_templates'
}
function tplFk(k: ObsKind) {
  return k === 'sos' ? 'sos_type_id' : k === 'qos' ? 'qos_type_id' : 'ppo_type_id'
}
function questionsTable(k: ObsKind) {
  return k === 'sos' ? 'sos_template_questions' : k === 'qos' ? 'qos_template_questions' : 'ppo_template_questions'
}

export function LdrAdminObsTypesPanel({ kind }: { kind: ObsKind }) {
  const { workspaceId } = useLdrWorkspace()
  const [rows, setRows] = useState<ObsTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'add' | { edit: ObsTypeRow } | null>(null)
  const tt = typesTable(kind)
  const label = obsLabel(kind)

  const load = useCallback(async () => {
    setError(null)
    if (!workspaceId) {
      setLoading(false)
      setRows([])
      return
    }
    setLoading(true)
    const res = await supabase.from(tt).select('*').eq('workspace_id', workspaceId).order('sort_order').order('name')
    setLoading(false)
    if (res.error) {
      setError(res.error.message)
      setRows([])
      return
    }
    setRows((res.data ?? []) as ObsTypeRow[])
  }, [workspaceId, tt])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function removeType(row: ObsTypeRow) {
    setError(null)
    const tpl = templatesTable(kind)
    const fk = tplFk(kind)
    const { count, error: cErr } = await supabase.from(tpl).select('id', { count: 'exact', head: true }).eq(fk, row.id)
    if (cErr) {
      setError(cErr.message)
      return
    }
    if (count && count > 0) {
      setError('Remove or reassign templates for this type before unlinking.')
      return
    }
    if (!window.confirm(`Delete ${label} type “${row.name}”?`)) return
    const del = await supabase.from(tt).delete().eq('id', row.id)
    if (del.error) setError(del.error.message)
    else void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Configure one linked <strong className="font-medium text-fg">LDR activity</strong> for {label}, then manage
          multiple {label} types inside this system.
        </p>
        <button
          type="button"
          onClick={() => setDialog('add')}
          disabled={!workspaceId}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500"
        >
          <Plus className="size-4" aria-hidden />
          New type
        </button>
      </div>
      {workspaceId ? <ObsSystemActivityLinkCard kind={kind} workspaceId={workspaceId} /> : null}
      {!workspaceId ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Open LDR tools with a resolved workspace to manage {label} types.
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
                  No types yet.
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

      {dialog === 'add' && workspaceId ? (
        <ObsTypeCreateDialog
          kind={kind}
          workspaceId={workspaceId}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            void load()
          }}
        />
      ) : null}
      {dialog && dialog !== 'add' ? (
        <ObsTypeEditDialog
          kind={kind}
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

function ObsSystemActivityLinkCard(props: { kind: ObsKind; workspaceId: string }) {
  const label = obsLabel(props.kind)
  const [activities, setActivities] = useState<LdrActivityOption[]>([])
  const [linkedActivityId, setLinkedActivityId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const [actsRes, linkRes] = await Promise.all([
        supabase
          .from('ldr_activities')
          .select('id, name, sort_order')
          .eq('workspace_id', props.workspaceId)
          .order('sort_order')
          .order('name'),
        supabase
          .from('obs_system_activity_links')
          .select('ldr_activity_id')
          .eq('workspace_id', props.workspaceId)
          .eq('kind', props.kind)
          .maybeSingle(),
      ])
      if (cancelled) return
      setLoading(false)
      if (actsRes.error) {
        setError(actsRes.error.message)
        setActivities([])
        return
      }
      if (linkRes.error) {
        setError(linkRes.error.message)
        setActivities((actsRes.data ?? []) as LdrActivityOption[])
        return
      }
      setActivities((actsRes.data ?? []) as LdrActivityOption[])
      setLinkedActivityId(((linkRes.data as { ldr_activity_id?: string } | null)?.ldr_activity_id ?? '') as string)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [props.workspaceId, props.kind])

  async function saveLink() {
    setSaving(true)
    setError(null)
    const payload = {
      workspace_id: props.workspaceId,
      kind: props.kind,
      ldr_activity_id: linkedActivityId || null,
    }
    if (!linkedActivityId) {
      const del = await supabase
        .from('obs_system_activity_links')
        .delete()
        .eq('workspace_id', props.workspaceId)
        .eq('kind', props.kind)
      setSaving(false)
      if (del.error) setError(del.error.message)
      return
    }
    const up = await supabase.from('obs_system_activity_links').upsert(payload, { onConflict: 'workspace_id,kind' })
    setSaving(false)
    if (up.error) setError(up.error.message)
  }

  const linkedName = activities.find((a) => a.id === linkedActivityId)?.name ?? ''

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg">
          Linked {label} activity: {linkedName ? <span className="text-teal-700 dark:text-teal-300">{linkedName}</span> : 'Not linked'}
        </p>
        {!linkedActivityId ? (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-900 dark:text-amber-100">
            Required for roster "Complete {label}"
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-[16rem] flex-1 text-xs font-medium text-muted">
          LDR activity
          <select
            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={linkedActivityId}
            disabled={loading}
            onChange={(e) => setLinkedActivityId(e.target.value)}
          >
            <option value="">— Not linked —</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void saveLink()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-raised disabled:opacity-50"
        >
          <Link2 className="size-4" aria-hidden />
          {saving ? 'Saving…' : 'Save link'}
        </button>
      </div>
    </div>
  )
}

function ObsTypeCreateDialog(props: {
  kind: ObsKind
  workspaceId: string
  onClose: () => void
  onSaved: () => void
}) {
  const tt = typesTable(props.kind)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [standardUrl, setStandardUrl] = useState('')
  const [active, setActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('0')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setErr(null)
    const cleanName = name.trim()
    if (!cleanName) {
      setErr('Type name is required.')
      return
    }
    const so = Number.parseInt(sortOrder, 10)
    if (Number.isNaN(so)) {
      setErr('Sort order must be a number.')
      return
    }
    setSaving(true)
    const res = await supabase.from(tt).insert({
      workspace_id: props.workspaceId,
      name: cleanName,
      description: description.trim() || null,
      standard_url: standardUrl.trim() || null,
      active,
      sort_order: so,
    })
    setSaving(false)
    if (res.error) {
      setErr(formatObsTypeSaveError(res.error.message))
      return
    }
    props.onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">New {obsLabel(props.kind)} type</h2>
        {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        <label className="mt-4 block text-xs font-medium text-muted">
          Type name
          <input
            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Description (optional)
          <textarea
            className="mt-1 min-h-[3rem] w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Link to standard (optional)
          <input
            type="text"
            placeholder="https://… or /path-in-this-app"
            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={standardUrl}
            onChange={(e) => setStandardUrl(e.target.value)}
          />
          <span className="mt-1 block text-[11px] text-muted">Any page: full web address, or a path starting with / for a screen in this app.</span>
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
            disabled={saving || !name.trim()}
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

function ObsTypeEditDialog(props: { kind: ObsKind; row: ObsTypeRow; onClose: () => void; onSaved: () => void }) {
  const tt = typesTable(props.kind)
  const [description, setDescription] = useState(props.row.description ?? '')
  const [standardUrl, setStandardUrl] = useState(props.row.standard_url ?? '')
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
      .from(tt)
      .update({
        description: description.trim() || null,
        standard_url: standardUrl.trim() || null,
        active,
        sort_order: so,
      })
      .eq('id', props.row.id)
    setSaving(false)
    if (res.error) {
      setErr(formatObsTypeSaveError(res.error.message))
      return
    }
    props.onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Edit {obsLabel(props.kind)} type</h2>
        <p className="mt-1 text-sm text-muted">
          Type: <span className="font-medium text-fg">{props.row.name}</span>
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
        <label className="mt-3 block text-xs font-medium text-muted">
          Link to standard (optional)
          <input
            type="text"
            placeholder="https://… or /path-in-this-app"
            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={standardUrl}
            onChange={(e) => setStandardUrl(e.target.value)}
          />
          <span className="mt-1 block text-[11px] text-muted">Full URL opens in a new tab; paths starting with / open in this app.</span>
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

export function LdrAdminObsTemplatesPanel({ kind }: { kind: ObsKind }) {
  const { workspaceId } = useLdrWorkspace()
  const [types, setTypes] = useState<ObsTypeRow[]>([])
  const [typeId, setTypeId] = useState('')
  const [templates, setTemplates] = useState<ObsTemplateRow[]>([])
  const [selectedTplId, setSelectedTplId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ObsQuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tplDialog, setTplDialog] = useState<'add' | null>(null)
  const [qDialog, setQDialog] = useState<'add' | { edit: ObsQuestionRow } | null>(null)

  const tt = typesTable(kind)
  const tpl = templatesTable(kind)
  const fk = tplFk(kind)
  const qt = questionsTable(kind)
  const label = obsLabel(kind)

  const loadTypes = useCallback(async () => {
    if (!workspaceId) {
      setTypes([])
      setTypeId('')
      return
    }
    const res = await supabase.from(tt).select('*').eq('workspace_id', workspaceId).order('sort_order').order('name')
    if (!res.error && res.data) {
      const list = res.data as ObsTypeRow[]
      setTypes(list)
      setTypeId((prev) => (prev && list.some((t) => t.id === prev) ? prev : list[0]?.id || ''))
    }
  }, [workspaceId, tt])

  const loadTemplates = useCallback(async () => {
    if (!typeId) {
      setTemplates([])
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    const res = await supabase.from(tpl).select('*').eq(fk, typeId).order('version', { ascending: false })
    setLoading(false)
    if (res.error) {
      setError(res.error.message)
      setTemplates([])
      return
    }
    setTemplates((res.data ?? []) as ObsTemplateRow[])
  }, [typeId, tpl, fk])

  const loadQuestions = useCallback(
    async (templateId: string) => {
      const res = await supabase.from(qt).select('*').eq('template_id', templateId).order('sort_order').order('question_text')
      if (!res.error && res.data) setQuestions(res.data as ObsQuestionRow[])
      else setQuestions([])
    },
    [qt],
  )

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
    const d = await supabase.from(tpl).update({ active: false }).eq(fk, typeId)
    if (d.error) {
      setError(d.error.message)
      return
    }
    const a = await supabase.from(tpl).update({ active: true }).eq('id', templateId)
    if (a.error) setError(a.error.message)
    await loadTemplates()
  }

  async function moveQuestion(q: ObsQuestionRow, dir: -1 | 1) {
    const idx = questions.findIndex((x) => x.id === q.id)
    const swap = questions[idx + dir]
    if (!swap) return
    const a1 = supabase.from(qt).update({ sort_order: swap.sort_order }).eq('id', q.id)
    const a2 = supabase.from(qt).update({ sort_order: q.sort_order }).eq('id', swap.id)
    const [r1, r2] = await Promise.all([a1, a2])
    if (r1.error || r2.error) setError(r1.error?.message ?? r2.error?.message ?? 'Move failed')
    if (selectedTplId) await loadQuestions(selectedTplId)
  }

  return (
    <div className="space-y-6">
      {!workspaceId ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Resolve LDR workspace to manage {label} templates.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-xs font-medium text-muted">
          {label} type
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
                  No templates.
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
            <h3 className="text-sm font-semibold">Questions</h3>
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
                    Images: {q.good_image_path ? 'good ✓' : 'good —'} · {q.bad_image_path ? 'bad ✓' : 'bad —'}
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
                        .from(qt)
                        .delete()
                        .eq('id', q.id)
                        .then(async ({ error: delErr }) => {
                          if (delErr) setError(delErr.message)
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
        <ObsTemplateDialog
          kind={kind}
          typeId={typeId}
          onClose={() => setTplDialog(null)}
          onSaved={() => {
            setTplDialog(null)
            void loadTemplates()
          }}
        />
      ) : null}

      {qDialog && selectedTplId ? (
        <ObsQuestionDialog
          kind={kind}
          templateId={selectedTplId}
          initial={qDialog === 'add' ? null : qDialog.edit}
          nextSortOrder={questions.length ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 0}
          onClose={() => setQDialog(null)}
          onSaved={() => {
            setQDialog(null)
            if (selectedTplId) void loadQuestions(selectedTplId)
          }}
        />
      ) : null}
    </div>
  )
}

function ObsTemplateDialog(props: { kind: ObsKind; typeId: string; onClose: () => void; onSaved: () => void }) {
  const tpl = templatesTable(props.kind)
  const fk = tplFk(props.kind)
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
    const res = await supabase.from(tpl).insert({
      [fk]: props.typeId,
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
        {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        <label className="mt-4 block text-xs font-medium text-muted">
          Name
          <input className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Version
          <input className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm" value={version} onChange={(e) => setVersion(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Description
          <textarea className="mt-1 min-h-[3rem] w-full rounded-lg border border-border px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
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

function ObsQuestionDialog(props: {
  kind: ObsKind
  templateId: string
  initial: ObsQuestionRow | null
  nextSortOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const qt = questionsTable(props.kind)
  const bucket = obsStorageBucket()
  const [questionText, setQuestionText] = useState(props.initial?.question_text ?? '')
  const [expectedStandard, setExpectedStandard] = useState(props.initial?.expected_standard ?? '')
  const [helpText, setHelpText] = useState(props.initial?.help_text ?? '')
  const [sortOrder, setSortOrder] = useState(String(props.initial?.sort_order ?? props.nextSortOrder))
  const [active, setActive] = useState(props.initial?.active ?? true)
  const [goodPath, setGoodPath] = useState(props.initial?.good_image_path ?? '')
  const [badPath, setBadPath] = useState(props.initial?.bad_image_path ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function upload(which: 'good' | 'bad', file: File | null) {
    if (!file) return
    setErr(null)
    const path = `${props.kind}/${props.templateId}/${crypto.randomUUID()}_${file.name.replace(/[^\w.-]+/g, '_')}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) {
      setErr(error.message)
      return
    }
    if (which === 'good') setGoodPath(path)
    else setBadPath(path)
  }

  async function save() {
    setErr(null)
    const qtText = questionText.trim()
    if (!qtText) {
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
      question_text: qtText,
      expected_standard: expectedStandard.trim(),
      help_text: helpText.trim() || null,
      sort_order: so,
      is_critical: false,
      active,
      good_image_path: goodPath.trim(),
      bad_image_path: badPath.trim(),
    }
    const res = props.initial
      ? await supabase.from(qt).update(payload).eq('id', props.initial.id)
      : await supabase.from(qt).insert(payload)
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
          <textarea className="mt-1 min-h-[4rem] w-full rounded-lg border border-border px-3 py-2 text-sm" value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Expected standard
          <textarea className="mt-1 min-h-[4rem] w-full rounded-lg border border-border px-3 py-2 text-sm" value={expectedStandard} onChange={(e) => setExpectedStandard(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Help text (optional)
          <textarea className="mt-1 min-h-[3rem] w-full rounded-lg border border-border px-3 py-2 text-sm" value={helpText} onChange={(e) => setHelpText(e.target.value)} />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Good image (admin upload)
          <input type="file" accept="image/*" className="mt-1 block text-sm" onChange={(e) => void upload('good', e.target.files?.[0] ?? null)} />
          <input className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-xs" value={goodPath} onChange={(e) => setGoodPath(e.target.value)} placeholder="Storage path" />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Bad image (admin upload)
          <input type="file" accept="image/*" className="mt-1 block text-sm" onChange={(e) => void upload('bad', e.target.files?.[0] ?? null)} />
          <input className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-xs" value={badPath} onChange={(e) => setBadPath(e.target.value)} placeholder="Storage path" />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Sort order
          <input className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
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
