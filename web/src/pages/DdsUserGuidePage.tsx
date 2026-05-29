import { BookOpen } from 'lucide-react'
import { DdsProcessGuidelines } from '../features/dds/DdsProcessGuidelines'

export function DdsUserGuidePage() {
  return (
    <div className="space-y-3">
      <header className="flex items-start gap-2">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
          <BookOpen className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">User Guide</h1>
          <p className="mt-1 max-w-2xl text-xs leading-snug text-muted">
            How Daily Direction Setting works in this app and how data flows between screens.
          </p>
        </div>
      </header>

      <DdsProcessGuidelines defaultOpenAll standalone />
    </div>
  )
}
