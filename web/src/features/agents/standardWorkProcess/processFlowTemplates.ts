import { SWP_COLUMN_WIDTH, migrateFlowToColumnLayout, slotPosition, snapY } from './flowLayout'
import { SWP_NODE_DEFAULT_SIZE } from './swpNodeDefaults'
import type { SwpFlowEdge, SwpFlowNode, SwpProcessFlow, SwpRoleKey } from './types'

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function n(
  id: string,
  kind: SwpFlowNode['kind'],
  label: string,
  roleKey: SwpRoleKey,
  ySlot: number,
  branch = 0,
): SwpFlowNode {
  return { id, kind, label, roleKey, position: slotPosition(roleKey, ySlot, SWP_COLUMN_WIDTH, kind, branch) }
}

function e(id: string, from: string, to: string, label?: string): SwpFlowEdge {
  return { id, from, to, label }
}

/** CL system — full swimlane example from product spec. */
export const CL_PROCESS_TEMPLATE: Omit<SwpProcessFlow, 'systemId'> = {
  subtitle: 'CL System Process Flow',
  nodes: [
    n('op-start', 'start', 'Start', 'operator', 0),
    n('op-due', 'task', 'CL task due / scheduled', 'operator', 1),
    n('op-prep', 'task', 'Prepare for CL check', 'operator', 2),
    n('op-check', 'task', 'Perform CL check', 'operator', 3),
    n('op-record', 'task', 'Record result', 'operator', 4),
    n('op-within', 'decision', 'Within standard?', 'operator', 5),
    n('op-complete', 'task', 'Complete CL', 'operator', 6, 0),
    n('op-raise', 'task', 'Raise deviation / abnormality', 'operator', 6, 1),
    n('tl-review-comp', 'task', 'Review completion', 'team-lead', 2),
    n('tl-closed', 'end', 'CL closed', 'team-lead', 3),
    n('tl-review-issue', 'task', 'Review issue and support correction', 'team-lead', 4),
    n('tl-corrected', 'decision', 'Corrected and back to standard?', 'team-lead', 5),
    n('tl-verify', 'task', 'Verify result', 'team-lead', 6, 0),
    n('tl-update', 'task', 'Update record', 'team-lead', 7, 0),
    n('tl-restored', 'end', 'CL restored and closed', 'team-lead', 8, 0),
    n('tl-send-cell', 'task', 'Send to Cell Team investigation', 'team-lead', 6, 1),
    n('ct-investigate', 'task', 'Investigate root cause', 'cell-team', 5),
    n('ct-define', 'task', 'Define corrective action', 'cell-team', 6),
    n('ct-support', 'decision', 'Need higher-level support?', 'cell-team', 7),
    n('ct-local', 'task', 'Implement local action', 'cell-team', 8, 0),
    n('ct-verify-eff', 'task', 'Verify effectiveness', 'cell-team', 9, 0),
    n('ct-resolved', 'end', 'Issue resolved and closed', 'cell-team', 10, 0),
    n('ct-send-pm', 'task', 'Send to Plant Manager', 'cell-team', 8, 1),
    n('pm-review', 'task', 'Review impact and priorities', 'plant-manager', 6),
    n('pm-site', 'decision', 'Site-wide / major support needed?', 'plant-manager', 7),
    n('pm-route', 'task', 'Route to technical support', 'plant-manager', 8, 0),
    n('pm-send-sm', 'task', 'Send to Site Manager', 'plant-manager', 8, 1),
    n('sm-approve', 'task', 'Approve escalation / resources', 'site-manager', 7),
    n('sp-tech', 'task', 'Provide technical support', 'support', 7, 0),
    n('sp-fix', 'task', 'Implement fix', 'support', 8, 0),
    n('sp-specialist', 'task', 'Provide specialist support', 'support', 7, 1),
    n('sp-review', 'task', 'Review closure', 'support', 8, 1),
    n('sp-restored', 'end', 'Standard restored', 'support', 9, 1),
  ],
  edges: [
    e('e1', 'op-start', 'op-due'),
    e('e2', 'op-due', 'op-prep'),
    e('e3', 'op-prep', 'op-check'),
    e('e4', 'op-check', 'op-record'),
    e('e5', 'op-record', 'op-within'),
    e('e6', 'op-within', 'op-complete', 'Yes'),
    e('e7', 'op-complete', 'tl-review-comp'),
    e('e8', 'tl-review-comp', 'tl-closed'),
    e('e9', 'op-within', 'op-raise', 'No'),
    e('e10', 'op-raise', 'tl-review-issue'),
    e('e11', 'tl-review-issue', 'tl-corrected'),
    e('e12', 'tl-corrected', 'tl-verify', 'Yes'),
    e('e13', 'tl-verify', 'tl-update'),
    e('e14', 'tl-update', 'tl-restored'),
    e('e15', 'tl-corrected', 'tl-send-cell', 'No'),
    e('e16', 'tl-send-cell', 'ct-investigate'),
    e('e17', 'ct-investigate', 'ct-define'),
    e('e18', 'ct-define', 'ct-support'),
    e('e19', 'ct-support', 'ct-local', 'No'),
    e('e20', 'ct-local', 'ct-verify-eff'),
    e('e21', 'ct-verify-eff', 'ct-resolved'),
    e('e22', 'ct-support', 'ct-send-pm', 'Yes'),
    e('e23', 'ct-send-pm', 'pm-review'),
    e('e24', 'pm-review', 'pm-site'),
    e('e25', 'pm-site', 'pm-route', 'No'),
    e('e26', 'pm-route', 'sp-tech'),
    e('e27', 'sp-tech', 'sp-fix'),
    e('e28', 'sp-fix', 'ct-verify-eff'),
    e('e29', 'pm-site', 'pm-send-sm', 'Yes'),
    e('e30', 'pm-send-sm', 'sm-approve'),
    e('e31', 'sm-approve', 'sp-specialist'),
    e('e32', 'sp-specialist', 'sp-review'),
    e('e33', 'sp-review', 'sp-restored'),
  ],
}

