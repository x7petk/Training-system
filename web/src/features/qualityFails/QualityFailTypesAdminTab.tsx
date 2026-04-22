import { DhDefectTypesAdminTab } from '../dh/DhDefectTypesAdminTab'

export function QualityFailTypesAdminTab() {
  return (
    <DhDefectTypesAdminTab
      config={{
        title: 'Quality fail types',
        description:
          'Super admin only. These labels appear when users create quality fails. Inactive types stay hidden from operators but remain on existing records.',
        tableName: 'quality_fail_types',
        itemLabel: 'quality fail type',
        itemLabelPlural: 'quality fail types',
      }}
    />
  )
}
