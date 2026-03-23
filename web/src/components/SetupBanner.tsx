import { AlertTriangle } from 'lucide-react'

export function SetupBanner() {
  return (
    <div
      className="mb-6 flex gap-3 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="font-medium text-amber-950">Supabase env vars missing</p>
        <p className="mt-1 text-amber-900/90">
          Copy <code className="rounded bg-amber-100/90 px-1.5 py-0.5 font-mono text-xs text-amber-950">web/.env.example</code> to{' '}
          <code className="rounded bg-amber-100/90 px-1.5 py-0.5 font-mono text-xs text-amber-950">web/.env.local</code> and add your
          project URL and anon key.
        </p>
      </div>
    </div>
  )
}
