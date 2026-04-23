import { Plan24AdminChecksTab } from './Plan24AdminChecksTab'

export function Plan24AdminClChecksTab() {
  return (
    <Plan24AdminChecksTab
      config={{
        nounPlural: 'CL checks',
        createTemplateLabel: 'New CL template',
        createScheduleLabel: 'New CL schedule',
        accentClass: 'bg-green-600',
        scheduleAccentClass: 'bg-green-600',
        templatesTable: 'plan24_cl_check_templates',
        versionsTable: 'plan24_cl_check_template_versions',
        tasksTable: 'plan24_cl_check_template_tasks',
        schedulesTable: 'plan24_cl_check_schedules',
        scheduleRolesTable: 'plan24_cl_check_schedule_roles',
        publishRpc: 'plan24_publish_cl_check_template_version',
        resetRpc: 'plan24_reset_cl_check_schedule_future_events',
        materializeRpc: 'plan24_materialize_cl_check_schedules',
        enableLocationTargets: true,
      }}
    />
  )
}
