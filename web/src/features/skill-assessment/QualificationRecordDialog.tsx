import { useEffect, useState, type ReactNode } from 'react'
import { BookOpen, ClipboardCheck, FileText, ListChecks, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { SkillKind } from '../matrix/gapLogic'

type Props = {
  personId: string
  personName: string
  skillId: string
  skillName: string
  onDismiss: () => void
}

function profileName(embed: unknown): string {
  if (embed == null) return '—'
  if (Array.isArray(embed)) return profileName(embed[0])
  if (typeof embed === 'object' && embed !== null && 'display_name' in embed) {
    const v = (embed as { display_name: string | null }).display_name
    return v?.trim() || '—'
  }
  return '—'
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

type AttemptRow = {
  created_at: string
  passed: boolean
  score_percent: number
}

type ProgressionRow = {
  created_at: string
  from_level: number
  to_level: number
  assessor_profile?: unknown
}

type VerificationRow = {
  verified_at: string
  verifier?: unknown
}

type ChecklistAuditRow = {
  item_id: string
  checked_at: string
  checker?: unknown
}

function RecordSection(props: {
  step: number
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}) {
  const { step, icon, title, subtitle, children } = props
  return (
    <section className="rounded-xl border border-border bg-surface/90 p-3 shadow-sm sm:p-3.5">
      <header className="mb-3 flex gap-3 border-b border-border/70 pb-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-xs font-bold text-accent"
          aria-hidden
        >
          {step}
        </span>
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-muted [&>svg]:size-4">{icon}</span>
          <div className="min-w-0">
            <h4 className="font-display text-sm font-semibold tracking-tight text-fg">{title}</h4>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{subtitle}</p>
          </div>
        </div>
      </header>
      <div className="pl-0 sm:pl-[2.75rem]">{children}</div>
    </section>
  )
}

function DefRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/50 py-2 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm text-fg">{value}</dd>
    </div>
  )
}

