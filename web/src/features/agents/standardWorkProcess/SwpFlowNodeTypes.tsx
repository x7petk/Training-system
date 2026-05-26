import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { useSwpFlowEditorActions } from './SwpFlowEditorContext'
import type { SwpRfNodeData } from './flowReactFlow'
import { SWP_NODE_DEFAULT_SIZE, SWP_NODE_MIN_SIZE } from './swpNodeDefaults'

const handleClass = '!h-2 !w-2 !border-2 !border-slate-500 !bg-white'

function SwpHandles() {
  return (
    <>
      <Handle id="top" type="target" position={Position.Top} className={handleClass} />
      <Handle id="left" type="target" position={Position.Left} className={handleClass} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={handleClass} />
      <Handle id="right" type="source" position={Position.Right} className={handleClass} />
    </>
  )
}

function EditableLabel({ nodeId, label }: { nodeId: string; label: string }) {
  const { onLabelChange } = useSwpFlowEditorActions()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(label)
  }, [label])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    const next = draft.trim() || label
    if (next !== label) onLabelChange(nodeId, next)
  }, [draft, label, nodeId, onLabelChange])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            setDraft(label)
            setEditing(false)
          }
        }}
        className="w-full min-w-0 rounded border border-accent bg-white px-1 py-0.5 text-center text-[11px] font-medium text-fg outline-none shadow-sm"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <span
      className="block cursor-text px-2 text-center text-[11px] font-semibold leading-snug text-slate-800"
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      title="Double-click to edit"
    >
      {label}
    </span>
  )
}

export const SwpFlowNodeComponent = memo(function SwpFlowNodeComponent({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps & { data: SwpRfNodeData }) {
  const { onNodeResize } = useSwpFlowEditorActions()
  const { kind, label, meta } = data
  const accent = meta?.color
  const defaults = SWP_NODE_DEFAULT_SIZE[kind]
  const mins = SWP_NODE_MIN_SIZE[kind]
  const w = width ?? defaults.width
  const h = height ?? defaults.height

  const resizer = (
    <NodeResizer
      isVisible={!!selected}
      minWidth={mins.width}
      minHeight={mins.height}
      keepAspectRatio={kind === 'decision'}
      lineClassName="!border-accent"
      handleClassName="!h-2 !w-2 !rounded-sm !border-accent !bg-white"
      onResizeEnd={(_event, params) => {
        onNodeResize(id, Math.round(params.width), Math.round(params.height))
      }}
    />
  )

  if (kind === 'decision') {
    const stroke = accent ?? '#d97706'
    const points = `${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`
    return (
      <div className="swp-node-frame relative" style={{ width: w, height: h }}>
        {resizer}
        <SwpHandles />
        <svg
          className="pointer-events-none absolute inset-0"
          width={w}
          height={h}
          aria-hidden
        >
          <polygon
            points={points}
            fill="#fef3c7"
            stroke={stroke}
            strokeWidth={2}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-w-[78%]">
            <EditableLabel nodeId={id} label={label} />
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'start' || kind === 'end') {
    return (
      <div
        className={`swp-node-frame flex items-center justify-center rounded-full border-2 px-2 shadow-sm transition-shadow ${
          kind === 'start'
            ? 'border-emerald-700 bg-gradient-to-b from-emerald-50 to-emerald-100'
            : 'border-emerald-800 bg-gradient-to-b from-emerald-100 to-emerald-200'
        }`}
        style={{ width: w, height: h, borderColor: accent }}
      >
        {resizer}
        <SwpHandles />
        <EditableLabel nodeId={id} label={label} />
      </div>
    )
  }

  return (
    <div
      className="swp-node-frame flex items-center justify-center rounded-md border-2 border-sky-700 bg-gradient-to-b from-sky-50 to-sky-100 px-2 py-1.5 shadow-sm transition-shadow"
      style={{ width: w, height: h, borderColor: accent }}
    >
      {resizer}
      <SwpHandles />
      <EditableLabel nodeId={id} label={label} />
    </div>
  )
})

export const swpNodeTypes = { swpNode: SwpFlowNodeComponent }
