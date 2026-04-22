import { DhDefectHandlingPage } from './DhDefectHandlingPage'

export function QualityFailsPage() {
  return (
    <DhDefectHandlingPage
      config={{
        title: 'Quality Fails',
        intro: 'Main quality fails board for the selected cell. Type catalogue is configurable only by super admin in RTT Admin.',
        issueTable: 'quality_fails',
        typeTable: 'quality_fail_types',
        itemLabel: 'quality fail',
        itemLabelPlural: 'quality fails',
      }}
    />
  )
}
