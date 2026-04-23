import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, Copy, LayoutList, Pause, Play, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CIL_TASK_PHOTOS_BUCKET, cilTaskPhotoPublicUrl } from '../../lib/cilTaskPhotos'
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
  areaId: string
  equipmentId: string
  equipmentIds: string[]
}

type ChecksAdminConfig = {
  nounPlural: string
  createTemplateLabel: string
  createScheduleLabel: string
  accentClass: string
  scheduleAccentClass: string
  templatesTable: string
  versionsTable: string
  tasksTable: string
  schedulesTable: string
  scheduleRolesTable: string
  publishRpc: string
  resetRpc: string
  materializeRpc: string
  enableLocationTargets: boolean
}

const DEFAULT_CHECKS_CONFIG: ChecksAdminConfig = {
  nounPlural: 'Checks',
  createTemplateLabel: 'New template',
  createScheduleLabel: 'New schedule',
  accentClass: 'bg-violet-600',
  scheduleAccentClass: 'bg-teal-600',
  templatesTable: 'plan24_check_templates',
  versionsTable: 'plan24_check_template_versions',
  tasksTable: 'plan24_check_template_tasks',
  schedulesTable: 'plan24_check_schedules',
  scheduleRolesTable: 'plan24_check_schedule_roles',
  publishRpc: 'plan24_publish_template_version',
  resetRpc: 'plan24_reset_schedule_future_events',
  materializeRpc: 'plan24_materialize_check_schedules',
  enableLocationTargets: false,
}

type ClDataEntryKind = 'number' | 'range' | 'text'

function normalizeClTemplateInputKind(k: string | undefined | null): ClDataEntryKind {
  const x = String(k ?? 'number').toLowerCase()
  if (x === 'text') return 'text'
  if (x === 'range') return 'range'
  return 'number'
}

function buildTaskInsertRow(t: Plan24CheckTemplateTaskRow, versionId: string, tasksTable: string) {
  const base: Record<string, unknown> = {
    version_id: versionId,
    label: t.label,
    required: t.required,
    sort_order: t.sort_order,
  }
  if (tasksTable === 'plan24_cil_check_template_tasks') {
    base.standard_description = t.standard_description ?? null
    base.photo_path = t.photo_path ?? null
    base.recurrence_kind = t.recurrence_kind ?? 'daily'
    base.interval_n = t.interval_n ?? 1
    base.weekdays = Array.isArray(t.weekdays) ? t.weekdays : []
    base.month_day = t.month_day ?? null
    base.check_types = Array.isArray(t.check_types) && t.check_types.length ? t.check_types : []
    base.when_condition = t.when_condition ?? null
    return base
  }
  if (tasksTable === 'plan24_cl_check_template_tasks') {
    base.input_kind = normalizeClTemplateInputKind(t.input_kind)
    base.min_value = t.min_value ?? null
    base.max_value = t.max_value ?? null
    base.target_value = t.target_value ?? null
    base.standard_description = t.standard_description ?? null
    base.photo_path = t.photo_path ?? null
    return base
  }
  if (tasksTable === 'plan24_quality_check_template_tasks') {
    base.input_kind = 'pass_fail'
    base.min_value = null
    base.max_value = null
    base.target_value = null
    base.standard_description = t.standard_description ?? null
    base.photo_path = t.photo_path ?? null
    return base
  }
  return base
}

