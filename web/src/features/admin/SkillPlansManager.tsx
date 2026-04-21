import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type PlanSkill = { id: string; name: string; skill_groups: { name: string } | { name: string }[] | null }
type Stage = {
  id: string
  plan_skill_id: string
  stage_no: number
  name: string
  duration_months: number
  sort_order: number
}
type StageKnowledge = { stage_id: string; knowledge_skill_id: string }
type KnowledgeSkill = { id: string; name: string; kind: 'numeric' | 'certification' | 'plan' }

function groupName(v: PlanSkill['skill_groups']): string {
  if (!v) return 'Skills'
  return Array.isArray(v) ? (v[0]?.name ?? 'Skills') : v.name
}

export function SkillPlansManager() {
  const [plans, setPlans] = useState<PlanSkill[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [links, setLinks] = useState<StageKnowledge[]>([])
  const [knowledges, setKnowledges] = useState<KnowledgeSkill[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addKnowledgeByStage, setAddKnowledgeByStage] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    const [pl, st, lk, kn] = await Promise.all([
      supabase
        .from('skills')
        .select('id, name, skill_groups(name)')
        .eq('kind', 'plan')
        .order('sort_order', { ascending: true }),
      supabase
        .from('skill_plan_stages')
        .select('id, plan_skill_id, stage_no, name, duration_months, sort_order')
        .order('sort_order', { ascending: true }),
      supabase.from('skill_plan_stage_knowledges').select('stage_id, knowledge_skill_id'),
      supabase.from('skills').select('id, name, kind').eq('kind', 'numeric').order('sort_order', { ascending: true }),
    ])

    if (pl.error) {
      setError(pl.error.message)
      setPlans([])
    } else {
      setPlans((pl.data ?? []) as PlanSkill[])
    }
    if (!st.error && st.data) setStages(st.data as Stage[])
    else setStages([])
    if (!lk.error && lk.data) setLinks(lk.data as StageKnowledge[])
    else setLinks([])
    if (!kn.error && kn.data) setKnowledges(kn.data as KnowledgeSkill[])
    else setKnowledges([])

    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => {
      void fetchData()
    })
  }, [fetchData])

  useEffect(() => {
    if (!plans.length) {
      queueMicrotask(() => setSelectedPlanId(''))
      return
    }
    if (!selectedPlanId || !plans.some((p) => p.id === selectedPlanId)) {
      queueMicrotask(() => setSelectedPlanId(plans[0].id))
    }
  }, [plans, selectedPlanId])

  const selectedStages = useMemo(
    () => stages.filter((s) => s.plan_skill_id === selectedPlanId).sort((a, b) => a.stage_no - b.stage_no),
    [stages, selectedPlanId],
  )

  const knowledgeByStage = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const row of links) {
      const arr = m.get(row.stage_id) ?? []
      arr.push(row.knowledge_skill_id)
      m.set(row.stage_id, arr)
    }
    return m
  }, [links])

  const linkedKnowledgeIdsInPlan = useMemo(() => {
    const stageIds = new Set(selectedStages.map((s) => s.id))
    const ids = new Set<string>()
    for (const row of links) {
      if (stageIds.has(row.stage_id)) ids.add(row.knowledge_skill_id)
    }
    return ids
  }, [selectedStages, links])

  const knowledgeLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of knowledges) m.set(k.id, k.name)
    return m
  }, [knowledges])

  async function updateStage(stageId: string, patch: Partial<Pick<Stage, 'name' | 'duration_months'>>) {
    setError(null)
    const { error: upErr } = await supabase.from('skill_plan_stages').update(patch).eq('id', stageId)
    if (upErr) {
      setError(upErr.message)
      return
    }
    await fetchData()
  }

  async function addStage() {
    if (!selectedPlanId) return
    const nextNo = selectedStages.length > 0 ? Math.max(...selectedStages.map((s) => s.stage_no)) + 1 : 1
    setError(null)
    const { error: insErr } = await supabase.from('skill_plan_stages').insert({
      plan_skill_id: selectedPlanId,
      stage_no: nextNo,
      name: `Stage ${nextNo}`,
      duration_months: 3,
      sort_order: nextNo,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    await fetchData()
  }

  async function removeStage(stageId: string) {
    if (!window.confirm('Delete this stage and its knowledge mapping?')) return
    setError(null)
    const { error: delErr } = await supabase.from('skill_plan_stages').delete().eq('id', stageId)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await fetchData()
  }

  async function addKnowledge(stageId: string, e: FormEvent) {
    e.preventDefault()
    const skillId = addKnowledgeByStage[stageId]
    if (!skillId) return
    setError(null)
    const { error: insErr } = await supabase
      .from('skill_plan_stage_knowledges')
      .insert({ stage_id: stageId, knowledge_skill_id: skillId })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setAddKnowledgeByStage((prev) => ({ ...prev, [stageId]: '' }))
    await fetchData()
  }

  async function removeKnowledge(stageId: string, skillId: string) {
    setError(null)
    const { error: delErr } = await supabase
      .from('skill_plan_stage_knowledges')
      .delete()
      .eq('stage_id', stageId)
      .eq('knowledge_skill_id', skillId)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await fetchData()
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Skill plans</h2>
          <p className="text-xs text-muted">Configure staged knowledge flow (duration + assigned knowledges).</p>
        </div>
        <button
          type="button"
          onClick={() => void addStage()}
          disabled={!selectedPlanId}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add stage
        </button>
      </div>

      <div className="space-y-4 p-4">
        {error ? (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Plan skill</span>
          <select
            className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none"
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {groupName(p.skill_groups)} · {p.name}
              </option>
            ))}
          </select>
        </label>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : selectedStages.length === 0 ? (
          <p className="text-sm text-muted">No stages for this plan yet.</p>
        ) : (
          <div className="space-y-3">
            {selectedStages.map((stage) => {
              const linkedSkillIds = knowledgeByStage.get(stage.id) ?? []
              const available = knowledges.filter((k) => !linkedKnowledgeIdsInPlan.has(k.id))
              return (
                <article key={stage.id} className="rounded-xl border border-border bg-surface p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Stage name</span>
                      <input
                        defaultValue={stage.name}
                        onBlur={(e) => void updateStage(stage.id, { name: e.target.value.trim() || stage.name })}
                        className="w-full rounded-lg border border-border bg-canvas/70 px-2.5 py-2 text-sm outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted">Months</span>
                      <input
                        type="number"
                        min={0}
                        max={36}
                        defaultValue={stage.duration_months}
                        onBlur={(e) => {
                          const n = Number.parseInt(e.target.value, 10)
                          if (!Number.isFinite(n)) return
                          void updateStage(stage.id, { duration_months: Math.max(0, Math.min(36, n)) })
                        }}
                        className="w-full rounded-lg border border-border bg-canvas/70 px-2.5 py-2 text-sm outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void removeStage(stage.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Knowledges</p>
                    {linkedSkillIds.length === 0 ? (
                      <p className="text-xs text-muted">No skills assigned to this stage.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedSkillIds.map((sid) => (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => void removeKnowledge(stage.id, sid)}
                            className="rounded-full border border-border bg-canvas/60 px-2 py-0.5 text-xs text-fg hover:border-danger/40 hover:text-danger"
                            title="Remove from stage"
                          >
                            {knowledgeLabelById.get(sid) ?? sid}
                          </button>
                        ))}
                      </div>
                    )}
                    <form onSubmit={(e) => void addKnowledge(stage.id, e)} className="flex gap-2">
                      <select
                        value={addKnowledgeByStage[stage.id] ?? ''}
                        onChange={(e) => setAddKnowledgeByStage((prev) => ({ ...prev, [stage.id]: e.target.value }))}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-canvas/70 px-2.5 py-2 text-sm outline-none"
                      >
                        <option value="">Add knowledge…</option>
                        {available.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!addKnowledgeByStage[stage.id]}
                        className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
