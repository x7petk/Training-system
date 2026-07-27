import type { MouseEvent } from 'react'

type Props = {
  yesCount: number
  noCount: number
  className?: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  title?: string
}

/** Same Yes/No toggle chrome as P2P answers, with counts in each side. */
export function DdsP2pSubYesNoSummary({
  yesCount,
  noCount,
  className = '',
  onClick,
  disabled = false,
  title,
}: Props) {
  const groupClass = `flex shrink-0 items-center gap-0.5 rounded-md border border-border/80 bg-surface-raised/30 p-0.5 ${className}`.trim()
  const pills = (
    <>
      <span
        className={`inline-flex h-5 min-w-[2.1rem] items-center justify-center rounded px-1.5 text-[10px] font-semibold tabular-nums ${
          yesCount > 0
            ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-500/40 dark:bg-rose-600'
            : 'text-rose-800 dark:text-rose-300'
        }`}
      >
        Yes{yesCount}
      </span>
      <span
        className={`inline-flex h-5 min-w-[2.1rem] items-center justify-center rounded px-1.5 text-[10px] font-semibold tabular-nums ${
          noCount > 0
            ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/40 dark:bg-emerald-600'
            : 'text-emerald-800 dark:text-emerald-300'
        }`}
      >
        No{noCount}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={onClick}
        className={`${groupClass} disabled:opacity-50`}
        aria-label={`Yes ${yesCount}, No ${noCount}`}
      >
        {pills}
      </button>
    )
  }

  return (
    <div className={groupClass} role="group" aria-label={`Yes ${yesCount}, No ${noCount}`} title={title}>
      {pills}
    </div>
  )
}
