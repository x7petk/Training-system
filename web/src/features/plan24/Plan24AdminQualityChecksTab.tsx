import { Plan24AdminChecksTab } from './Plan24AdminChecksTab'

export function Plan24AdminQualityChecksTab() {
  return (
    <Plan24AdminChecksTab
      config={{
        nounPlural: 'Quality checks',
        createTemplateLabel: 'New quality template',
        createScheduleLabel: 'New quality schedule',
        accentClass: 'bg-violet-500',
        scheduleAccentClass: 'bg-violet-500',
        templatesTable: 'plan24_quality_check_templates',
        versionsTable: 'plan24_quality_check_template_versions',
        tasksTable: 'plan24_quality_check_template_tasks',
        schedulesTable: 'plan24_quality_check_schedules',
        scheduleRolesTable: 'plan24_quality_check_schedule_roles',
        publishRpc: 'plan24_publish_quality_check_template_version',
        resetRpc: 'plan24_reset_quality_check_schedule_future_events',
        materializeRpc: 'plan24_materialize_quality_check_schedules',
        enableLocationTargets: true,
      }}
    />
  )
}
