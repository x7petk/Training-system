import { Plan24AdminChecksTab } from './Plan24AdminChecksTab'

export function Plan24AdminCilChecksTab() {
  return (
    <Plan24AdminChecksTab
      config={{
        nounPlural: 'CIL checks',
        createTemplateLabel: 'New CIL template',
        createScheduleLabel: 'New CIL schedule',
        accentClass: 'bg-teal-500',
        scheduleAccentClass: 'bg-teal-500',
        templatesTable: 'plan24_cil_check_templates',
        versionsTable: 'plan24_cil_check_template_versions',
        tasksTable: 'plan24_cil_check_template_tasks',
        schedulesTable: 'plan24_cil_check_schedules',
        scheduleRolesTable: 'plan24_cil_check_schedule_roles',
        publishRpc: 'plan24_publish_cil_check_template_version',
        resetRpc: 'plan24_reset_cil_check_schedule_future_events',
        materializeRpc: 'plan24_materialize_cil_check_schedules',
        enableLocationTargets: true,
      }}
    />
  )
}
