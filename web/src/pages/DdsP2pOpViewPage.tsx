import { useEffect, useMemo, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import { useShiftDdsShell } from '../features/dds/ShiftDdsShellContext'
import {
  DdsP2pOpViewBody,
  type DdsP2pOpViewBodyHandle,
} from '../features/dds/DdsP2pOpViewBody'
import { DdsTriggerScoreTilesRow } from '../features/dds/DdsTriggerScoreTilesRow'
import { loadP2pOpViewRoleId, saveP2pOpViewRoleId } from '../features/dds/ddsP2pOpViewRolePrefs'
import { ddsErr, ddsHint, ddsSection, ddsSelect } from '../features/dds/ddsAdminCompactClasses'

export function DdsP2pOpViewPage() {
  const { status: scopeStatus, error: scopeError, cellId } = usePlan24Workspace()
  const { user } = useAuth()
  const { planDate, shiftKind, shifts, roles, shellLoading, rosterError } = useShiftDdsShell()
  const bodyRef = useRef<DdsP2pOpViewBodyHandle>(null)

  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const activeRoles = useMemo(() => roles.filter((r) => r.is_active), [roles])
  const selectedRole = useMemo(() => activeRoles.find((r) => r.id === roleId), [activeRoles, roleId])

  useEffect(() => {
    if (!cellId || activeRoles.length === 0) {
      setRoleId('')
      return
    }
    const stored = loadP2pOpViewRoleId(user?.id, cellId)
    setRoleId((prev) => {
      if (prev && activeRoles.some((r) => r.id === prev)) return prev
      if (stored && activeRoles.some((r) => r.id === stored)) return stored
      return activeRoles[0]?.id ?? ''
    })
  }, [activeRoles, cellId, user?.id])

  useEffect(() => {
    if (!user?.id || !cellId || !roleId) return
    saveP2pOpViewRoleId(user.id, cellId, roleId)
  }, [cellId, roleId, user?.id])

  if (scopeStatus === 'loading') {
    return (
      <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }
  if (scopeStatus === 'error') {
    return <p className={ddsErr}>{scopeError ?? 'Could not load scope.'}</p>
  }
  if (!cellId) {
    return <p className={ddsHint}>Select a cell in the scope bar to use P2P Op view.</p>
  }

  const err = rosterError ?? error

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <section className={`${ddsSection} flex min-h-0 flex-1 flex-col overflow-hidden !p-2 sm:!p-2.5`}>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/60 pb-1">
          <h1 className="mr-1 shrink-0 font-display text-base font-semibold tracking-tight">P2P Op view</h1>
          {shiftKind ? (
            <DdsTriggerScoreTilesRow
              cellId={cellId}
              planDate={planDate}
              shiftKind={shiftKind}
              shifts={shifts}
              compact
            />
          ) : null}
          <div className="min-w-[8rem]">
            <label className="text-[10px] font-medium text-muted">Role</label>
            <select
              className={`${ddsSelect} !mt-0 !h-7 min-w-[8rem]`}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={shellLoading || activeRoles.length === 0}
            >
              {activeRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-muted">
            Last 8 shifts ending at scope date/shift · use scope bar to change anchor
          </p>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:bg-black/[0.05] hover:text-fg disabled:opacity-40"
            aria-label="View preferences"
            title="View preferences"
            disabled={!user?.id || shellLoading || !roleId}
            onClick={() => bodyRef.current?.openPrefs()}
          >
            <Settings2 className="size-4" aria-hidden />
          </button>
        </div>

        {err ? <p className={`${ddsErr} shrink-0`}>{err}</p> : null}

        {shellLoading || !shiftKind ? (
          <p className="text-xs text-muted">{shellLoading ? 'Loading roster…' : 'Select a shift in the scope bar.'}</p>
        ) : (
          <DdsP2pOpViewBody
            ref={bodyRef}
            cellId={cellId}
            userId={user?.id}
            planDate={planDate}
            shiftKind={shiftKind}
            shifts={shifts}
            roleId={roleId}
            roleName={selectedRole?.name ?? ''}
            shellLoading={shellLoading}
            error={error}
            setError={setError}
            className="min-h-0"
          />
        )}
      </section>
    </div>
  )
}