export function Plan24AdminChecksTab({ config = DEFAULT_CHECKS_CONFIG }: { config?: ChecksAdminConfig }) {
  const { cellId, status } = usePlan24Workspace()
  const isCilRouteTasks = config.tasksTable === 'plan24_cil_check_template_tasks'
  const isClTasks = config.tasksTable === 'plan24_cl_check_template_tasks'
  const isQualityTasks = config.tasksTable === 'plan24_quality_check_template_tasks'
  const isMeasuredFamilyTasks = isClTasks || isQualityTasks
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [templates, setTemplates] = useState<Plan24CheckTemplateRow[]>([])
  const [versions, setVersions] = useState<Plan24CheckTemplateVersionRow[]>([])
  const [tasks, setTasks] = useState<Plan24CheckTemplateTaskRow[]>([])
  const [schedules, setSchedules] = useState<Plan24CheckScheduleRow[]>([])
  const [scheduleRoles, setScheduleRoles] = useState<Plan24CheckScheduleRoleRow[]>([])
  const [rosterRoles, setRosterRoles] = useState<Plan24RosterRoleRow[]>([])
  const [shifts, setShifts] = useState<Plan24ShiftRow[]>([])
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; area_id: string; name: string }[]>([])

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
  const [cilPhotoTaskId, setCilPhotoTaskId] = useState<string | null>(null)

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

    const [tplRes, verRes, taskRes, schRes, srRes, rrRes, shRes, areaRes, eqRes] = await Promise.all([
      supabase.from(config.templatesTable).select('*').eq('master_cell_id', cellId).order('name'),
      supabase.from(config.versionsTable).select('*').order('created_at', { ascending: false }),
      supabase.from(config.tasksTable).select('*'),
      supabase.from(config.schedulesTable).select('*').eq('master_cell_id', cellId).order('created_at', { ascending: false }),
      supabase.from(config.scheduleRolesTable).select('*'),
      rosterId
        ? supabase.from('plan24_roster_roles').select('id, roster_id, name, sort_order, is_active').eq('roster_id', rosterId)
        : Promise.resolve({ data: [], error: null }),
      rosterId
        ? supabase.from('plan24_roster_shifts').select('id, roster_id, kind, display_name, start_local, end_local, sort_order').eq('roster_id', rosterId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('master_areas').select('id, name').eq('cell_id', cellId).order('sort_order').order('name'),
      supabase.from('master_equipment').select('id, area_id, name').order('sort_order').order('name'),
    ])

    setLoading(false)
    const firstErr =
      tplRes.error ?? verRes.error ?? taskRes.error ?? schRes.error ?? srRes.error ?? rrRes.error ?? shRes.error ?? areaRes.error ?? eqRes.error ?? rosterRes.error
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
    setAreas((areaRes.data ?? []) as { id: string; name: string }[])
    setEquipment((eqRes.data ?? []) as { id: string; area_id: string; name: string }[])
  }, [cellId, status, config])

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
      .from(config.templatesTable)
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
    const insV = await supabase.from(config.versionsTable).insert({
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
      .from(config.templatesTable)
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
      .from(config.versionsTable)
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
      const insTasks = await supabase.from(config.tasksTable).insert(
        sourceTasks.map((t) => buildTaskInsertRow(t, insV.data.id as string, config.tasksTable)),
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
      .from(config.versionsTable)
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
        const copy = await supabase.from(config.tasksTable).insert(
          baseTasks.map((t) => buildTaskInsertRow(t, ins.data.id as string, config.tasksTable)),
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
    const res = await supabase.rpc(config.publishRpc, { p_version_id: versionId })
    if (res.error) setError(res.error.message)
    else await load()
  }

  async function addTask() {
    if (!selectedVersionId || !taskLabel.trim()) return
    setTaskSaving(true)
    setError(null)
    const nextSort = selectedVersionTasks.length > 0 ? Math.max(...selectedVersionTasks.map((t) => t.sort_order)) + 1 : 0
    const insertRow: Record<string, unknown> = {
      version_id: selectedVersionId,
      label: taskLabel.trim(),
      required: taskRequired,
      sort_order: nextSort,
    }
    if (isCilRouteTasks) {
      insertRow.recurrence_kind = 'daily'
      insertRow.interval_n = 1
      insertRow.weekdays = []
      insertRow.check_types = []
    }
    if (isClTasks) {
      insertRow.input_kind = 'number'
      insertRow.min_value = null
      insertRow.max_value = null
      insertRow.target_value = null
    }
    if (isQualityTasks) {
      insertRow.input_kind = 'pass_fail'
      insertRow.min_value = null
      insertRow.max_value = null
      insertRow.target_value = null
    }
    const res = await supabase.from(config.tasksTable).insert(insertRow)
    setTaskSaving(false)
    if (res.error) setError(res.error.message)
    else {
      setTaskLabel('')
      setTaskRequired(true)
      await load()
    }
  }

  async function updateTask(
    task: Plan24CheckTemplateTaskRow,
    patch: Partial<
      Pick<
        Plan24CheckTemplateTaskRow,
        | 'label'
        | 'required'
        | 'standard_description'
        | 'photo_path'
        | 'recurrence_kind'
        | 'interval_n'
        | 'weekdays'
        | 'month_day'
        | 'check_types'
        | 'when_condition'
        | 'input_kind'
        | 'min_value'
        | 'max_value'
        | 'target_value'
      >
    >,
  ) {
    const res = await supabase.from(config.tasksTable).update(patch).eq('id', task.id)
    if (res.error) setError(res.error.message)
    else await load()
  }

  async function uploadCilTaskPhoto(task: Plan24CheckTemplateTaskRow, file: File) {
    if (!cellId) {
      setError('Cell scope missing.')
      return
    }
    setCilPhotoTaskId(task.id)
    setError(null)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${cellId}/${task.id}/${crypto.randomUUID()}-${safe}`
    const { error: upErr } = await supabase.storage.from(CIL_TASK_PHOTOS_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (upErr) {
      setCilPhotoTaskId(null)
      setError(upErr.message)
      return
    }
    const res = await supabase.from(config.tasksTable).update({ photo_path: path }).eq('id', task.id)
    setCilPhotoTaskId(null)
    if (res.error) setError(res.error.message)
    else await load()
  }

  async function removeTask(taskId: string) {
    const res = await supabase.from(config.tasksTable).delete().eq('id', taskId)
    if (res.error) setError(res.error.message)
    else await load()
  }

  function toggleCilWeekday(task: Plan24CheckTemplateTaskRow, day: number) {
    const cur = task.weekdays ?? []
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort((a, b) => a - b)
    void updateTask(task, { weekdays: next })
  }

  function toggleCilCheckType(task: Plan24CheckTemplateTaskRow, tag: 'cleaning' | 'inspection' | 'lubrication') {
    const cur = task.check_types ?? []
    const next = cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]
    void updateTask(task, { check_types: next })
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
      areaId: '',
      equipmentId: '',
      equipmentIds: [],
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
      areaId: (row as { area_id?: string | null }).area_id ?? '',
      equipmentId: (row as { equipment_id?: string | null }).equipment_id ?? '',
      equipmentIds: ((row as { equipment_ids?: string[] | null }).equipment_ids ?? []) as string[],
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
      area_id: config.enableLocationTargets ? scheduleDialog.areaId || null : null,
      equipment_id: config.enableLocationTargets ? scheduleDialog.equipmentId || null : null,
      equipment_ids: config.enableLocationTargets ? scheduleDialog.equipmentIds : [],
    }
    const q = scheduleDialog.id
      ? supabase.from(config.schedulesTable).update(payload).eq('id', scheduleDialog.id).select('id').single()
      : supabase.from(config.schedulesTable).insert(payload).select('id').single()
    const saved = await q
    if (saved.error || !saved.data) {
      setScheduleSaving(false)
      setError(saved.error?.message ?? 'Could not save schedule.')
      return
    }
    const scheduleId = saved.data.id as string

    const del = await supabase.from(config.scheduleRolesTable).delete().eq('schedule_id', scheduleId)
    if (del.error) {
      setScheduleSaving(false)
      setError(del.error.message)
      return
    }
    if (scheduleDialog.roleNames.length > 0) {
      const insRoles = await supabase.from(config.scheduleRolesTable).insert(
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
    const reset = await supabase.rpc(config.resetRpc, { p_schedule_id: scheduleId, p_from_date: today })
    if (reset.error) {
      setScheduleSaving(false)
      setError(reset.error.message)
      return
    }
    const to = new Date(today + 'T12:00:00')
    to.setDate(to.getDate() + 90)
    const materialize = await supabase.rpc(config.materializeRpc, {
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
    const res = await supabase.from(config.schedulesTable).update({ state: stateNext }).eq('id', row.id)
    if (res.error) {
      setError(res.error.message)
      return
    }
    if (stateNext !== 'active') {
      const reset = await supabase.rpc(config.resetRpc, {
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
          {config.nounPlural} templates
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
              <h2 className="text-base font-semibold tracking-tight">{config.nounPlural} templates</h2>
              <p className="mt-1 max-w-xl text-xs text-muted">
                Define reusable checks. Open a template to manage published/draft versions and sub-tasks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTemplateDialogOpen(true)}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ${config.accentClass}`}
            >
              <Plus className="size-4" aria-hidden />
              {config.createTemplateLabel}
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
              <h2 className="text-base font-semibold tracking-tight">{config.nounPlural} schedules</h2>
              <p className="mt-1 max-w-xl text-xs text-muted">
                Link a published template version to shifts and recurrence. Plan 24 fills the grid from active schedules.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewSchedule}
              className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ${config.scheduleAccentClass}`}
            >
              <Plus className="size-4" aria-hidden />
              {config.createScheduleLabel}
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
            <h3 id="new-template-title" className="text-lg font-semibold">{config.createTemplateLabel}</h3>
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
                className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${config.accentClass}`}
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
                  <div className="mt-3 space-y-3">
                    {selectedVersionTasks.map((t) =>
                      isCilRouteTasks ? (
                        <div key={t.id} className="space-y-3 rounded-xl border border-teal-900/20 bg-teal-950/[0.03] p-3 dark:border-teal-800/25 dark:bg-teal-950/15">
                          <div className="flex flex-wrap items-start gap-2">
                            <input
                              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-sm"
                              value={t.label}
                              onChange={(e) => void updateTask(t, { label: e.target.value })}
                            />
                            <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
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
                          <label className="block text-xs text-muted">
                            Standard description
                            <textarea
                              key={`${t.id}-desc`}
                              className={textareaClass}
                              rows={4}
                              defaultValue={t.standard_description ?? ''}
                              onBlur={(e) => void updateTask(t, { standard_description: e.target.value.trim() || null })}
                            />
                          </label>
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium text-muted">Reference photo</p>
                              {cilTaskPhotoPublicUrl(t.photo_path) ? (
                                <img
                                  src={cilTaskPhotoPublicUrl(t.photo_path) ?? ''}
                                  alt=""
                                  className="size-20 rounded-lg border border-border object-cover"
                                />
                              ) : (
                                <div className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted">
                                  None
                                </div>
                              )}
                            </div>
                            <label className="text-xs text-muted">
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                className={inputClass}
                                disabled={cilPhotoTaskId === t.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  e.target.value = ''
                                  if (f) void uploadCilTaskPhoto(t, f)
                                }}
                              />
                            </label>
                            {t.photo_path ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-muted hover:text-fg"
                                onClick={() => void updateTask(t, { photo_path: null })}
                              >
                                Clear photo
                              </button>
                            ) : null}
                          </div>
                          <p className="text-[10px] leading-snug text-muted">
                            Reference photo is shown on the operator route card (new or re-materialized occurrences pick up changes).
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-xs text-muted">
                              Task recurrence
                              <select
                                className={inputClass}
                                value={t.recurrence_kind ?? 'daily'}
                                onChange={(e) =>
                                  void updateTask(t, {
                                    recurrence_kind: e.target.value as Plan24CheckTemplateTaskRow['recurrence_kind'],
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
                              Interval (every N)
                              <input
                                type="number"
                                min={1}
                                className={inputClass}
                                value={t.interval_n ?? 1}
                                onChange={(e) =>
                                  void updateTask(t, { interval_n: Math.max(1, Math.round(Number(e.target.value)) || 1) })
                                }
                              />
                            </label>
                          </div>
                          {(t.recurrence_kind ?? 'daily') === 'weekly' ? (
                            <div>
                              <p className="text-[11px] font-medium text-muted">Weekdays</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {weekdayOptions.map((d) => (
                                  <button
                                    key={d.value}
                                    type="button"
                                    onClick={() => toggleCilWeekday(t, d.value)}
                                    className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                      (t.weekdays ?? []).includes(d.value)
                                        ? 'border-teal-600 bg-teal-600/15 text-teal-950 dark:text-teal-100'
                                        : 'border-border text-muted hover:bg-surface-raised/60'
                                    }`}
                                  >
                                    {d.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {(t.recurrence_kind ?? 'daily') === 'monthly' ? (
                            <label className="text-xs text-muted">
                              Day of month (1–31)
                              <input
                                type="number"
                                min={1}
                                max={31}
                                className={inputClass}
                                value={t.month_day == null ? '' : String(t.month_day)}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  if (raw === '') {
                                    void updateTask(t, { month_day: null })
                                    return
                                  }
                                  const n = Math.min(31, Math.max(1, Math.round(Number(raw))))
                                  if (!Number.isFinite(n)) return
                                  void updateTask(t, { month_day: n })
                                }}
                              />
                            </label>
                          ) : null}
                          <div>
                            <p className="text-[11px] font-medium text-muted">Check types (per task)</p>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs">
                              {(
                                [
                                  ['cleaning', 'Cleaning'],
                                  ['inspection', 'Inspection'],
                                  ['lubrication', 'Lubrication'],
                                ] as const
                              ).map(([key, lab]) => (
                                <label key={key} className="inline-flex items-center gap-1.5 text-muted">
                                  <input
                                    type="checkbox"
                                    checked={(t.check_types ?? []).includes(key)}
                                    onChange={() => toggleCilCheckType(t, key)}
                                  />
                                  {lab}
                                </label>
                              ))}
                            </div>
                          </div>
                          <label className="block text-xs text-muted">
                            When (operator — read-only on route)
                            <select
                              className={inputClass}
                              value={t.when_condition ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                void updateTask(t, {
                                  when_condition:
                                    v === '' ? null : (v as NonNullable<Plan24CheckTemplateTaskRow['when_condition']>),
                                })
                              }}
                            >
                              <option value="">— Not set</option>
                              <option value="running">Running</option>
                              <option value="down">Down</option>
                              <option value="other">Other</option>
                            </select>
                          </label>
                        </div>
                      ) : isMeasuredFamilyTasks ? (
                        <div key={t.id} className="space-y-3 rounded-xl border border-border bg-surface-raised/30 p-3">
                          <div className="flex flex-wrap items-start gap-2">
                            <input
                              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-sm"
                              value={t.label}
                              onChange={(e) => void updateTask(t, { label: e.target.value })}
                            />
                            <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
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
                          <label className="block text-xs text-muted">
                            Standard (operator)
                            <textarea
                              key={`${t.id}-std`}
                              className={textareaClass}
                              rows={3}
                              defaultValue={t.standard_description ?? ''}
                              onBlur={(e) => void updateTask(t, { standard_description: e.target.value.trim() || null })}
                            />
                          </label>
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium text-muted">Reference photo</p>
                              {cilTaskPhotoPublicUrl(t.photo_path) ? (
                                <img
                                  src={cilTaskPhotoPublicUrl(t.photo_path) ?? ''}
                                  alt=""
                                  className="size-20 rounded-lg border border-border object-cover"
                                />
                              ) : (
                                <div className="flex size-20 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted">
                                  None
                                </div>
                              )}
                            </div>
                            <label className="text-xs text-muted">
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                className={inputClass}
                                disabled={cilPhotoTaskId === t.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  e.target.value = ''
                                  if (f) void uploadCilTaskPhoto(t, f)
                                }}
                              />
                            </label>
                            {t.photo_path ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-muted hover:text-fg"
                                onClick={() => void updateTask(t, { photo_path: null })}
                              >
                                Clear photo
                              </button>
                            ) : null}
                          </div>
                          {isQualityTasks ? (
                            <p className="text-xs text-muted">
                              Input is <span className="font-medium text-fg/80">Pass / Fail</span> only. Operators
                              record an outcome per step; there are no numeric limits on quality templates.
                            </p>
                          ) : (
                            <>
                              <label className="block text-xs text-muted">
                                Data entry type (CL)
                                <select
                                  className={inputClass}
                                  value={normalizeClTemplateInputKind(t.input_kind)}
                                  onChange={(e) =>
                                    void updateTask(t, {
                                      input_kind: e.target.value as ClDataEntryKind,
                                    })
                                  }
                                >
                                  <option value="number">Number (limits)</option>
                                  <option value="range">Range (same as number)</option>
                                  <option value="text">Text</option>
                                </select>
                              </label>
                              {normalizeClTemplateInputKind(t.input_kind) !== 'text' ? (
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <label className="text-xs text-muted">
                                    Target (nominal)
                                    <input
                                      type="number"
                                      step="any"
                                      className={inputClass}
                                      value={t.target_value == null ? '' : String(t.target_value)}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        void updateTask(t, { target_value: raw === '' ? null : Number(raw) })
                                      }}
                                    />
                                  </label>
                                  <label className="text-xs text-muted">
                                    Min
                                    <input
                                      type="number"
                                      step="any"
                                      className={inputClass}
                                      value={t.min_value == null ? '' : String(t.min_value)}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        void updateTask(t, { min_value: raw === '' ? null : Number(raw) })
                                      }}
                                    />
                                  </label>
                                  <label className="text-xs text-muted">
                                    Max
                                    <input
                                      type="number"
                                      step="any"
                                      className={inputClass}
                                      value={t.max_value == null ? '' : String(t.max_value)}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        void updateTask(t, { max_value: raw === '' ? null : Number(raw) })
                                      }}
                                    />
                                  </label>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : (
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
                      ),
                    )}
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
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${config.scheduleAccentClass}`}
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
            <h3 className="text-lg font-semibold">{scheduleDialog.id ? 'Edit schedule' : config.createScheduleLabel}</h3>
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

              {config.enableLocationTargets ? (
                <>
                  <div className="sm:col-span-2 mt-1 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Target scope</p>
                  </div>
                  <label className="text-xs text-muted">
                    Area
                    <select
                      className={inputClass}
                      value={scheduleDialog.areaId}
                      onChange={(e) =>
                        setScheduleDialog({
                          ...scheduleDialog,
                          areaId: e.target.value,
                          equipmentId:
                            scheduleDialog.equipmentId &&
                            equipment.find((eq) => eq.id === scheduleDialog.equipmentId && eq.area_id === e.target.value)
                              ? scheduleDialog.equipmentId
                              : '',
                          equipmentIds: scheduleDialog.equipmentIds.filter((id) =>
                            equipment.find((eq) => eq.id === id && eq.area_id === e.target.value),
                          ),
                        })
                      }
                    >
                      <option value="">All areas</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted">
                    Equipment
                    <select
                      className={inputClass}
                      value={scheduleDialog.equipmentId}
                      onChange={(e) => setScheduleDialog({ ...scheduleDialog, equipmentId: e.target.value })}
                    >
                      <option value="">All equipment</option>
                      {equipment
                        .filter((eq) => !scheduleDialog.areaId || eq.area_id === scheduleDialog.areaId)
                        .map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted sm:col-span-2">
                    Equipment set (multi-select)
                    <select
                      className={`${inputClass} h-auto min-h-28`}
                      multiple
                      value={scheduleDialog.equipmentIds}
                      onChange={(e) => {
                        const next = Array.from(e.target.selectedOptions).map((o) => o.value)
                        setScheduleDialog({ ...scheduleDialog, equipmentIds: next })
                      }}
                    >
                      {equipment
                        .filter((eq) => !scheduleDialog.areaId || eq.area_id === scheduleDialog.areaId)
                        .map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              ) : null}

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
                className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${config.scheduleAccentClass}`}
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
