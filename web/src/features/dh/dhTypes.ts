export type DhDefectTypeRow = {
  id: string
  slug: string
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type DhDefectStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type DhDefectPriority = 'low' | 'medium' | 'high' | 'critical'

export type DhDefectRow = {
  id: string
  master_cell_id: string
  defect_type_id: string
  title: string
  description: string | null
  area: string | null
  equipment: string | null
  status: DhDefectStatus
  priority: DhDefectPriority
  location_summary: string | null
  owner_person_id: string | null
  created_by: string | null
  due_at: string | null
  resolved_at: string | null
  closed_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}
