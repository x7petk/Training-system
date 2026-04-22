import { DhDefectTypesAdminTab } from '../dh/DhDefectTypesAdminTab'

export function DeviationTypesAdminTab() {
  return (
    <DhDefectTypesAdminTab
      config={{
        title: 'Deviation types',
        description:
          'Super admin only. These labels appear when users create deviations. Inactive types stay hidden from operators but remain on existing records.',
        tableName: 'deviation_types',
        itemLabel: 'deviation type',
        itemLabelPlural: 'deviation types',
      }}
    />
  )
}
