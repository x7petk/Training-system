import { useEffect, useMemo, useState } from 'react'
import type { KpiCascadeRole } from '../kpiCascade/types'
import { SwpFlowEditor } from './SwpFlowEditor'
import { buildFlowForSystem } from './processFlowTemplates'
import type { SwpProcessFlow, SwpSystem } from './types'

type Props = {
  systems: SwpSystem[]
  flows: SwpProcessFlow[]
  roles: KpiCascadeRole[]
  onFlowChange: (flow: SwpProcessFlow) => void
}

export function SwpProcessTab({ systems, flows, roles, onFlowChange }: Props) {
  const activeSystems = useMemo(() => systems.filter((system) => system.active), [systems])
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(
    activeSystems[0]?.id ?? null,
  )
  useEffect(() => {
    if (!activeSystems.length) {
      setSelectedSystemId(null)
      return
    }
    if (!selectedSystemId || !activeSystems.some((system) => system.id === selectedSystemId)) {
      setSelectedSystemId(activeSystems[0].id)
    }
  }, [activeSystems, selectedSystemId])

  const selectedSystem = activeSystems.find((system) => system.id === selectedSystemId) ?? null
  const selectedFlow = selectedSystem
    ? (flows.find((flow) => flow.systemId === selectedSystem.id) ??
      buildFlowForSystem(selectedSystem.id, selectedSystem.name))
    : null

  if (!activeSystems.length) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised/40 p-6 text-sm text-muted">
        Add or activate a system in Admin to start building standard work flows.
      </div>
    )
  }

  if (!selectedSystem || !selectedFlow) return null

  return (
    <div className="flex w-full flex-col overflow-visible rounded-xl border border-border bg-slate-50 shadow-sm">
      <SwpFlowEditor
        key={selectedSystem.id}
        systemName={selectedSystem.name}
        flow={selectedFlow}
        roles={roles}
        systems={systems}
        selectedSystemId={selectedSystemId}
        onSelectSystem={setSelectedSystemId}
        onFlowChange={onFlowChange}
      />
    </div>
  )
}
