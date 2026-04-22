import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, Copy, LayoutList, Pause, Play, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { localYMD } from '../../lib/dueDateUtils'
import { usePlan24Workspace } from './Plan24WorkspaceContext'
import type {
  Plan24CheckScheduleRoleRow,
  Plan24CheckScheduleRow,
  Plan24CheckTemplateRow,
  Plan24CheckTemplateTaskRow,
  Plan24CheckTemplateVersionRow,
  Plan24ShiftRow,
  Plan24RosterRoleRow,
} from './plan24Types'

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

const textareaClass =
  'mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

const weekdayOptions = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]

type ScheduleDraft = {
  id: string | null
  name: string
  templateId: string
  templateVersionId: string
  shiftKind: string
  recurrenceKind: 'hourly' | 'daily' | 'weekly' | 'monthly'
  intervalN: string
  weekdays: number[]
  monthDay: string
  startLocalTime: string
  hourlyUntilLocal: string
  durationMinutes: string
  startsOn: string
  endsOn: string
  timezone: string
  state: 'active' | 'paused' | 'archived'
  roleNames: string[]
}

export function Plan24AdminChecksTab() {
  const { cellId, status } = usePlan24Workspace()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [templates, setTemplates] = useState<Plan24CheckTemplateRow[]>([])
  const [versions, setVersions] = useState<Plan24CheckTemplateVersionRow[]>([])
  const [tasks, setTasks] = useState<Plan24CheckTemplateTaskRow[]>([])
  const [schedules, setSchedules] = useState<Plan24CheckScheduleRow[]>([])
  const [scheduleRoles, setScheduleRoles] = useState<Plan24CheckScheduleRoleRow[]>([])
  const [rosterRoles, setRosterRoles] = useState<Plan24RosterRoleRow[]>([])
  const [shifts, setShifts] = useState<Plan24ShiftRow[]>([])

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)

  const [versionTitle, setVersionTitle] = useState('')
  const [versionNotes, setVersionNotes] = useState('')
  const [versionSaving, setVersionSaving] = useState(false)

  const [taskLabel, setTaskLabel] = useState('')
  const [taskRequired, setTaskRequired] = useState(true)
  const [taskSaving, setTaskSaving] = useState(false)

  const [scheduleDialog, setScheduleDialog] = useState<ScheduleDraft | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)

  /** Split heavy UI: template authoring vs recurring schedules. */
  const [checksNav, setChecksNav] = useState<'templates' | 'schedules'>('templates')
  /** Modal for versions + tasks (keeps main view scannable). */
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )

  const selectedTemplateVersions = useMemo(
    () =>
      versions
        .filter((v) => v.template_id === selectedTemplateId)
        .sort((a, b) => b.version_no - a.version_no || b.created_at.localeCompare(a.created_at)),
    [versions, selectedTemplateId],
  )

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId],
  )

  const selectedVersionTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.version_id === selectedVersionId)
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [tasks, selectedVersionId],
  )

  const templateLabel = useMemo(() => {
    const m = new Map<string, string>()
    templates.forEach((t) => m.set(t.id, t.name))
    return m
  }, [templates])

  const versionLabel = useMemo(() => {
    const m = new Map<string, string>()
    versions.forEach((v) => m.set(v.id, `v${v.version_no} · ${v.title}`))
    return m
  }, [versions])

  const load = useCallback(async () => {
    if (!cellId || status !== 'ready') return
    setLoading(true)
    setError(null)

    const rosterRes = await supabase
      .from('plan24_rosters')
      .select('id')
      .eq('master_cell_id', cellId)
      .eq('is_active', true)
      .maybeSingle()
    const rosterId = rosterRes.data?.id ?? null

    const [tplRes, verRes, taskRes, schRes, srRes, rrRes, shRes] = await Promise.all([
      supabase.from('plan24_check_templates').select('*').eq('master_cell_id', cellId).order('name'),
      supabase.from('plan24_check_template_versions').select('*').order('created_at', { ascending: false }),
      supabase.from('plan24_check_template_tasks').select('*'),
      supabase.from('plan24_check_schedules').select('*').eq('master_cell_id', cellId).order('created_at', { ascending: false }),
      supabase.from('plan24_check_schedule_roles').select('*'),
      rosterId
        ? supabase.from('plan24_roster_roles').select('id, roster_id, name, sort_order, is_active').eq('roster_id', rosterId)
        : Promise.resolve({ data: [], error: null }),
      rosterId
        ? supabase.from('plan24_roster_shifts').select('id, roster_id, kind, display_name, start_local, end_local, sort_order').eq('roster_id', rosterId)
        : Promise.resolve({ data: [], error: null }),
    ])

    setLoading(false)
    const firstErr =
      tplRes.error ?? verRes.error ?? taskRes.error ?? schRes.error ?? srRes.error ?? rrRes.error ?? shRes.error ?? rosterRes.error
    if (firstErr) {
      setError(firstErr.message)
      return
    }

    setTemplates((tplRes.data ?? []) as Plan24CheckTemplateRow[])
    setVersions((verRes.data ?? []) as Plan24CheckTemplateVersionRow[])
    setTasks((taskRes.data ?? []) as Plan24CheckTemplateTaskRow[])
    setSchedules((schRes.data ?? []) as Plan24CheckScheduleRow[])
    setScheduleRoles((srRes.data ?? []) as Plan24CheckScheduleRoleRow[])
    setRosterRoles(((rrRes as { data: unknown[] }).data ?? []) as Plan24RosterRoleRow[])
    setShifts(((shRes as { data: unknown[] }).data ?? []) as Plan24ShiftRow[])
  }, [cellId, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) setSelectedTemplateId(templates[0].id)
  }, [templates, selectedTemplateId])

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedVersionId(null)
      return
    }
    if (!selectedTemplateVersions.some((v) => v.id === selectedVersionId)) {
      setSelectedVersionId(selectedTemplateVersions[0]?.id ?? null)
    }
  }, [selectedTemplateId, selectedTemplateVersions, selectedVersionId])

  async function createTemplate() {
    if (!cellId || !templateName.trim()) return
    setTemplateSaving(true)
    setError(null)
    const insTpl = await supabase
      .from('plan24_check_templates')
      .insert({
        master_cell_id: cellId,
        name: templateName.trim(),
        description: templateDescription.trim() || null,
      })
      .select('id, name')
      .single()
    if (insTpl.error || !insTpl.data) {
      setTemplateSaving(false)
      setError(insTpl.error?.message ?? 'Could not create template.')
      return
    }
    const insV = await supabase.from('plan24_check_template_versions').insert({
      template_id: insTpl.data.id,
      version_no: 1,
      title: insTpl.data.name,
      notes: null,
      state: 'draft',
    })
    setTemplateSaving(false)
    if (insV.error) {
      setError(insV.error.message)
      return
    }
    setTemplateDialogOpen(false)
    setTemplateName('')
    setTemplateDescription('')
    await load()
    setSelectedTemplateId(insTpl.data.id)
    setChecksNav('templates')
    setTemplateEditorOpen(true)
  }

  async function copyTemplate(template: Plan24CheckTemplateRow) {
    if (!cellId) return
    setError(null)
    const sourceVersions = versions.filter((v) => v.template_id === template.id).sort((a, b) => b.version_no - a.version_no)
    const source = sourceVersions[0]
    if (!source) {
      setError('Template has no version to copy.')
      return
    }
    const sourceTasks = tasks.filter((t) => t.version_id === source.id).sort((a, b) => a.sort_order - b.sort_order)
    const copyName = `${template.name} copy`
    const insTpl = await supabase
      .from('plan24_check_templates')
      .insert({
        master_cell_id: cellId,
        name: copyName,
        description: template.description,
      })
      .select('id')
      .single()
    if (insTpl.error || !insTpl.data) {
      setError(insTpl.error?.message ?? 'Copy failed.')
      return
    }
    const insV = await supabase
      .from('plan24_check_template_versions')
      .insert({
        template_id: insTpl.data.id,
        version_no: 1,
        title: source.title,
        notes: source.notes,
        state: 'draft',
      })
      .select('id')
      .single()
    if (insV.error || !insV.data) {
      setError(insV.error?.message ?? 'Copy failed.')
      return
    }
    if (sourceTasks.length > 0) {
      const insTasks = await supabase.from('plan24_check_template_tasks').insert(
        sourceTasks.map((t) => ({
          version_id: insV.data.id,
          label: t.label,
          required: t.required,
          sort_order: t.sort_order,
        })),
      )
      if (insTasks.error) {
        setError(insTasks.error.message)
        return
      }
    }
    await load()
    setSelectedTemplateId(insTpl.data.id)
    setChecksNav('templates')
    setTemplateEditorOpen(true)
  }

  async function createVersion() {
    if (!selectedTemplateId || !versionTitle.trim()) return
    setVersionSaving(true)
    setError(null)
    const currentMax = selectedTemplateVersions[0]?.version_no ?? 0
    const ins = await supabase
      .from('plan24_check_template_versions')
      .insert({
        template_id: selectedTemplateId,
        version_no: currentMax + 1,
        title: versionTitle.trim(),
        notes: versionNotes.trim() || null,
        state: 'draft',
      })
      .select('id')
      .single()
    if (ins.error || !ins.data) {
      setVersionSaving(false)
      setError(ins.error?.message ?? 'Could not create version.')
      return
    }
    if (selectedVersionId) {
      const baseTasks = tasks.filter((t) => t.version_id === selectedVersionId).sort((a, b) => a.sort_order - b.sort_order)
      if (baseTasks.length > 0) {
        const copy = await supabase.from('plan24_check_template_tasks').insert(
          baseTasks.map((t) => ({
            version_id: ins.data.id,
            label: t.label,
            required: t.required,
            sort_order: t.sort_order,
          })),
        )
        if (copy.error) {
          setVersionSaving(false)
          setError(copy.error.message)
          return
        }
      }
    }
    setVersionSaving(false)
    setVersionTitle('')
    setVersionNotes('')
    await load()
    setSelectedVersionId(ins.data.id)
  }

  async function publishVersion(versionId: string) {
    setError(null)
    const res = await supabase.rpc('plan24_publish_template_version', { p_version_id: versionId })
    if (res.error) setError(res.error.message)
    else await load()
  }

  async function addTask() {
    if (!selectedVersionId || !taskLabel.trim()) return
    setTaskSaving(true)
    setError(null)
    const nextSort = selectedVersionTasks.length > 0 ? Math.max(...selectedVersionTasks.map((t) => t.sort_order)) + 1 : 0
    const res = await supabase.from('plan24_check_template_tasks').insert({
      version_id: selectedVersionId,
      label: taskLabel.trim(),
      required: taskRequired,
      sort_order: nextSort,
    })
    setTaskSaving(false)
    if (res.error) setError(res.error.message)
    else {
      setTaskLabel('')
      setTaskRequired(true)
      await load()
    }
  }

  async function updateTask(task: Plan24CheckTemplateTaskRow, patch: Partial<Pick<Plan24CheckTemplateTaskRow, 'label' | 'required'>>) {
    const res = await supabase.from('plan24_check_template_tasks').update(patch).eq('id', task.id)
    if (res.error) setError(res.error.message)
    else await load()
  }

  async function removeTask(taskId: string) {
    const res = await supabase.from('plan24_check_template_tasks').delete().eq('id', taskId)
    if (res.error) setError(res.error.message)
    else await load()
  }

  function openNewSchedule() {
    setChecksNav('schedules')
    const activeShift = shifts[0]?.kind ?? 'day'
    const initialVersion = selectedTemplateVersions[0] ?? versions[0]
    setScheduleDialog({
      id: null,
      name: '',
      templateId: initialVersion?.template_id ?? templates[0]?.id ?? '',
      templateVersionId: initialVersion?.id ?? '',
      shiftKind: activeShift,
      recurrenceKind: 'daily',
      intervalN: '1',
      weekdays: [],
      monthDay: '',
      startLocalTime: '06:00',
      hourlyUntilLocal: '',
      durationMinutes: '30',
      startsOn: localYMD(new Date()),
      endsOn: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      state: 'active',
      roleNames: [],
    })
  }

  function openEditSchedule(row: Plan24CheckScheduleRow) {
    setChecksNav('schedules')
    const roleNames = scheduleRoles.filter((r) => r.schedule_id === row.id).map((r) => r.role_name)
    setScheduleDialog({
      id: row.id,
      name: row.name,
      templateId: row.template_id,
      templateVersionId: row.template_version_id,
      shiftKind: row.shift_kind,
      recurrenceKind: row.recurrence_kind,
      intervalN: String(row.interval_n),
      weekdays: row.weekdays ?? [],
      monthDay: row.month_day ? String(row.month_day) : '',
      startLocalTime: (row.start_local_time || '').slice(0, 5),
      hourlyUntilLocal: (row.hourly_until_local || '').slice(0, 5),
      durationMinutes: String(row.duration_minutes),
      startsOn: row.starts_on,
      endsOn: row.ends_on ?? '',
      timezone: row.timezone || 'UTC',
      state: row.state,
      roleNames,
    })
  }

  async function saveSchedule() {
    if (!scheduleDialog || !cellId) return
    const intervalN = Number.parseInt(scheduleDialog.intervalN, 10)
    const durationMinutes = Number.parseInt(scheduleDialog.durationMinutes, 10)
    const monthDay = scheduleDialog.monthDay.trim() ? Number.parseInt(scheduleDialog.monthDay, 10) : null
    if (
      !scheduleDialog.name.trim() ||
      !scheduleDialog.templateId ||
      !scheduleDialog.templateVersionId ||
      !scheduleDialog.shiftKind ||
      !scheduleDialog.startsOn ||
      Number.isNaN(intervalN) ||
      intervalN <= 0 ||
      Number.isNaN(durationMinutes) ||
      durationMinutes <= 0
    ) {
      setError('Fill all required schedule fields.')
      return
    }
    setScheduleSaving(true)
    setError(null)
    const payload = {
      master_cell_id: cellId,
      template_id: scheduleDialog.templateId,
      template_version_id: scheduleDialog.templateVersionId,
      name: scheduleDialog.name.trim(),
      shift_kind: scheduleDialog.shiftKind,
      recurrence_kind: scheduleDialog.recurrenceKind,
      interval_n: intervalN,
      weekdays: scheduleDialog.weekdays,
      month_day: monthDay,
      start_local_time: scheduleDialog.startLocalTime,
      hourly_until_local: scheduleDialog.recurrenceKind === 'hourly' ? scheduleDialog.hourlyUntilLocal || null : null,
      duration_minutes: durationMinutes,
      starts_on: scheduleDialog.startsOn,
      ends_on: scheduleDialog.endsOn || null,
      timezone: scheduleDialog.timezone || 'UTC',
      state: scheduleDialog.state,
    }
    const q = scheduleDialog.id
      ? supabase.from('plan24_check_schedules').update(payload).eq('id', scheduleDialog.id).select('id').single()
      : supabase.from('plan24_check_schedules').insert(payload).select('id').single()
    const saved = await q
    if (saved.error || !saved.data) {
      setScheduleSaving(false)
      setError(saved.error?.message ?? 'Could not save schedule.')
      return
    }
    const scheduleId = saved.data.id as string

    const del = await supabase.from('plan24_check_schedule_roles').delete().eq('schedule_id', scheduleId)
    if (del.error) {
      setScheduleSaving(false)
      setError(del.error.message)
      return
    }
    if (scheduleDialog.roleNames.length > 0) {
      const insRoles = await supabase.from('plan24_check_schedule_roles').insert(
        scheduleDialog.roleNames.map((roleName) => ({
          schedule_id: scheduleId,
          role_name: roleName,
        })),
      )
      if (insRoles.error) {
        setScheduleSaving(false)
        setError(insRoles.error.message)
        return
      }
    }

    const today = localYMD(new Date())
    const reset = await supabase.rpc('plan24_reset_schedule_future_events', { p_schedule_id: scheduleId, p_from_date: today })
    if (reset.error) {
      setScheduleSaving(false)
      setError(reset.error.message)
      return
    }
    const to = new Date(today + 'T12:00:00')
    to.setDate(to.getDate() + 90)
    const materialize = await supabase.rpc('plan24_materialize_check_schedules', {
      p_master_cell_id: cellId,
      p_from_date: today,
      p_to_date: localYMD(to),
    })
    if (materialize.error) {
      setScheduleSaving(false)
      setError(materialize.error.message)
      return
    }

    setScheduleSaving(false)
    setScheduleDialog(null)
    await load()
  }

  async function setScheduleState(row: Plan24CheckScheduleRow, stateNext: 'active' | 'paused' | 'archived') {
    const res = await supabase.from('plan24_check_schedules').update({ state: stateNext }).eq('id', row.id)
    if (res.error) {
      setError(res.error.message)
      return
    }
    if (stateNext !== 'active') {
      const reset = await supabase.rpc('plan24_reset_schedule_future_events', {
        p_schedule_id: row.id,
        p_from_date: localYMD(new Date()),
      })
      if (reset.error) {
        setError(reset.error.message)
        return
      }
    }
    await load()
  }

  const activeSchedules = useMemo(() => schedules.filter((s) => s.state === 'active'), [schedules])
  const inactiveSchedules = useMemo(() => schedules.filter((s) => s.state !== 'active'), [schedules])

  if (status !== 'ready') {
    return <div className="text-sm text-muted">Loading scope…</div>
  }

  if (!cellId) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Select a <strong className="font-medium text-fg">cell</strong> in the scope bar to manage check templates and schedules.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

      <div
        className="inline-flex rounded-xl border border-border bg-surface-raised/50 p-1"
        role="tablist"
        aria-label="Checks admin sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={checksNav === 'templates'}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            checksNav === 'templates' ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
          onClick={() => setChecksNav('templates')}
        >
          <LayoutList className="size-4 shrink-0 opacity-70" aria-hidden />
          Check templates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={checksNav === 'schedules'}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            checksNav === 'schedules' ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
          onClick={() => setChecksNav('schedules')}
        >
          <CalendarClock className="size-4 shrink-0 opacity-70" aria-hidden />
          Schedules
        </button>
      </div>

      {checksNav === 'templates' ? (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Check templates</h2>
              <p className="mt-1 max-w-xl text-xs text-muted">
                Define reusable checks. Open a template to manage published/draft versions and sub-tasks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTemplateDialogOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus className="size-4" aria-hidden />
              New template
            </button>
          </div>

          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {templates.map((t) => {
              const vCount = versions.filter((v) => v.template_id === t.id).length
              return (
                <li key={t.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">{t.name}</p>
                    {t.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.description}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted/80">No description</p>
                    )}
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">{vCount} version{vCount === 1 ? '' : 's'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(t.id)
                      setTemplateEditorOpen(true)
                    }}
                    className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-border bg-surface-raised/60 px-3 py-2 text-sm font-semibold hover:bg-surface-raised sm:self-center"
                  >
                    <Pencil className="size-4 opacity-70" aria-hidden />
                    Edit template
                  </button>
                </li>
              )
            })}
          </ul>
          {templates.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{loading ? 'Loading…' : 'No templates yet. Create one to get started.'}</p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Recurring schedules</h2>
              <p className="mt-1 max-w-xl text-xs text-muted">
                Link a published template version to shifts and recurrence. Plan 24 fills the grid from active schedules.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewSchedule}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus className="size-4" aria-hidden />
              New schedule
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {activeSchedules.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-surface-raised/25 px-3 py-2.5 sm:flex sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-fg hover:underline"
                      onClick={() => openEditSchedule(s)}
                    >
                      {s.name}
                    </button>
                    <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:text-emerald-200">
                      Active
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {templateLabel.get(s.template_id) ?? 'Template'} · {versionLabel.get(s.template_version_id) ?? 'Version'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted/90">{summaryForSchedule(s)}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {s.shift_kind} · from {s.starts_on}
                    {s.ends_on ? ` · until ${s.ends_on}` : ''}
                  </p>
                </div>
                <div className="mt-2 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                    onClick={() => openEditSchedule(s)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                    onClick={() => void setScheduleState(s, 'paused')}
                  >
                    <Pause className="size-3.5" aria-hidden />
                    Pause
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-danger/35 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                    onClick={() => void setScheduleState(s, 'archived')}
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
            {activeSchedules.length === 0 ? <p className="text-sm text-muted">No active schedules.</p> : null}
          </div>

          <details className="group mt-5 rounded-xl border border-dashed border-border/80 bg-surface-raised/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-fg marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="text-muted group-open:text-fg">Paused & archived</span>
              <span className="inline-flex items-center gap-2">
                <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted">{inactiveSchedules.length}</span>
                <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2">
              {inactiveSchedules.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border bg-surface px-3 py-2 sm:flex sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="text-left text-sm font-medium hover:underline" onClick={() => openEditSchedule(s)}>
                        {s.name}
                      </button>
                      <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                        {s.state}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{summaryForSchedule(s)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
                    <button
                      type="button"
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-raised/70"
                      onClick={() => openEditSchedule(s)}
                    >
                      Edit
                    </button>
                    {s.state === 'paused' ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-raised/70"
                        onClick={() => void setScheduleState(s, 'active')}
                      >
                        <Play className="size-3.5" aria-hidden />
                        Resume
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {inactiveSchedules.length === 0 ? <p className="text-sm text-muted">None.</p> : null}
            </div>
          </details>
        </section>
      )}

      {templateDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-template-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTemplateDialogOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl">
            <h3 id="new-template-title" className="text-lg font-semibold">
              New template
            </h3>
            <label className="mt-3 block text-xs text-muted">
              Name
              <input className={inputClass} value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              Description
              <textarea className={textareaClass} value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={() => setTemplateDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createTemplate()}
                disabled={templateSaving}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {templateSaving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {templateEditorOpen && selectedTemplate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-editor-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTemplateEditorOpen(false)
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl">
            <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-surface px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 id="template-editor-title" className="text-lg font-semibold leading-tight">
                  {selectedTemplate.name}
                </h3>
                {selectedTemplate.description ? (
                  <p className="mt-1 text-xs text-muted">{selectedTemplate.description}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted/80">No description</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyTemplate(selectedTemplate)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-raised/70"
                >
                  <Copy className="size-3.5" aria-hidden />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-raised/70"
                  onClick={() => setTemplateEditorOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Versions</h4>
                <p className="mt-1 text-xs text-muted">Publish a version before it can run on a schedule. Drafts can be edited.</p>
                <div className="mt-2 space-y-2">
                  {selectedTemplateVersions.map((v) => (
                    <div
                      key={v.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        selectedVersionId === v.id ? 'border-accent/40 bg-accent-dim/30' : 'border-border'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          className="text-left font-medium hover:underline"
                          onClick={() => setSelectedVersionId(v.id)}
                        >
                          v{v.version_no} · {v.title}
                        </button>
                        <span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-surface-raised/80 text-muted ring-1 ring-border">
                          {v.state}
                        </span>
                      </div>
                      {v.state !== 'published' ? (
                        <button
                          type="button"
                          onClick={() => void publishVersion(v.id)}
                          className="mt-2 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
                        >
                          Publish version
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-muted">
                    New version title
                    <input className={inputClass} value={versionTitle} onChange={(e) => setVersionTitle(e.target.value)} />
                  </label>
                  <label className="text-xs text-muted">
                    Notes
                    <input className={inputClass} value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void createVersion()}
                  disabled={versionSaving || !selectedTemplateId}
                  className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-raised/60 disabled:opacity-50"
                >
                  {versionSaving ? 'Creating…' : 'Create next version'}
                </button>
              </section>

              {selectedVersion ? (
                <section className="rounded-xl border border-border bg-surface-raised/25 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Sub-tasks</h4>
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-medium text-fg">{selectedVersion.title}</span> — checklist items on the Plan grid.
                  </p>
                  <div className="mt-3 space-y-2">
                    {selectedVersionTasks.map((t) => (
                      <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
                        <input
                          className="h-8 min-w-0 flex-1 rounded border border-border px-2 text-sm"
                          value={t.label}
                          onChange={(e) => void updateTask(t, { label: e.target.value })}
                        />
                        <label className="inline-flex items-center gap-1 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={t.required}
                            onChange={(e) => void updateTask(t, { required: e.target.checked })}
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          className="rounded p-1 text-danger hover:bg-danger/10"
                          onClick={() => void removeTask(t.id)}
                          aria-label={`Remove task ${t.label}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border px-2 text-sm"
                      value={taskLabel}
                      onChange={(e) => setTaskLabel(e.target.value)}
                      placeholder="New task label"
                    />
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <label className="inline-flex items-center gap-1 text-xs text-muted">
                        <input type="checkbox" checked={taskRequired} onChange={(e) => setTaskRequired(e.target.checked)} />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => void addTask()}
                        disabled={taskSaving}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Add task
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {scheduleDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setScheduleDialog(null)
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{scheduleDialog.id ? 'Edit schedule' : 'New schedule'}</h3>
            <p className="mt-1 text-xs text-muted">
              {scheduleDialog.id ? 'Update when the check runs and which template version is used.' : 'Choose template version, shift, and recurrence.'}
            </p>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Basics</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted">
                Schedule name
                <input
                  className={inputClass}
                  value={scheduleDialog.name}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, name: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted">
                Shift
                <select
                  className={inputClass}
                  value={scheduleDialog.shiftKind}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, shiftKind: e.target.value })}
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.kind}>
                      {(s.display_name?.trim() || s.kind).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Template
                <select
                  className={inputClass}
                  value={scheduleDialog.templateId}
                  onChange={(e) =>
                    setScheduleDialog({
                      ...scheduleDialog,
                      templateId: e.target.value,
                      templateVersionId:
                        versions
                          .filter((v) => v.template_id === e.target.value)
                          .sort((a, b) => b.version_no - a.version_no)[0]?.id ?? '',
                    })
                  }
                >
                  <option value="">— Select —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Version
                <select
                  className={inputClass}
                  value={scheduleDialog.templateVersionId}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, templateVersionId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {versions
                    .filter((v) => v.template_id === scheduleDialog.templateId)
                    .sort((a, b) => b.version_no - a.version_no)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version_no} · {v.title} ({v.state})
                      </option>
                    ))}
                </select>
              </label>

              <div className="sm:col-span-2 mt-1 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Timing & recurrence</p>
              </div>

              <label className="text-xs text-muted">
                Recurrence
                <select
                  className={inputClass}
                  value={scheduleDialog.recurrenceKind}
                  onChange={(e) =>
                    setScheduleDialog({
                      ...scheduleDialog,
                      recurrenceKind: e.target.value as ScheduleDraft['recurrenceKind'],
                    })
                  }
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="text-xs text-muted">
                Every N
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={scheduleDialog.intervalN}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, intervalN: e.target.value })}
                />
              </label>

              <label className="text-xs text-muted">
                Start time
                <input
                  className={inputClass}
                  type="time"
                  value={scheduleDialog.startLocalTime}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, startLocalTime: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted">
                Duration (minutes)
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={scheduleDialog.durationMinutes}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, durationMinutes: e.target.value })}
                />
              </label>

              {scheduleDialog.recurrenceKind === 'hourly' ? (
                <label className="text-xs text-muted">
                  Hourly until (optional)
                  <input
                    className={inputClass}
                    type="time"
                    value={scheduleDialog.hourlyUntilLocal}
                    onChange={(e) => setScheduleDialog({ ...scheduleDialog, hourlyUntilLocal: e.target.value })}
                  />
                </label>
              ) : null}

              {scheduleDialog.recurrenceKind === 'monthly' ? (
                <label className="text-xs text-muted">
                  Day of month (optional)
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={31}
                    value={scheduleDialog.monthDay}
                    onChange={(e) => setScheduleDialog({ ...scheduleDialog, monthDay: e.target.value })}
                  />
                </label>
              ) : null}

              <label className="text-xs text-muted">
                Starts on
                <input
                  className={inputClass}
                  type="date"
                  value={scheduleDialog.startsOn}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, startsOn: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted">
                Ends on (optional)
                <input
                  className={inputClass}
                  type="date"
                  value={scheduleDialog.endsOn}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, endsOn: e.target.value })}
                />
              </label>
              <label className="text-xs text-muted sm:col-span-2">
                Timezone
                <input
                  className={inputClass}
                  value={scheduleDialog.timezone}
                  onChange={(e) => setScheduleDialog({ ...scheduleDialog, timezone: e.target.value })}
                />
              </label>
            </div>

            {(scheduleDialog.recurrenceKind === 'weekly' || scheduleDialog.recurrenceKind === 'hourly') ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted">Weekdays (optional)</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {weekdayOptions.map((w) => {
                    const on = scheduleDialog.weekdays.includes(w.value)
                    return (
                      <label key={w.value} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...scheduleDialog.weekdays, w.value]
                              : scheduleDialog.weekdays.filter((d) => d !== w.value)
                            setScheduleDialog({ ...scheduleDialog, weekdays: next.sort((a, b) => a - b) })
                          }}
                        />
                        {w.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Roles on the plan</p>
              <p className="mt-1 text-xs text-muted">Leave empty to place checks in the Unassigned panel only.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rosterRoles
                  .filter((r) => r.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((r) => {
                    const on = scheduleDialog.roleNames.includes(r.name)
                    return (
                      <label key={r.id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...scheduleDialog.roleNames, r.name]
                              : scheduleDialog.roleNames.filter((n) => n !== r.name)
                            setScheduleDialog({ ...scheduleDialog, roleNames: next })
                          }}
                        />
                        {r.name}
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={() => setScheduleDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void saveSchedule()}
                disabled={scheduleSaving}
              >
                {scheduleSaving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function summaryForSchedule(s: Plan24CheckScheduleRow): string {
  if (s.recurrence_kind === 'hourly') {
    const dayPart = (s.weekdays ?? []).length > 0 ? ` on ${weekdayLabel(s.weekdays)}` : ''
    return `Every ${s.interval_n}h from ${sliceTime(s.start_local_time)}${s.hourly_until_local ? ` to ${sliceTime(s.hourly_until_local)}` : ''}${dayPart}`
  }
  if (s.recurrence_kind === 'daily') return `Every ${s.interval_n} day(s) at ${sliceTime(s.start_local_time)}`
  if (s.recurrence_kind === 'weekly') {
    const days = (s.weekdays ?? []).length > 0 ? weekdayLabel(s.weekdays) : 'schedule weekdays'
    return `Every ${s.interval_n} week(s) on ${days} at ${sliceTime(s.start_local_time)}`
  }
  return `Every ${s.interval_n} month(s)${s.month_day ? ` on day ${s.month_day}` : ''} at ${sliceTime(s.start_local_time)}`
}

function sliceTime(v: string | null): string {
  return (v || '').slice(0, 5)
}

function weekdayLabel(days: number[]): string {
  const labels = weekdayOptions
    .filter((w) => days.includes(w.value))
    .map((w) => w.label)
  return labels.length > 0 ? labels.join(', ') : 'all days'
}
