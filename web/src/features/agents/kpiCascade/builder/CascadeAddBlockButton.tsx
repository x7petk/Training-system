import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { CascadeBoardColumn } from '../cascadeTypes'

const fieldClass =
  'h-8 w-full min-w-0 rounded-md border border-[#c5cad3] bg-white px-2 text-xs text-[#1a1a1a]'

export type CascadeCatalogItem = {
  id: string
  name: string
  suffix?: string
}

type Props = {
  columns: CascadeBoardColumn[]
  columnLabel?: string
  catalogLabel?: string
  catalogItems: CascadeCatalogItem[]
  addButtonLabel?: string
  panelTitle?: string
  emptyCatalogHint?: string
  onAddBlock: (columnId: string, catalogId: string) => void
}

export function CascadeAddBlockButton({
  columns,
  columnLabel = 'Level',
  catalogLabel = 'KPI',
  catalogItems,
  addButtonLabel = 'Add KPI block',
  panelTitle = 'Add KPI to board',
  emptyCatalogHint = 'No items yet. Create them in the Admin tab first.',
  onAddBlock,
}: Props) {
  const [open, setOpen] = useState(false)
  const [columnId, setColumnId] = useState(columns[0]?.id ?? '')
  const [catalogId, setCatalogId] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!columns.some((c) => c.id === columnId)) {
      setColumnId(columns[0]?.id ?? '')
    }
  }, [columnId, columns])

  useEffect(() => {
    if (!catalogId && catalogItems[0]) setCatalogId(catalogItems[0].id)
    if (catalogId && !catalogItems.some((c) => c.id === catalogId)) {
      setCatalogId(catalogItems[0]?.id ?? '')
    }
  }, [catalogItems, catalogId])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function handleAdd() {
    if (!columnId || !catalogId) return
    onAddBlock(columnId, catalogId)
    setOpen(false)
  }

  return (
    <div ref={panelRef} className="relative inline-flex items-center">
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-[17rem] rounded-lg border border-[#c5cad3] bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#1a1a1a]">{panelTitle}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-[#8a939e] hover:bg-[#f0f2f5] hover:text-[#333]"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {catalogItems.length === 0 ? (
            <p className="text-[11px] leading-snug text-[#5c6570]">{emptyCatalogHint}</p>
          ) : (
            <div className="space-y-2">
              <label>
                <span className="mb-0.5 block text-[10px] text-[#5c6570]">{columnLabel}</span>
                <select
                  className={fieldClass}
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-0.5 block text-[10px] text-[#5c6570]">{catalogLabel}</span>
                <select
                  className={fieldClass}
                  value={catalogId}
                  onChange={(e) => setCatalogId(e.target.value)}
                >
                  {catalogItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.suffix ? ` (${item.suffix})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!columnId || !catalogId}
                onClick={handleAdd}
                className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md bg-[#2b6cb0] text-xs font-medium text-white hover:bg-[#255b9a] disabled:opacity-40"
              >
                <Plus className="size-3.5" />
                Place block
              </button>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#2b6cb0] px-3 text-xs font-medium text-white hover:bg-[#255b9a]"
      >
        <Plus className="size-3.5" />
        {addButtonLabel}
      </button>
    </div>
  )
}
