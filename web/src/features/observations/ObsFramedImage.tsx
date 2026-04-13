import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'

type Variant = 'good' | 'bad'

/** Reference image with fixed frame overlay (green + tick / red + cross). Placeholder when no `src`. */
export function ObsFramedImage(props: { variant: Variant; src: string | null; label: string; compact?: boolean }) {
  const { variant, src, label, compact = false } = props
  const isGood = variant === 'good'
  const [open, setOpen] = useState(false)
  const frame =
    isGood
      ? 'border-emerald-500/80 bg-emerald-500/10 shadow-[inset_0_0_0_2px_rgba(16,185,129,0.35)]'
      : 'border-rose-500/80 bg-rose-500/10 shadow-[inset_0_0_0_2px_rgba(244,63,94,0.35)]'

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
    <div className={`flex min-w-0 flex-col gap-1 ${compact ? 'w-[8.5rem] shrink-0' : 'flex-1'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 ${frame} ${src ? 'cursor-zoom-in' : ''}`}
        role="img"
        aria-label={src ? `${label} reference` : `${label} placeholder`}
        onClick={() => {
          if (src) setOpen(true)
        }}
      >
        {src ? (
          <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-black/[0.04] to-black/[0.08] dark:from-white/[0.04] dark:to-white/[0.07]" />
        )}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
            isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          <span
            className={`flex size-7 items-center justify-center rounded-full border-2 border-current bg-surface/90 opacity-40 shadow-md backdrop-blur-sm ${
              isGood ? 'ring-2 ring-emerald-400/40' : 'ring-2 ring-rose-400/40'
            }`}
          >
            {isGood ? <Check className="size-4 stroke-[2.5]" strokeLinecap="round" /> : <X className="size-4 stroke-[2.5]" strokeLinecap="round" />}
          </span>
        </div>
      </div>
    </div>
    {open ? (
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
        aria-label="Close image preview"
      >
        <img src={src ?? ''} alt={label} className="max-h-[80vh] max-w-[80vw] rounded-xl border border-white/20 object-contain shadow-2xl" />
      </button>
    ) : null}
    </>
  )
}