export function QualificationRecordDialog(props: Props) {
  const { personId, personName, skillId, skillName, onDismiss } = props
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [skillKind, setSkillKind] = useState<SkillKind>('numeric')
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [firstPassedL12, setFirstPassedL12] = useState<AttemptRow | null>(null)
  const [progressions, setProgressions] = useState<ProgressionRow[]>([])
  const [verifications, setVerifications] = useState<VerificationRow[]>([])
  const [checklistLines, setChecklistLines] = useState<
    { item_text: string; checker_name: string; checked_at: string }[]
  >([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setAttempts([])
      setFirstPassedL12(null)
      setProgressions([])
      setVerifications([])
      setChecklistLines([])

      const [skRes, attRes, progRes, verRes, itemsRes] = await Promise.all([
        supabase.from('skills').select('kind').eq('id', skillId).maybeSingle(),
        supabase
          .from('skill_training_attempts')
          .select('created_at, passed, score_percent')
          .eq('person_id', personId)
          .eq('skill_id', skillId)
          .order('created_at', { ascending: false }),
        supabase
          .from('skill_progression_events')
          .select(
            'created_at, from_level, to_level, assessor_profile:profiles!skill_progression_events_assessed_by_fkey(display_name)',
          )
          .eq('person_id', personId)
          .eq('skill_id', skillId)
          .order('created_at', { ascending: false }),
        supabase
          .from('skill_assessment_verifications')
          .select('verified_at, verifier:profiles!skill_assessment_verifications_verified_by_fkey(display_name)')
          .eq('person_id', personId)
          .eq('skill_id', skillId)
          .order('verified_at', { ascending: false }),
        supabase
          .from('skill_assessment_checklist_items')
          .select('id, item_text, sort_order')
          .eq('skill_id', skillId)
          .order('sort_order', { ascending: true }),
      ])

      if (cancelled) return

      let errMsg: string | null = null
      if (skRes.error) errMsg = skRes.error.message
      else {
        const k = (skRes.data?.kind as SkillKind | undefined) ?? 'numeric'
        setSkillKind(k)
      }

      if (attRes.error) errMsg = attRes.error.message
      else {
        const rows = (attRes.data ?? []) as AttemptRow[]
        setAttempts(rows)
        const passedChrono = [...rows].filter((r) => r.passed).sort((a, b) => a.created_at.localeCompare(b.created_at))
        setFirstPassedL12(passedChrono[0] ?? null)
      }

      if (progRes.error) errMsg ??= progRes.error.message
      else setProgressions((progRes.data ?? []) as ProgressionRow[])

      if (verRes.error) errMsg ??= verRes.error.message
      else setVerifications((verRes.data ?? []) as VerificationRow[])

      const catalogItems = (itemsRes.data ?? []) as { id: string; item_text: string; sort_order: number }[]
      const itemIds = catalogItems.map((x) => x.id)
      const itemOrder = new Map(catalogItems.map((x) => [x.id, x.sort_order]))

      if (itemIds.length > 0) {
        const progData = await supabase
          .from('skill_assessment_checklist_progress')
          .select(
            'item_id, checked_at, checker:profiles!skill_assessment_checklist_progress_checked_by_fkey(display_name)',
          )
          .eq('subject_person_id', personId)
          .in('item_id', itemIds)

        if (cancelled) return

        if (progData.error) errMsg ??= progData.error.message
        else if (progData.data) {
          const itemText = new Map(catalogItems.map((x) => [x.id, x.item_text]))
          const lines: { item_text: string; checker_name: string; checked_at: string; ord: number }[] = []
          for (const raw of progData.data as ChecklistAuditRow[]) {
            const text = itemText.get(raw.item_id) ?? '—'
            lines.push({
              item_text: text,
              checker_name: profileName(raw.checker),
              checked_at: raw.checked_at,
              ord: itemOrder.get(raw.item_id) ?? 0,
            })
          }
          lines.sort((a, b) => a.ord - b.ord || a.item_text.localeCompare(b.item_text))
          setChecklistLines(lines.map(({ item_text, checker_name, checked_at }) => ({ item_text, checker_name, checked_at })))
        }
      }

      if (itemsRes.error) errMsg ??= itemsRes.error.message

      setError(errMsg)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [personId, skillId])

  const isCertification = skillKind === 'certification'
  const progressionEvents = progressions.filter((e) => e.from_level === 2 && e.to_level === 3)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-3 py-6">
      <div className="max-h-[90vh] w-[min(100%,38rem)] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-glow">
        <div className="border-b border-border bg-canvas/40 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">
                <FileText className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold tracking-tight text-fg">Qualification record</h3>
                <p className="mt-1 text-sm text-fg/90">
                  <span className="font-medium">{personName}</span>
                  <span className="text-muted"> · </span>
                  <span>{skillName}</span>
                </p>
                <p className="mt-2 max-w-md text-[11px] leading-relaxed text-muted">
                  {loading
                    ? 'Loading…'
                    : isCertification
                      ? 'Formal verification and assessor checklist ticks for this certification (No / Yes).'
                      : 'Training quiz, matrix progression, formal verification, and assessor checklist ticks stored for this skill.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[min(70vh,calc(90vh-8rem))] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading record…</p>
          ) : (
            <div className="space-y-4">
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-xs text-amber-950"
                >
                  <p className="font-medium">Partial or blocked data</p>
                  <p className="mt-1 text-amber-900/90">{error}</p>
                  <p className="mt-1.5 text-[11px] text-amber-900/80">Some sections may be empty because of access rules.</p>
                </div>
              ) : null}

              {!isCertification ? (
                <>
                  <RecordSection
                    step={1}
                    icon={<BookOpen aria-hidden />}
                    title="Level 1 → 2 (theory)"
                    subtitle="Training pack quiz — first passing attempt marks readiness for level 2."
                  >
                    {firstPassedL12 ? (
                      <dl className="space-y-0">
                        <DefRow label="First pass" value={formatTs(firstPassedL12.created_at)} />
                        <DefRow label="Score" value={`${firstPassedL12.score_percent}%`} />
                      </dl>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border bg-canvas/50 px-3 py-2 text-sm text-muted">
                        No passing training attempt on file for this skill.
                      </p>
                    )}
                    {attempts.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">All quiz attempts</p>
                        <div className="overflow-x-auto rounded-lg border border-border/80">
                          <table className="w-full min-w-[16rem] border-collapse text-left text-xs">
                            <thead>
                              <tr className="border-b border-border bg-black/[0.04] dark:bg-white/[0.06]">
                                <th className="px-2.5 py-2 font-semibold text-muted">When</th>
                                <th className="px-2.5 py-2 font-semibold text-muted">Result</th>
                                <th className="px-2.5 py-2 text-right font-semibold text-muted">Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attempts.map((a, i) => (
                                <tr key={i} className="border-b border-border/50 last:border-b-0">
                                  <td className="whitespace-nowrap px-2.5 py-1.5 text-fg">{formatTs(a.created_at)}</td>
                                  <td className="px-2.5 py-1.5">
                                    <span
                                      className={
                                        a.passed
                                          ? 'rounded-md bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900'
                                          : 'rounded-md bg-zinc-200/80 px-1.5 py-0.5 font-medium text-zinc-800'
                                      }
                                    >
                                      {a.passed ? 'Passed' : 'Not passed'}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums text-fg">
                                    {a.score_percent}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </RecordSection>

                  <RecordSection
                    step={2}
                    icon={<UserRound aria-hidden />}
                    title="Level 2 → 3 (practice)"
                    subtitle="Logged when the matrix moves this skill from 2 to 3 (assessor or admin)."
                  >
                    {progressionEvents.length > 0 ? (
                      <ol className="space-y-2">
                        {progressionEvents.map((e, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-border/80 bg-canvas/40 px-3 py-2.5 text-sm text-fg"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium tabular-nums">{formatTs(e.created_at)}</span>
                              <span className="text-[11px] text-muted">
                                Level {e.from_level} → {e.to_level}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              Recorded by <span className="font-medium text-fg/90">{profileName(e.assessor_profile)}</span>
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border bg-canvas/50 px-3 py-2 text-sm text-muted">
                        No L2→3 progression event logged yet.
                      </p>
                    )}
                  </RecordSection>
                </>
              ) : null}

              <RecordSection
                step={isCertification ? 1 : 3}
                icon={<ClipboardCheck aria-hidden />}
                title="Formal verification"
                subtitle="When an assessor used “Verify” after completing the checklist."
              >
                {verifications.length > 0 ? (
                  <ol className="space-y-2">
                    {verifications.map((v, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-border/80 bg-canvas/40 px-3 py-2.5 text-sm text-fg"
                      >
                        <div className="font-medium">{profileName(v.verifier)}</div>
                        <div className="mt-0.5 text-xs text-muted">{formatTs(v.verified_at)}</div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-canvas/50 px-3 py-2 text-sm text-muted">
                    No formal verification entries stored.
                  </p>
                )}
              </RecordSection>

              <RecordSection
                step={isCertification ? 2 : 4}
                icon={<ListChecks aria-hidden />}
                title="Assessor checklist"
                subtitle="Each line ticked for this person, with who signed it off and when."
              >
                {checklistLines.length > 0 ? (
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/80 bg-canvas/40">
                    {checklistLines.map((line, i) => (
                      <li key={i} className="px-3 py-2.5">
                        <p className="text-sm font-medium leading-snug text-fg">{line.item_text}</p>
                        <p className="mt-1 text-xs text-muted">
                          <span className="font-medium text-fg/85">{line.checker_name}</span>
                          <span className="text-muted"> · </span>
                          {formatTs(line.checked_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-canvas/50 px-3 py-2 text-sm text-muted">
                    No checklist ticks on file for this person and skill.
                  </p>
                )}
              </RecordSection>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
