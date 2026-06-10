import type { ReactNode } from 'react'
import { PanelRightClose } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
}

export function BmsBrainSlidePanel({ open, onClose, title, subtitle, children }: Props) {
  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 lg:absolute lg:rounded-2xl"
          aria-label="Close panel"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={[
          'fixed inset-y-0 right-0 z-50 flex w-[min(22rem,calc(100vw-1rem))] max-w-full flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none lg:absolute lg:inset-y-0 lg:right-0 lg:rounded-l-2xl lg:border lg:border-r-0',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold">{title}</h2>
            {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-muted hover:bg-black/[0.06]"
            aria-label="Close panel"
          >
            <PanelRightClose className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </aside>
    </>
  )
}
