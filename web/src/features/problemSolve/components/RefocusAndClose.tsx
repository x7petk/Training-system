import { Brain, CheckCircle2, Users } from 'lucide-react'
import type { ActionItem, ExpertFeedback } from '../types'

export function RefocusStage(props: {
  refocusStatement: string
  known: string[]
  missing: string[]
  narrowedScope: string
  experts: ExpertFeedback[]
  loading: boolean
  onRun: () => void
  onContinue: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">AI support before escalation</p>
          <h2 className="font-display text-xl font-semibold">Refocus coach & expert panel</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            6W-2H guided refocus builds a clear problem statement. Experts challenge assumptions and suggest tests.
          </p>
        </div>
        <button
          type="button"
          disabled={props.loading}
          onClick={props.onRun}
          className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-medium text-accent disabled:opacity-50"
        >
          <Brain className="size-4" />
          {props.loading ? 'Running AI…' : props.refocusStatement ? 'Re-run analysis' : 'Run AI analysis'}
        </button>
      </div>

      {!props.refocusStatement && !props.loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-raised/50 px-4 py-10 text-center text-sm text-muted">
          Run AI analysis to refocus the problem and collect expert feedback.
        </div>
      ) : null}

      {props.loading ? (
        <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          <span className="inline-block size-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <p className="mt-2">Consulting reliability, quality, process, and work-process experts…</p>
        </div>
      ) : null}

      {props.refocusStatement ? (
        <>
          <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <CheckCircle2 className="size-4 text-accent" />
              Refocused problem statement
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg">{props.refocusStatement}</p>
            <p className="mt-2 text-xs text-muted">
              <strong className="font-medium text-fg">Narrowed scope:</strong> {props.narrowedScope}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Known</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-fg">
                  {props.known.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Missing evidence</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-fg">
                  {props.missing.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
              <Users className="size-4 text-accent" />
              AI expert support
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {props.experts.map((ex) => (
                <article key={ex.expertId + ex.name} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  <p className="text-sm font-semibold text-fg">{ex.name}</p>
                  <p className="text-xs text-accent">{ex.role}</p>
                  <p className="mt-2 text-sm text-fg/90">{ex.summary}</p>
                  {ex.challenges?.length ? (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase text-muted">Challenges</p>
                      <ul className="mt-0.5 list-disc pl-4 text-xs">
                        {ex.challenges.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {ex.suggestedTests?.length ? (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold uppercase text-muted">Suggested tests</p>
                      <ul className="mt-0.5 list-disc pl-4 text-xs">
                        {ex.suggestedTests.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {ex.involve?.length ? (
                    <p className="mt-2 text-[11px] text-muted">Involve: {ex.involve.join(', ')}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={props.onContinue}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              Continue to resolve / escalate
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

export function DecisionStage(props: {
  recommendInHouse: boolean
  rationale: string
  actions: ActionItem[]
  advancedMethodLabel: string
  onResolveInHouse: () => void
  onEscalate: () => void
  onToggleAction: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Decision</p>
        <h2 className="font-display text-xl font-semibold">Can the operational team resolve in-house?</h2>
        <p className="mt-1 text-sm text-muted">{props.rationale}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={props.onResolveInHouse}
          className={`rounded-2xl border p-4 text-left transition ${
            props.recommendInHouse
              ? 'border-emerald-400 bg-emerald-50 shadow-sm ring-2 ring-emerald-200'
              : 'border-border bg-surface hover:border-emerald-300'
          }`}
        >
          <p className="text-sm font-semibold text-emerald-900">Yes — solve in-house</p>
          <p className="mt-1 text-xs text-emerald-900/80">
            Implement actions, standardize, capture learning, share in DDS/WDS, monitor.
          </p>
        </button>
        <button
          type="button"
          onClick={props.onEscalate}
          className={`rounded-2xl border p-4 text-left transition ${
            !props.recommendInHouse
              ? 'border-orange-400 bg-orange-50 shadow-sm ring-2 ring-orange-200'
              : 'border-border bg-surface hover:border-orange-300'
          }`}
        >
          <p className="text-sm font-semibold text-orange-950">No — escalate to advanced</p>
          <p className="mt-1 text-xs text-orange-950/80">Open {props.advancedMethodLabel} for deeper analysis.</p>
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="font-display text-sm font-semibold">Suggested action plan</h3>
        <ul className="mt-3 space-y-2">
          {props.actions.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-xl border border-border bg-canvas px-3 py-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={a.status === 'done'}
                onChange={() => props.onToggleAction(a.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{a.title}</p>
                <p className="text-xs text-muted">
                  {a.owner} · Due {a.due} · <span className="capitalize">{a.type}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function AdvancedStage(props: {
  methodLabel: string
  onContinueClose: () => void
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-5">
      <h2 className="font-display text-xl font-semibold text-orange-950">Advanced problem solve</h2>
      <p className="text-sm text-orange-950/80">
        Escalated to <strong>{props.methodLabel}</strong>. Full advanced worksheets will be added later — this demo
        captures the handoff and continues to close-the-loop learning.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-orange-950/90">
        <li>UPS: 6M, fishbone, 5 Whys, root cause verification</li>
        <li>WPI: process map, spaghetti, time study, balance</li>
        <li>IDA: failure analysis, 5M, barrier analysis, reliability</li>
        <li>OPM Advanced: gap, culture/capability, people analytics</li>
      </ul>
      <button
        type="button"
        onClick={props.onContinueClose}
        className="rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Continue to close the loop
      </button>
    </div>
  )
}

export function CloseTheLoop(props: {
  steps: { id: string; label: string; done: boolean; note: string }[]
  learning: string
  onToggle: (id: string) => void
  onNote: (id: string, note: string) => void
  onLearning: (v: string) => void
  onFinish: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Stage 5</p>
        <h2 className="font-display text-xl font-semibold">Close the loop</h2>
        <p className="mt-1 text-sm text-muted">Lock in learning and prevent recurrence. Learning feeds the AI knowledge base.</p>
      </div>

      <ul className="space-y-2">
        {props.steps.map((s) => (
          <li key={s.id} className="rounded-xl border border-border bg-surface px-3 py-2">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={s.done} onChange={() => props.onToggle(s.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-canvas px-2 py-1 text-xs"
                  placeholder="Note…"
                  value={s.note}
                  onChange={(e) => props.onNote(s.id, e.target.value)}
                />
              </div>
            </label>
          </li>
        ))}
      </ul>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">Learning for AI knowledge base</span>
        <textarea
          rows={3}
          className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm"
          placeholder="Verified problem, cause, and solution…"
          value={props.learning}
          onChange={(e) => props.onLearning(e.target.value)}
        />
      </label>

      <button
        type="button"
        onClick={props.onFinish}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
      >
        Complete problem solve
      </button>
    </div>
  )
}
