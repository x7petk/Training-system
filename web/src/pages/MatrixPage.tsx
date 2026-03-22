import { useEffect, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Counts = {
  skills: number | null
  roles: number | null
  people: number | null
  requirements: number | null
}

export function MatrixPage() {
  const [counts, setCounts] = useState<Counts>({
    skills: null,
    roles: null,
    people: null,
    requirements: null,
  })
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const run = async (table: string) => {
        const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true })
        if (error) throw new Error(`${table}: ${error.message}`)
        return count ?? 0
      }

      try {
        const [skills, roles, people, requirements] = await Promise.all([
          run('skills'),
          run('roles'),
          run('people'),
          run('role_skill_requirements'),
        ])
        if (!cancelled) {
          setCounts({ skills, roles, people, requirements })
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load matrix data')
          setCounts({ skills: null, roles: null, people: null, requirements: null })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const hasData =
    counts.skills !== null &&
    counts.roles !== null &&
    (counts.skills > 0 || counts.roles > 0 || (counts.people ?? 0) > 0)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Skill matrix</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Compare required vs actual capability, spot gaps, and drill down by team — grid view comes next; data
            layer is live below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
          >
            <Search className="size-4 text-muted" aria-hidden />
            Quick find
            <kbd className="ml-1 hidden rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-border-strong"
          >
            <Filter className="size-4 text-muted" aria-hidden />
            Filters
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['Skills', counts.skills],
            ['Roles', counts.roles],
            ['People', counts.people],
            ['Requirements', counts.requirements],
          ] as const
        ).map(([label, n]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-surface-raised/50 px-4 py-3 backdrop-blur-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-fg">
              {n === null ? '—' : n}
            </p>
          </div>
        ))}
      </div>

      {loadError ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {loadError}
          <span className="mt-1 block text-xs text-amber-100/80">
            Run <code className="font-mono">npm run supabase:push</code> from the repo root if migrations are not
            applied yet.
          </span>
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface-raised/40 shadow-inner backdrop-blur-sm">
        <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-px bg-border text-xs font-medium uppercase tracking-wider text-muted">
          {['Person', 'Role', 'Skill', 'Required', 'Actual', 'Gap'].map((h) => (
            <div key={h} className="bg-surface px-3 py-2.5">
              {h}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          {hasData ? (
            <>
              <p className="font-medium text-fg/90">Data connected</p>
              <p className="max-w-md text-sm text-muted">
                Seeded skills and role requirements are in Supabase. Add <strong>people</strong> and{' '}
                <strong>person_skills</strong> (Admin tooling next) to populate this grid.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-fg/90">No matrix rows yet</p>
              <p className="max-w-sm text-sm text-muted">
                After <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs">npm run supabase:push</code>,
                you should see non-zero skill and role counts above. People start empty until you add roster records.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