function compactFlow(
  systemId: string,
  systemName: string,
  steps: { roleKey: SwpRoleKey; label: string }[],
): SwpProcessFlow {
  const nodes: SwpFlowNode[] = [
    n('start', 'start', 'Start', steps[0].roleKey, 0),
    ...steps.map((s, i) => n(`step-${i}`, 'task', s.label, s.roleKey, i + 1)),
    n('end', 'end', 'Complete', steps[steps.length - 1].roleKey, steps.length + 1),
  ]
  const edges: SwpFlowEdge[] = []
  const ids = ['start', ...steps.map((_, i) => `step-${i}`), 'end']
  for (let i = 0; i < ids.length - 1; i++) {
    edges.push(e(`e-${i}`, ids[i], ids[i + 1]))
  }
  return {
    systemId,
    subtitle: `${systemName} standard work overview`,
    nodes,
    edges,
  }
}

export function buildFlowForSystem(systemId: string, systemName: string): SwpProcessFlow {
  const code = systemName.trim().toUpperCase()
  if (code === 'CL') return { systemId, ...CL_PROCESS_TEMPLATE }
  if (code === 'CIL') {
    return compactFlow(systemId, 'CIL', [
      { roleKey: 'operator', label: 'Perform CIL tasks' },
      { roleKey: 'operator', label: 'Record completion' },
      { roleKey: 'team-lead', label: 'Review exceptions' },
      { roleKey: 'cell-team', label: 'Close out actions' },
    ])
  }
  if (code === 'DH') {
    return compactFlow(systemId, 'DH', [
      { roleKey: 'operator', label: 'Identify defect' },
      { roleKey: 'operator', label: 'Contain & tag' },
      { roleKey: 'team-lead', label: 'Verify containment' },
      { roleKey: 'support', label: 'Disposition & restore' },
    ])
  }
  if (code === 'DDS') {
    return compactFlow(systemId, 'DDS', [
      { roleKey: 'team-lead', label: 'Prepare shift DDS' },
      { roleKey: 'operator', label: 'Review priorities' },
      { roleKey: 'plant-manager', label: 'Align plant actions' },
      { roleKey: 'site-manager', label: 'Escalate site gaps' },
    ])
  }
  return {
    systemId,
    subtitle: 'Standard work swimlane',
    nodes: [
      n('start', 'start', 'Start', 'operator', 0),
      n('task', 'task', 'Execute standard work', 'operator', 1),
      n('end', 'end', 'Complete', 'operator', 2),
    ],
    edges: [e('e1', 'start', 'task'), e('e2', 'task', 'end')],
  }
}

export function ensureWorkspaceFlows(
  systems: { id: string; name: string }[],
  flows: SwpProcessFlow[] | undefined,
): SwpProcessFlow[] {
  const bySystem = new Map((flows ?? []).map((f) => [f.systemId, f]))
  return systems.map((s) => {
    const existing = bySystem.get(s.id)
    if (existing?.nodes?.length) return migrateFlowToColumnLayout(existing)
    return buildFlowForSystem(s.id, s.name)
  })
}

export function defaultLabelForKind(kind: SwpFlowNode['kind']): string {
  switch (kind) {
    case 'start':
      return 'Start'
    case 'end':
      return 'End'
    case 'decision':
      return 'Decision?'
    default:
      return 'New task'
  }
}

export function createFlowNode(
  kind: SwpFlowNode['kind'],
  roleKey: SwpRoleKey,
  y: number,
  columnWidth: number,
): SwpFlowNode {
  const size = SWP_NODE_DEFAULT_SIZE[kind]
  return {
    id: newId('swp-n'),
    kind,
    label: defaultLabelForKind(kind),
    roleKey,
    position: { x: slotPosition(roleKey, 0, columnWidth, kind).x, y: snapY(y) },
    width: size.width,
    height: size.height,
  }
}
