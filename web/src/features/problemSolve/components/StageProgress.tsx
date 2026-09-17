import type { NavigatorStage } from '../types'

const STAGES: { id: NavigatorStage; label: string; short: string }[] = [
  { id: 'identify', label: 'Identify & Navigate', short: '1' },
  { id: 'initial', label: 'Initial Problem Solve', short: '2' },
  { id: 'refocus', label: 'AI Support', short: '3' },
  { id: 'decision', label: 'Resolve / Escalate', short: '4' },
  { id: 'close', label: 'Close the Loop', short: '5' },
]

const ORDER: NavigatorStage[] = ['identify', 'initial', 'refocus', 'decision', 'advanced', 'close']

function stageIndex(s: NavigatorStage) {
  if (s === 'advanced') return 3
  return ORDER.indexOf(s)
}

export function StageProgress({ stage }: { stage: NavigatorStage }) {
  const current = stageIndex(stage)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {STAGES.map((s, i) => {
          const active = stage === s.id || (s.id === 'decision' && stage === 'advanced')
          const done = stageIndex(s.id) < current || (stage === 'close' && s.id !== 'close')
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                className={[
                  'flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition',
                  active
                    ? 'border-accent bg-accent text-white shadow-glow'
                    : done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-border bg-surface text-muted',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
                    active ? 'bg-white/20' : done ? 'bg-emerald-200' : 'bg-black/5',
                  ].join(' ')}
                >
                  {done && !active ? '✓' : s.short}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STAGES.length - 1 ? (
                <div className={`hidden h-px w-3 sm:block ${done ? 'bg-emerald-300' : 'bg-border'}`} />
              ) : null}
            </div>
          )
        })}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
        Right data → Right problem → Right investigation → Right root cause → Right solution → Sustained results
      </p>
    </div>
  )
}
