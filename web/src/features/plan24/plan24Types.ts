/** Matches `plan24_roster_shifts.kind` (e.g. day, afternoon, night). */
export type Plan24ShiftKind = string

export type Plan24EventRow = {
  id: string
  master_cell_id: string
  roster_id: string | null
  schedule_id?: string | null
  template_version_id?: string | null
  /** Denormalized for CIL defect history when schedule_id is cleared (ad hoc). */
  cil_template_id?: string | null
  schedule_occurrence_at?: string | null
  schedule_role_name?: string
  area_id?: string | null
  equipment_id?: string | null
  equipment_ids?: string[]
  linked_issue_kind?: string | null
  linked_issue_id?: string | null
  linked_issue_created_at?: string | null
  plan_date: string
  shift_kind: string
  role_name: string | null
  title: string
  event_type: string
  source: 'scheduled' | 'ad_hoc'
  start_at: string
  end_at: string
  status: 'scheduled' | 'in_progress' | 'complete' | 'not_required'
  /** Free-text note for DDS actions (`event_type = dds_action`). */
  comment?: string | null
  sub_tasks: unknown
  opened_at: string | null
  completed_at: string | null
  completed_by: string | null
  assigned_person_id: string | null
  deleted_at: string | null
  delete_comment: string | null
  created_by: string | null
}

export type Plan24SubTask = {
  id: string
  label: string
  done: boolean
  required?: boolean
  /** Mirrors template: CL = number|range|text; Quality = pass_fail. */
  input_kind?: string
  min_value?: number | null
  max_value?: number | null
  /** Nominal target for CL numeric steps, optional. */
  target_value?: number | null
  standard_description?: string
  photo_path?: string
  check_types?: string[]
  when_condition?: 'running' | 'down' | 'other' | null
  /** Operator reading for number / range tasks. */
  entered_value?: number | null
  /** Quality: pass/fail outcome. CL numeric steps may set result when raising issues. */
  result?: 'pass' | 'fail' | null
  text_value?: string | null
}

export type Plan24RosterRoleRow = {
  id: string
  roster_id: string
  name: string
  sort_order: number
  is_active: boolean
  /** Legacy fallback when day/night defaults are null. */
  default_person_id: string | null
  default_person_day_id?: string | null
  default_person_night_id?: string | null
}

export type Plan24RosterRow = {
  id: string
  master_cell_id: string
  name: string
  sort_order: number
  is_active: boolean
  effective_from: string | null
  /** Present after roster migration; default 8 in UI when missing. */
  pattern_length?: number
  pattern_start_date?: string | null
}

export type Plan24TeamRow = {
  id: string
  roster_id: string
  name: string
  color: string
  sort_order: number
}

export type Plan24PatternSlotRow = {
  id: string
  roster_id: string
  pattern_day: number
  shift_kind: string
  team_id: string | null
}

export type Plan24RoleTeamDefaultRow = {
  id: string
  role_id: string
  team_id: string
  person_id: string | null
}

export type Plan24ShiftRow = {
  id: string
  roster_id: string
  kind: string
  display_name: string | null
  start_local: string
  end_local: string
  sort_order: number
}

export type Plan24RoleAssignmentRow = {
  roster_id: string
  plan_date: string
  shift_kind: string
  role_name: string
  person_id: string | null
}

export type Plan24TaskRow = {
  id: string
  master_cell_id: string
  role_name: string
  owner_id: string
  title: string
  done: boolean
  sort_order: number
}

export type Plan24CheckTemplateRow = {
  id: string
  master_cell_id: string
  name: string
  description: string | null
  created_at: string
}

export type Plan24CheckTemplateVersionRow = {
  id: string
  template_id: string
  version_no: number
  title: string
  notes: string | null
  state: 'draft' | 'published' | 'archived'
  created_at: string
}

export type Plan24CheckTemplateTaskRow = {
  id: string
  version_id: string
  label: string
  required: boolean
  sort_order: number
  /** CL: number | range | text. Quality: pass_fail only. */
  input_kind?: string
  min_value?: number | null
  max_value?: number | null
  /** CL optional nominal for numeric steps. */
  target_value?: number | null
  /** CL / Quality / CIL: long-form standard shown to operators. */
  standard_description?: string | null
  photo_path?: string | null
  recurrence_kind?: 'hourly' | 'daily' | 'weekly' | 'monthly'
  interval_n?: number
  weekdays?: number[] | null
  month_day?: number | null
  check_types?: string[] | null
  /** CIL: shown read-only on operator route (Running / Down / Other). */
  when_condition?: 'running' | 'down' | 'other' | null
}

export type Plan24CheckScheduleRow = {
  id: string
  master_cell_id: string
  template_id: string
  template_version_id: string
  name: string
  shift_kind: string
  recurrence_kind: 'hourly' | 'daily' | 'weekly' | 'monthly'
  interval_n: number
  weekdays: number[]
  month_day: number | null
  start_local_time: string
  hourly_until_local: string | null
  duration_minutes: number
  starts_on: string
  ends_on: string | null
  timezone: string
  state: 'active' | 'paused' | 'archived'
  created_at: string
}

export type Plan24CheckScheduleRoleRow = {
  id: string
  schedule_id: string
  role_name: string
}
