import { BdeCatalogAdminSection } from '../features/bde/BdeCatalogAdminSection'

export function BdeAdminPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">BDE Admin</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Manage problem types and AODC code lists used when creating Breakdown Elimination records.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <BdeCatalogAdminSection
          title="Problem types"
          description="Shown on BDE create/edit and in reports."
          tableName="bde_problem_types"
          itemLabel="problem type"
        />
        <BdeCatalogAdminSection
          title="Activity codes (A)"
          description="First letter of AODC analytics."
          tableName="bde_activity_codes"
          itemLabel="activity code"
        />
        <BdeCatalogAdminSection
          title="Object part codes (O)"
          description="Second letter of AODC analytics."
          tableName="bde_object_part_codes"
          itemLabel="object part"
        />
        <BdeCatalogAdminSection
          title="Damage codes (D)"
          description="Third letter of AODC analytics."
          tableName="bde_damage_codes"
          itemLabel="damage code"
        />
        <BdeCatalogAdminSection
          title="Cause codes (C)"
          description="Fourth letter of AODC analytics."
          tableName="bde_cause_codes"
          itemLabel="cause code"
        />
      </div>
    </div>
  )
}
