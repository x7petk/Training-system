import type { SwpSystem } from './types'

function newId() {
  return `swp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function newSystem(name: string): SwpSystem {
  return {
    id: newId(),
    name: name.trim() || 'New system',
    description: '',
    active: true,
  }
}
