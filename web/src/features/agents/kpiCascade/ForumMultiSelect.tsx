import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { forumSortKey } from './cascadeUtils'
import type { KpiCascadeForum } from './types'

type ForumOption = {
  id: string
  name: string
  inactive: boolean
  missing: boolean
}

type ForumMultiSelectProps = {
  selectedIds: string[]
  forums: KpiCascadeForum[]
  forumById: Map<string, KpiCascadeForum>
  onChange: (forumIds: string[]) => void
  ariaLabel: string
}

const PANEL_MIN_WIDTH = 300
const PANEL_MAX_HEIGHT = 360

export function ForumMultiSelect({
  selectedIds,
  forums,
  forumById,
  onChange,
  ariaLabel,
}: ForumMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = selectedIds ?? []
  const orphanIds = selected.filter((id) => !forumById.has(id))

  const options = useMemo((): ForumOption[] => {
    const sorted = [...forums].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return forumSortKey(a) - forumSortKey(b) || a.name.localeCompare(b.name)
    })
    return [
      ...orphanIds.map((id) => ({ id, name: 'Unknown forum', inactive: true, missing: true })),
      ...sorted.map((f) => ({ id: f.id, name: f.name, inactive: !f.active, missing: false })),
    ]
  }, [forums, orphanIds])

  const filteredOptions = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, filter])

  const activeOptionIds = useMemo(
    () => options.filter((o) => !o.inactive && !o.missing).map((o) => o.id),
    [options],
  )

  const selectedChips = useMemo(
    () =>
      selected.map((id) => ({
        id,
        name: forumById.get(id)?.name ?? 'Unknown',
        missing: !forumById.has(id),
      })),
    [selected, forumById],
  )

  const hasOrphan = orphanIds.length > 0

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const panelHeight = Math.min(PANEL_MAX_HEIGHT, window.innerHeight * 0.7)
    const gap = 6
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openAbove = spaceBelow < panelHeight && spaceAbove > spaceBelow

    const width = Math.max(PANEL_MIN_WIDTH, rect.width)
    let left = rect.left
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12)
    }

    setPanelStyle({
      position: 'fixed',
      left,
      width,
      maxHeight: panelHeight,
      zIndex: 10050,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onLayout = () => updatePosition()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) setFilter('')
  }, [open])

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    onChange(next)
  }

  function selectAllActive() {
    const merged = new Set([...selected, ...activeOptionIds])
    onChange([...merged])
  }

  const portal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[10040] bg-black/20 dark:bg-black/40"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              style={panelStyle}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-canvas shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
              role="dialog"
              aria-label="Select forums"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">Forums</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1 text-muted hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.08]"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter forums…"
                    autoFocus
                    className="w-full rounded-lg border border-border bg-surface-raised/50 py-2 pl-8 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">
                    <span className="font-medium text-fg">{selected.length}</span> selected
                  </span>
                  <button
                    type="button"
                    onClick={selectAllActive}
                    className="rounded-md px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10"
                  >
                    All active
                  </button>
                  {selected.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => onChange([])}
                      className="rounded-md px-2 py-0.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                {selectedChips.length > 0 ? (
                  <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto overscroll-contain">
                    {selectedChips.map((chip) => (
                      <span
                        key={chip.id}
                        className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          chip.missing
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : 'bg-accent/15 text-accent'
                        }`}
                      >
                        <span className="truncate">{chip.name}</span>
                        <button
                          type="button"
                          onClick={() => toggle(chip.id)}
                          className="rounded-full p-0.5 hover:bg-black/10"
                          aria-label={`Remove ${chip.name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <ul
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
                role="listbox"
                aria-multiselectable
              >
                {filteredOptions.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-muted">No forums match</li>
                ) : (
                  filteredOptions.map((opt) => {
                    const checked = selected.includes(opt.id)
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={checked}
                          onClick={() => toggle(opt.id)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${
                            checked ? 'bg-accent/8' : ''
                          } ${opt.missing ? 'text-amber-700 dark:text-amber-400' : opt.inactive ? 'text-muted' : 'text-fg'}`}
                        >
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? 'border-accent bg-accent text-white'
                                : 'border-border bg-canvas'
                            }`}
                            aria-hidden
                          >
                            {checked ? <Check className="size-3.5 stroke-[3]" /> : null}
                          </span>
                          <span className="min-w-0 flex-1 leading-snug">
                            {opt.name}
                            {opt.missing ? (
                              <span className="ml-1 text-xs text-amber-600/80">(missing)</span>
                            ) : opt.inactive ? (
                              <span className="ml-1 text-xs text-muted">(inactive)</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>

              <div className="shrink-0 border-t border-border px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[2.5rem] w-full min-w-[12rem] flex-col items-stretch gap-1 rounded-lg border bg-canvas px-2.5 py-2 text-left text-sm transition hover:border-accent/50 ${
          hasOrphan ? 'border-amber-500/50' : 'border-border'
        } ${open ? 'border-accent ring-1 ring-accent/25' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className={`font-medium ${selected.length ? 'text-fg' : 'text-muted'}`}>
            {selected.length === 0 ? 'Choose forums…' : `${selected.length} selected`}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
        {selectedChips.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {selectedChips.slice(0, 3).map((chip) => (
              <span
                key={chip.id}
                className={`max-w-full truncate rounded-md px-1.5 py-0.5 text-xs ${
                  chip.missing ? 'bg-amber-500/15 text-amber-800' : 'bg-surface-raised text-muted'
                }`}
              >
                {chip.name}
              </span>
            ))}
            {selectedChips.length > 3 ? (
              <span className="text-xs text-muted">+{selectedChips.length - 3} more</span>
            ) : null}
          </span>
        ) : null}
      </button>
      {portal}
    </>
  )
}
