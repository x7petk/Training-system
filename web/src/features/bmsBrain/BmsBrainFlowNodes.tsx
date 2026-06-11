/* eslint-disable react-refresh/only-export-components -- XYFlow expects this module to export the node type registry. */
import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import {
  bmsBlockAccentClass,
  bmsBlockClass,
  bmsBlockInteractiveClass,
  bmsBlockKindLabel,
  bmsBlockRadiusClass,
  bmsBlockShape,
  bmsBlockSoftBadgeClass,
} from './bmsBlockStyles'
import type { BmsCatalogRow, BmsNodeKind } from './types'

export type BmsFlowNodeData = {
  label: string
  kind: BmsNodeKind
  systemIds: string[]
  systems: BmsCatalogRow[]
  roleId: string | null
  forumId: string | null
  role: BmsCatalogRow | null
  forum: BmsCatalogRow | null
}

function RoleForumBadges({ role, forum }: { role: BmsCatalogRow | null; forum: BmsCatalogRow | null }) {
  if (!role && !forum) {
    return (
      <div className="mt-1 text-[9px] font-medium text-amber-700 dark:text-amber-300">Set role &amp; forum</div>
    )
  }
  return (
    <div className="mt-1 flex min-w-0 flex-wrap justify-center gap-0.5">
      {role ? (
        <span
          className="max-w-full truncate rounded-full border px-1.5 py-px text-[9px] font-semibold leading-none"
          style={{ color: role.color, borderColor: `${role.color}44`, backgroundColor: `${role.color}14` }}
          title={`Role: ${role.name}`}
        >
          {role.name}
        </span>
      ) : (
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold text-amber-800 dark:text-amber-200">
          No role
        </span>
      )}
      {forum ? (
        <span
          className="max-w-full truncate rounded-full border px-1.5 py-px text-[9px] font-semibold leading-none"
          style={{ color: forum.color, borderColor: `${forum.color}44`, backgroundColor: `${forum.color}14` }}
          title={`Forum: ${forum.name}`}
        >
          {forum.name}
        </span>
      ) : (
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold text-amber-800 dark:text-amber-200">
          No forum
        </span>
      )}
    </div>
  )
}

function FlowNodeChrome({
  kind,
  label,
  role,
  forum,
  selected,
  children,
}: {
  kind: BmsNodeKind
  label: string
  role: BmsCatalogRow | null
  forum: BmsCatalogRow | null
  selected?: boolean
  children?: React.ReactNode
}) {
  if (bmsBlockShape(kind) === 'diamond') {
    return (
      <div className="relative flex size-[132px] items-center justify-center">
        <div
          className={[
            'absolute inset-0 rotate-45 rounded-sm border-2 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_10px_24px_rgba(245,158,11,0.16)]',
            bmsBlockClass[kind],
            selected ? 'ring-2 ring-accent ring-offset-2' : '',
          ].join(' ')}
        />
        <div className="relative z-10 max-w-[6.5rem] px-1 text-center">
          <div className="text-[11px] font-semibold leading-tight tracking-[-0.01em]">{label}</div>
          <RoleForumBadges role={role} forum={forum} />
        </div>
        {children}
      </div>
    )
  }

  const isTerminal = kind === 'start' || kind === 'end'

  return (
    <div
      className={[
        'relative overflow-hidden border-2 px-3 py-2 text-xs transition',
        bmsBlockClass[kind],
        bmsBlockRadiusClass(kind),
        bmsBlockInteractiveClass,
        isTerminal ? 'min-w-[8.5rem] max-w-[220px] text-center' : 'min-w-[150px] max-w-[200px]',
        selected ? 'ring-2 ring-accent ring-offset-2' : '',
      ].join(' ')}
    >
      <span
        className={[
          'absolute opacity-75',
          isTerminal ? 'inset-x-6 top-0 h-0.5' : 'inset-y-0 left-0 w-1',
          bmsBlockAccentClass[kind],
        ].join(' ')}
        aria-hidden
      />
      <div className={isTerminal ? 'font-semibold leading-tight tracking-[-0.01em]' : 'font-semibold leading-tight tracking-[-0.01em]'}>
        {label}
      </div>
      <RoleForumBadges role={role} forum={forum} />
      {!isTerminal ? (
        <div className={['mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none', bmsBlockSoftBadgeClass[kind]].join(' ')}>
          {bmsBlockKindLabel[kind]}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function BmsFlowNodeInner({ data, selected }: NodeProps<Node<BmsFlowNodeData>>) {
  return (
    <div className="p-2">
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-slate-400 !bg-white" />
      <FlowNodeChrome kind={data.kind} label={data.label} role={data.role} forum={data.forum} selected={selected} />
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-slate-400 !bg-white" />
    </div>
  )
}

export const bmsFlowNodeTypes = {
  bmsFlow: memo(BmsFlowNodeInner),
}
