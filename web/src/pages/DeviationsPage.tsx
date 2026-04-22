import { DhDefectHandlingPage } from './DhDefectHandlingPage'

export function DeviationsPage() {
  return (
    <DhDefectHandlingPage
      config={{
        title: 'Deviations',
        intro: 'Main deviations board for the selected cell. Type catalogue is configurable only by super admin in RTT Admin.',
        issueTable: 'deviations',
        typeTable: 'deviation_types',
        itemLabel: 'deviation',
        itemLabelPlural: 'deviations',
      }}
    />
  )
}
