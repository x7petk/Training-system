import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type ChecklistItemRow = { id: string; item_text: string; sort_order: number }

type Props = {
  skillId: string
}

/** Staff (admin or assessor): read assessment instructions + persist personal checklist ticks. */
export function AssessorAssessmentSection(props: Props) {
  const { skillId } = props
  const [loading, setLoading] = useState(true)
  const [instructions, setInstructions] = useState('')
  const [items, setItems] = useState<ChecklistItemRow[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [setRes, itemsRes, uidRes] = await Promise.all([
      supabase.from('skill_assessment_settings').select('assessment_instructions').eq('skill_id', skillId).maybeSingle(),
      supabase
        .from('skill_assessment_checklist_items')
        .select('id, item_text, sort_order')
        .eq('skill_id', skillId)
        .order('sort_order', { ascending: true }),
      supabase.auth.getUser(),
    ])
    const uid = uidRes.data.user?.id
    if (setRes.error || itemsRes.error) {
      setError(setRes.error?.message ?? itemsRes.error?.message ?? 'Failed to load assessment')
      setInstructions('')
      setItems([])
      setCheckedIds(new Set())
      setLoading(false)
      return
    }
    setInstructions((setRes.data?.assessment_instructions as string | undefined) ?? '')
    const rows = (itemsRes.data ?? []) as ChecklistItemRow[]
    setItems(rows)

    if (!uid || rows.length === 0) {
      setCheckedIds(new Set())
      setLoading(false)
      return
    }
    const ids = rows.map((r) => r.id)
    const progRes = await supabase
      .from('skill_assessment_checklist_progress')
      .select('item_id')
      .eq('user_id', uid)
      .in('item_id', ids)
    if (progRes.error) {
      setError(progRes.error.message)
      setCheckedIds(new Set())
      setLoading(false)
      return
    }
    const next = new Set<string>()
    for (const row of progRes.data ?? []) {
      const id = (row as { item_id: string }).item_id
      if (id) next.add(id)
    }
    setCheckedIds(next)
    setLoading(false)
  }, [skillId])

  useEffect(() => {
    void load()
  }, [load])

  const allChecked = useMemo(() => {
    if (items.length === 0) return false
    return items.every((it) => checkedIds.has(it.id))
  }, [items, checkedIds])

  async function toggleItem(itemId: string, nextChecked: boolean) {
    setError(null)
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) {
      setError('Not signed in.')
      return
    }
    if (nextChecked) {
      const { error: insErr } = await supabase.from('skill_assessment_checklist_progress').insert({
        user_id: uid,
        item_id: itemId,
      })
      if (insErr) {
        setError(insErr.message)
        return
      }
      setCheckedIds((prev) => new Set(prev).add(itemId))
    } else {
      const { error: delErr } = await supabase
        .from('skill_assessment_checklist_progress')
        .delete()
        .eq('user_id', uid)
        .eq('item_id', itemId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setCheckedIds((prev) => {
        const n = new Set(prev)
        n.delete(itemId)
        return n
      })
    }
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
              <span className="text-[11px] text-muted">Complete every item to qualify on this screen.</span>
            )}
          </div>
          <ul className="max-h-[28vh] space-y-2 overflow-auto pr-1">
            {items.map((it) => {
              const checked = checkedIds.has(it.id)
              return (
                <li key={it.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm hover:bg-black/[0.03]">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-accent"
                      checked={checked}
                      onChange={(e) => void toggleItem(it.id, e.target.checked)}
                    />
                    <span className="text-fg">{it.item_text}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
