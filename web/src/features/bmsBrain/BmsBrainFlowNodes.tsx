import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { bmsBlockClass, bmsBlockRadiusClass } from './bmsBlockStyles'
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
            'absolute inset-0 rotate-45 rounded-sm border-2 shadow-sm',
            bmsBlockClass.decision,
            selected ? 'ring-2 ring-accent ring-offset-2' : '',
          ].join(' ')}
        />
        <div className="relative z-10 max-w-[5.5rem] px-1 text-center text-[11px] font-semibold leading-tight">
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
        'border-2 px-3 py-2 text-xs shadow-sm',
        bmsBlockClass[kind],
        bmsBlockRadiusClass(kind),
        isTerminal ? 'flex min-h-[2.5rem] min-w-[8rem] max-w-[200px] items-center justify-center text-center' : 'min-w-[140px] max-w-[180px]',
        selected ? 'ring-2 ring-accent ring-offset-2' : '',
      ].join(' ')}
    >
      <div className={isTerminal ? 'font-semibold leading-tight' : 'font-semibold leading-tight'}>{label}</div>
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
