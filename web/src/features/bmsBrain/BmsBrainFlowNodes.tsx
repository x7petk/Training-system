/* eslint-disable react-refresh/only-export-components -- XYFlow expects this module to export the node type registry. */
import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import {
  bmsBlockAccentClass,
  bmsBlockClass,
  bmsBlockInteractiveClass,
  bmsBlockKindLabel,
  bmsBlockRadiusClass,
  bmsBlockSoftBadgeClass,
} from './bmsBlockStyles'
import type { BmsCatalogRow, BmsNodeKind } from './types'

export type BmsFlowNodeData = {
  label: string
  kind: BmsNodeKind
  systemIds: string[]
  systems: BmsCatalogRow[]
}

function FlowNodeChrome({
  kind,
  label,
  selected,
  children,
}: {
  kind: BmsNodeKind
  label: string
  selected?: boolean
  children?: React.ReactNode
}) {
  if (kind === 'decision') {
    return (
      <div className="relative flex size-[120px] items-center justify-center">
        <div
          className={[
            'absolute inset-0 rotate-45 rounded-sm border-2 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_10px_24px_rgba(245,158,11,0.16)]',
            bmsBlockClass.decision,
            selected ? 'ring-2 ring-accent ring-offset-2' : '',
          ].join(' ')}
        />
        <div className="relative z-10 max-w-[5.5rem] px-1 text-center text-[11px] font-semibold leading-tight tracking-[-0.01em]">
          {label}
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
        isTerminal ? 'flex min-h-[2.5rem] min-w-[8rem] max-w-[200px] items-center justify-center text-center' : 'min-w-[140px] max-w-[180px]',
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
    <>
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-slate-400 !bg-white" />
      <FlowNodeChrome kind={data.kind} label={data.label} selected={selected} />
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-slate-400 !bg-white" />
    </>
  )
}

export const bmsFlowNodeTypes = {
  bmsFlow: memo(BmsFlowNodeInner),
}
