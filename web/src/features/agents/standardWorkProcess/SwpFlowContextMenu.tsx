import { Circle, Diamond, Square, StickyNote } from 'lucide-react'
import type { SwpNodeKind } from './types'

export type SwpContextMenuState = {
  clientX: number
  clientY: number
  canvasY: number
  roleKey: import('./types').SwpRoleKey
}

type Props = {
  menu: SwpContextMenuState
  onAdd: (kind: SwpNodeKind) => void
  onClose: () => void
}

const ITEMS: { kind: SwpNodeKind; label: string; icon: typeof Circle }[] = [
  { kind: 'task', label: 'Add Task', icon: Square },
  { kind: 'decision', label: 'Add Decision', icon: Diamond },
  { kind: 'start', label: 'Add Start', icon: Circle },
  { kind: 'end', label: 'Add End', icon: Circle },
]

export function SwpFlowContextMenu({ menu, onAdd, onClose }: Props) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close menu"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-50 min-w-[11rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        style={{ left: menu.clientX, top: menu.clientY }}
        role="menu"
      >
        {ITEMS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50"
            onClick={() => {
              onAdd(kind)
              onClose()
            }}
          >
            <Icon className="size-3.5 shrink-0 text-slate-600" aria-hidden />
            {label}
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50"
          disabled
          title="Coming soon"
        >
          <StickyNote className="size-3.5 shrink-0" aria-hidden />
          Add Text Note
        </button>
      </div>
    </>
  )
}
