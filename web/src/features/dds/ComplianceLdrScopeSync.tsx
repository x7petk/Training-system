import { useEffect, useRef } from 'react'
import { useLdrWorkspace, type LdrScopeLevel } from '../ldr/LdrWorkspaceContext'

type Props = {
  scopeLevel: LdrScopeLevel
  siteId: string
  plantId: string
  cellId: string
}

/** Aligns LDR workspace scope with Plan 24 / compliance scope while the embed is mounted. */
export function ComplianceLdrScopeSync({ scopeLevel, siteId, plantId, cellId }: Props) {
  const ldr = useLdrWorkspace()
  const snapRef = useRef<{
    scopeLevel: LdrScopeLevel
    siteId: string
    plantId: string
    cellId: string
  } | null>(null)

  useEffect(() => {
    if (ldr.status !== 'ready' || !siteId) return

    snapRef.current = {
      scopeLevel: ldr.scopeLevel,
      siteId: ldr.siteId,
      plantId: ldr.plantId,
      cellId: ldr.cellId,
    }

    ldr.setScopeLevel(scopeLevel)
    ldr.setSiteId(siteId)
    if (scopeLevel === 'cell') {
      if (plantId) ldr.setPlantId(plantId)
      if (cellId) ldr.setCellId(cellId)
    } else {
      ldr.setPlantId('')
      ldr.setCellId('')
    }

    return () => {
      const snap = snapRef.current
      if (!snap) return
      ldr.setScopeLevel(snap.scopeLevel)
      ldr.setSiteId(snap.siteId)
      ldr.setPlantId(snap.plantId)
      ldr.setCellId(snap.cellId)
      snapRef.current = null
    }
  }, [
    ldr.status,
    ldr.scopeLevel,
    ldr.siteId,
    ldr.plantId,
    ldr.cellId,
    ldr.setScopeLevel,
    ldr.setSiteId,
    ldr.setPlantId,
    ldr.setCellId,
    scopeLevel,
    siteId,
    plantId,
    cellId,
  ])

  return null
}
