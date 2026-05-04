import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { SkillKind } from '../matrix/gapLogic'

type ChecklistItemRow = { id: string; item_text: string; sort_order: number }

type ItemProgress = {
  checked_at: string
  checker_id: string
  checker_name: string
}

type VerificationRow = {
  verified_at: string
  verifier_name: string
}

function profileDisplayName(embed: unknown): string {
  if (embed == null) return 'Unknown'
  if (Array.isArray(embed)) return profileDisplayName(embed[0])
  if (typeof embed === 'object' && embed !== null && 'display_name' in embed) {
    const v = (embed as { display_name: string | null }).display_name
    return v?.trim() || 'Unknown'
  }
  return 'Unknown'
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

type Props = {
  skillId: string
  subjectPersonId: string
  skillKind: SkillKind
  /** Current matrix level for this person + skill (from roster row or plan knowledge). */
  actualLevel: number | null
  isAdmin: boolean
  onVerificationComplete: () => void
}

/** Staff (admin or assessor): instructions, subject-scoped checklist with attribution, verify L2→3. */
export function AssessorAssessmentSection(props: Props) {
  const { skillId, subjectPersonId, skillKind, actualLevel, isAdmin, onVerificationComplete } = props
  const [loading, setLoading] = useState(true)
  const [instructions, setInstructions] = useState('')
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [progressByItem, setProgressByItem] = useState<Map<string, ItemProgress>>(new Map())
  const [verifications, setVerifications] = useState<VerificationRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const uidRes = await supabase.auth.getUser()
    const uid = uidRes.data.user?.id ?? null
    setCurrentUserId(uid)

    const [setRes, itemsRes] = await Promise.all([
      supabase.from('skill_assessment_settings').select('assessment_instructions').eq('skill_id', skillId).maybeSingle(),
      supabase
        .from('skill_assessment_checklist_items')
        .select('id, item_text, sort_order')
        .eq('skill_id', skillId)
        .order('sort_order', { ascending: true }),
    ])

    if (setRes.error || itemsRes.error) {
      setError(setRes.error?.message ?? itemsRes.error?.message ?? 'Failed to load assessment')
      setInstructions('')
      setItems([])
      setProgressByItem(new Map())
      setVerifications([])
      setLoading(false)
      return
    }

    setInstructions((setRes.data?.assessment_instructions as string | undefined) ?? '')
    let rows = (itemsRes.data ?? []) as ChecklistItemRow[]

    if (rows.length === 0 && skillKind === 'numeric') {
      const { error: rpcErr } = await supabase.rpc('ensure_default_skill_assessment_checklist', {
        p_skill_id: skillId,
      })
      if (!rpcErr) {
        const { data: items2, error: items2Err } = await supabase
          .from('skill_assessment_checklist_items')
          .select('id, item_text, sort_order')
          .eq('skill_id', skillId)
          .order('sort_order', { ascending: true })
        if (!items2Err && items2?.length) {
          rows = items2 as ChecklistItemRow[]
        }
      }
    }

    setItems(rows)
    const ids = rows.map((r) => r.id)

    const [progRes, verRes] = await Promise.all([
      ids.length === 0
        ? Promise.resolve({ data: [], error: null as null })
        : supabase
            .from('skill_assessment_checklist_progress')
            .select(
              'item_id, checked_at, checked_by, checker:profiles!skill_assessment_checklist_progress_checked_by_fkey(display_name)',
            )
            .eq('subject_person_id', subjectPersonId)
            .in('item_id', ids),
      supabase
        .from('skill_assessment_verifications')
        .select(
          'verified_at, verifier:profiles!skill_assessment_verifications_verified_by_fkey(display_name)',
        )
        .eq('person_id', subjectPersonId)
        .eq('skill_id', skillId)
        .order('verified_at', { ascending: false })
        .limit(20),
    ])

    if (progRes.error) {
      setError(progRes.error.message)
      setProgressByItem(new Map())
    } else {
      const m = new Map<string, ItemProgress>()
      for (const raw of progRes.data ?? []) {
        const r = raw as {
          item_id: string
          checked_at: string
          checked_by: string
          checker: unknown
        }
        if (!r.item_id) continue
        m.set(r.item_id, {
          checked_at: r.checked_at,
          checker_id: r.checked_by,
          checker_name: profileDisplayName(r.checker),
        })
      }
      setProgressByItem(m)
    }

    if (verRes.error) {
      setVerifications([])
    } else {
      setVerifications(
        (verRes.data ?? []).map((raw) => {
          const r = raw as { verified_at: string; verifier: unknown }
          return {
            verified_at: r.verified_at,
            verifier_name: profileDisplayName(r.verifier),
          }
        }),
      )
    }

    setLoading(false)
  }, [skillId, subjectPersonId, skillKind])

  useEffect(() => {
    void load()
  }, [load])

  const allChecked = useMemo(() => {
    if (items.length === 0) return false
    return items.every((it) => progressByItem.has(it.id))
  }, [items, progressByItem])

  const canVerifyNumeric =
    skillKind === 'numeric' &&
    actualLevel === 2 &&
    items.length > 0 &&
    allChecked &&
    !verifying

  async function toggleItem(itemId: string, nextChecked: boolean) {
    setError(null)
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) {
      setError('Not signed in.')
      return
    }

    const meta = progressByItem.get(itemId)
    if (nextChecked) {
      const { error: upErr } = await supabase.from('skill_assessment_checklist_progress').upsert(
        {
          subject_person_id: subjectPersonId,
          item_id: itemId,
          checked_by: uid,
          checked_at: new Date().toISOString(),
        },
        { onConflict: 'subject_person_id,item_id' },
      )
      if (upErr) {
        setError(upErr.message)
        return
      }
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle()
      const name = (prof?.display_name as string | null)?.trim() || 'You'
      setProgressByItem((prev) => {
        const n = new Map(prev)
        n.set(itemId, {
          checked_at: new Date().toISOString(),
          checker_id: uid,
          checker_name: name,
        })
        return n
      })
    } else {
      if (meta && meta.checker_id !== uid && !isAdmin) {
        setError('Only the assessor who ticked this line can clear it (or use an admin account).')
        return
      }
      const { error: delErr } = await supabase
        .from('skill_assessment_checklist_progress')
        .delete()
        .eq('subject_person_id', subjectPersonId)
        .eq('item_id', itemId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setProgressByItem((prev) => {
        const n = new Map(prev)
        n.delete(itemId)
        return n
      })
    }
  }

  async function verifyL2To3() {
    if (!canVerifyNumeric) return
    setError(null)
    setVerifying(true)
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) {
      setError('Not signed in.')
      setVerifying(false)
      return
    }

    const { data: updated, error: upErr } = await supabase
      .from('person_skills')
      .update({ actual_level: 3 })
      .eq('person_id', subjectPersonId)
      .eq('skill_id', skillId)
      .eq('actual_level', 2)
      .select('person_id, skill_id')

    if (upErr) {
      setError(upErr.message)
      setVerifying(false)
      return
    }
    if (!updated?.length) {
      setError(
        'Could not move this skill to level 3. Refresh the page — the person may not be at level 2 for this skill yet.',
      )
      setVerifying(false)
      return
    }

    const { error: verErr } = await supabase.from('skill_assessment_verifications').insert({
      person_id: subjectPersonId,
      skill_id: skillId,
      verified_by: uid,
    })
    if (verErr) {
      setError(verErr.message)
      setVerifying(false)
      return
    }

    setVerifying(false)
    onVerificationComplete()
    await load()
  }

  if (loading) {
    return <p className="text-xs text-muted">Loading assessment guidance…</p>
  }

  const hasInstructions = instructions.trim().length > 0
  const hasChecklist = items.length > 0

  if (!hasInstructions && !hasChecklist) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-canvas/40 px-3 py-2 text-xs text-muted">
        No assessment instructions or assessor checklist configured for this skill (Admin → Skill assessment).
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {hasInstructions ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Instructions for assessment</p>
          <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-canvas/50 px-3 py-2 text-sm text-fg">
            {instructions.trim()}
          </div>
        </div>
      ) : null}

      {hasChecklist ? (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Assessor checklist</p>
            {allChecked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                <CheckCircle2 className="size-3.5" aria-hidden />
                All items checked
              </span>
            ) : (
              <span className="text-[11px] text-muted">Tick every line for this person before verifying.</span>
            )}
          </div>
          <ul className="max-h-[28vh] space-y-2 overflow-auto pr-1">
            {items.map((it) => {
              const meta = progressByItem.get(it.id)
              const checked = Boolean(meta)
              const canUncheck = !meta || !currentUserId ? true : meta.checker_id === currentUserId || isAdmin
              return (
                <li key={it.id}>
                  <div className="rounded-lg border border-border bg-surface px-2.5 py-2 text-sm">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 shrink-0 accent-accent"
                        checked={checked}
                        disabled={checked && !canUncheck}
                        onChange={(e) => void toggleItem(it.id, e.target.checked)}
                      />
                      <span className="text-fg">{it.item_text}</span>
                    </label>
                    {meta ? (
                      <p className="mt-1.5 pl-6 text-[11px] text-muted">
                        Checked by <span className="font-medium text-fg/90">{meta.checker_name}</span>
                        {' · '}
                        {formatTs(meta.checked_at)}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>

          {skillKind === 'numeric' ? (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {actualLevel !== 2 ? (
                <p className="text-[11px] text-muted">
                  Verify is available when this skill is at <strong className="text-fg/90">level 2</strong> for this person
                  (current: {actualLevel ?? '—'}).
                </p>
              ) : null}
              <button
                type="button"
                disabled={!canVerifyNumeric}
                onClick={() => void verifyL2To3()}
                className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {verifying ? 'Verifying…' : 'Verify (move skill to level 3)'}
              </button>
              <p className="text-[11px] text-muted">
                Records who verified and when; updating the matrix triggers the usual L2→3 progression log.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {verifications.length > 0 ? (
        <div className="rounded-lg border border-border bg-canvas/40 px-3 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Verification history</p>
          <ul className="space-y-1.5 text-[11px] text-muted">
            {verifications.map((v, i) => (
              <li key={`${v.verified_at}-${i}`}>
                <span className="font-medium text-fg/90">{v.verifier_name}</span>
                {' · '}
                {formatTs(v.verified_at)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
