import { BmsBrainCatalogAdminTable } from '../features/bmsBrain/BmsBrainCatalogAdminTable'

export function BmsBrainAdminSystemsPage() {
  return <BmsBrainCatalogAdminTable kind="systems" title="Systems / tools" showIntegrations />
}
