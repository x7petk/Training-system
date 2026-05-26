import { nextColumnOrder } from './cascadeUtils'
import type { KpiCascadeForum, KpiCascadeKpi, KpiCascadeLevel, KpiCascadeRole } from './types'

function newId() {
  return `kc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function newRole(name: string): KpiCascadeRole {
  return { id: newId(), name: name.trim() || 'New role', description: '', active: true }
}

export function newForum(name: string, existing: KpiCascadeForum[] = []): KpiCascadeForum {
  return {
    id: newId(),
    name: name.trim() || 'New forum',
    description: '',
    active: true,
    columnOrder: nextColumnOrder(existing),
  }
}

export function newLevel(name: string, code?: string, existing: KpiCascadeLevel[] = []): KpiCascadeLevel {
  const trimmedCode = code?.trim()
  const codeNum = trimmedCode ? Number(trimmedCode) : NaN
  return {
    id: newId(),
    name: name.trim() || 'New level',
    code: trimmedCode || undefined,
    forumIds: [],
    active: true,
    columnOrder: Number.isFinite(codeNum) ? codeNum : nextColumnOrder(existing),
  }
}

export function newKpi(name: string, measure = ''): KpiCascadeKpi {
  return {
    id: newId(),
    name: name.trim() || 'New KPI',
    measure: measure.trim(),
    active: true,
  }
}
