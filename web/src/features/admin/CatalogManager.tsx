import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Layers, ListChecks, Pencil, Plus, Tag, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { addMonths, localYMD, startOfDay } from '../../lib/dueDateUtils'
import { classifyCell, type SkillKind } from '../matrix/gapLogic'
import type { CatalogManagerSection } from './adminNavConfig'

type SkillGroupRow = { id: string; name: string; sort_order: number }
type SkillRow = {
  id: string
  name: string
  kind: SkillKind
  sort_order: number
  skill_group_id: string | null
  skill_groups: { id: string; name: string } | null
}
type RoleRow = { id: string; name: string; sort_order: number }
type RsrRow = { role_id: string; skill_id: string; required_level: number }
type PlanKnowledgeLinkRow = {
  knowledge_skill_id: string
  skill_plan_stages:
    | { plan_skill_id: string; stage_no: number }
    | { plan_skill_id: string; stage_no: number }[]
    | null
}
type PersonRoleRow = { person_id: string }
type PersonSkillSeedRow = {
  person_id: string
  skill_id: string
  actual_level: number | null
  is_extra: boolean
  due_date: string | null
}

type GroupForm = { name: string; sort_order: string }
type SkillForm = {
  name: string
  kind: SkillKind
  sort_order: string
  skill_group_id: string
}
type RoleForm = { name: string; sort_order: string }

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

export function CatalogManager({ activeSection }: { activeSection: CatalogManagerSection }) {
  const groupDialogRef = useRef<HTMLDialogElement>(null)
  const skillDialogRef = useRef<HTMLDialogElement>(null)
  const roleDialogRef = useRef<HTMLDialogElement>(null)

  const [groups, setGroups] = useState<SkillGroupRow[]>([])
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [rsr, setRsr] = useState<RsrRow[]>([])
  const [planKnowledgeLinks, setPlanKnowledgeLinks] = useState<PlanKnowledgeLinkRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [groupForm, setGroupForm] = useState<GroupForm>({ name: '', sort_order: '0' })
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)

  const [editingSkillId, setEditingSkillId] = useState<string | null>(null)
  const [skillForm, setSkillForm] = useState<SkillForm>({
    name: '',
    kind: 'numeric',
    sort_order: '0',
    skill_group_id: '',
  })
  const [skillDialogOpen, setSkillDialogOpen] = useState(false)

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [roleForm, setRoleForm] = useState<RoleForm>({ name: '', sort_order: '0' })
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)

  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [newRsrSkillId, setNewRsrSkillId] = useState<string>('')
  const [newRsrLevel, setNewRsrLevel] = useState<string>('3')
  const [collapsedPlanIds, setCollapsedPlanIds] = useState<Set<string>>(() => new Set())

  const fetchAll = useCallback(async () => {
    const [gRes, sRes, rRes, xRes, pkRes] = await Promise.all([
      supabase.from('skill_groups').select('id, name, sort_order').order('sort_order', { ascending: true }),
      supabase
        .from('skills')
        .select('id, name, kind, sort_order, skill_group_id, skill_groups ( id, name )')
        .order('sort_order', { ascending: true }),
      supabase.from('roles').select('id, name, sort_order').order('sort_order', { ascending: true }),
      supabase.from('role_skill_requirements').select('role_id, skill_id, required_level'),
      supabase
        .from('skill_plan_stage_knowledges')
        .select('knowledge_skill_id, skill_plan_stages(plan_skill_id, stage_no)'),
    ])

    if (gRes.error) {
      setError(gRes.error.message)
      setGroups([])
    } else {
      setGroups((gRes.data ?? []) as SkillGroupRow[])
    }
    if (sRes.error) {
      setError(sRes.error.message)
      setSkills([])
    } else {
      setSkills((sRes.data ?? []) as unknown as SkillRow[])
    }
    if (rRes.error) {
      setRoles([])
    } else {
      setRoles((rRes.data ?? []) as RoleRow[])
    }
    if (!xRes.error && xRes.data) setRsr(xRes.data as RsrRow[])
    else if (xRes.error) setRsr([])
    if (!pkRes.error && pkRes.data) setPlanKnowledgeLinks(pkRes.data as PlanKnowledgeLinkRow[])
    else setPlanKnowledgeLinks([])

    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      void fetchAll()
    })
    return () => {
      cancelled = true
    }
  }, [fetchAll])

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (roles.length === 0) {
        if (selectedRoleId !== '') setSelectedRoleId('')
        return
      }
      const ok = roles.some((r) => r.id === selectedRoleId)
      if (!ok) setSelectedRoleId(roles[0].id)
    })
  }, [roles, selectedRoleId])

  const rsrForRole = useMemo(
    () => rsr.filter((x) => x.role_id === selectedRoleId),
    [rsr, selectedRoleId],
  )

  const skillById = useMemo(() => {
    const m = new Map<string, SkillRow>()
    for (const s of skills) m.set(s.id, s)
    return m
  }, [skills])

  const skillsAvailableForRsr = useMemo(() => {
    const taken = new Set(rsrForRole.map((x) => x.skill_id))
    return skills.filter((s) => !taken.has(s.id))
  }, [skills, rsrForRole])

  const skillRowsByPlan = useMemo(() => {
    const planNameById = new Map(skills.filter((s) => s.kind === 'plan').map((s) => [s.id, s.name]))
    const stagesByKnowledge = new Map<string, { planId: string; stageNo: number }[]>()
    for (const row of planKnowledgeLinks) {
      const embed = row.skill_plan_stages
      const stage = Array.isArray(embed) ? embed[0] : embed
      if (!stage?.plan_skill_id) continue
      const arr = stagesByKnowledge.get(row.knowledge_skill_id) ?? []
      arr.push({ planId: stage.plan_skill_id, stageNo: stage.stage_no })
      stagesByKnowledge.set(row.knowledge_skill_id, arr)
    }

    const planSkills = skills
      .filter((s) => s.kind === 'plan')
      .sort((a, b) => (a.sort_order === b.sort_order ? a.name.localeCompare(b.name) : a.sort_order - b.sort_order))

    const childrenByPlan = new Map<string, Array<{ skill: SkillRow; stages: number[] }>>()
    for (const s of skills) {
      if (s.kind === 'plan') continue
      const links = stagesByKnowledge.get(s.id) ?? []
      if (links.length === 0) continue
      const byPlan = new Map<string, number[]>()
      for (const l of links) {
        const arr = byPlan.get(l.planId) ?? []
        arr.push(l.stageNo)
        byPlan.set(l.planId, arr)
      }
      for (const [planId, stageNos] of byPlan.entries()) {
        if (!planNameById.has(planId)) continue
        const rows = childrenByPlan.get(planId) ?? []
        const deduped = Array.from(new Set(stageNos)).sort((a, b) => a - b)
        rows.push({ skill: s, stages: deduped })
        childrenByPlan.set(planId, rows)
      }
    }

    for (const [pid, rows] of childrenByPlan.entries()) {
      rows.sort((a, b) =>
        a.skill.sort_order === b.skill.sort_order
          ? a.skill.name.localeCompare(b.skill.name)
          : a.skill.sort_order - b.skill.sort_order,
      )
      childrenByPlan.set(pid, rows)
    }

    const knowledgeIds = new Set<string>()
    for (const rows of childrenByPlan.values()) {
      for (const row of rows) knowledgeIds.add(row.skill.id)
    }
    const ungroupedSkills = skills
      .filter((s) => s.kind !== 'plan' && !knowledgeIds.has(s.id))
      .sort((a, b) => (a.sort_order === b.sort_order ? a.name.localeCompare(b.name) : a.sort_order - b.sort_order))

    return { planSkills, childrenByPlan, ungroupedSkills }
  }, [skills, planKnowledgeLinks])

  function togglePlanCollapse(planId: string) {
    setCollapsedPlanIds((prev) => {
      const next = new Set(prev)
      if (next.has(planId)) next.delete(planId)
      else next.add(planId)
      return next
    })
  }

  function closeGroupDialog() {
    groupDialogRef.current?.close()
    setGroupDialogOpen(false)
    setEditingGroupId(null)
    setGroupForm({ name: '', sort_order: '0' })
  }

  function closeSkillDialog() {
    skillDialogRef.current?.close()
    setSkillDialogOpen(false)
    setEditingSkillId(null)
    setSkillForm({ name: '', kind: 'numeric', sort_order: '0', skill_group_id: '' })
  }

  function closeRoleDialog() {
    roleDialogRef.current?.close()
    setRoleDialogOpen(false)
    setEditingRoleId(null)
    setRoleForm({ name: '', sort_order: '0' })
  }

  function openCreateGroup() {
    setEditingGroupId(null)
    setGroupForm({ name: '', sort_order: String(groups.length > 0 ? Math.max(...groups.map((g) => g.sort_order)) + 1 : 0) })
    setError(null)
    setGroupDialogOpen(true)
    groupDialogRef.current?.showModal()
  }

  function openEditGroup(row: SkillGroupRow) {
    setEditingGroupId(row.id)
    setGroupForm({ name: row.name, sort_order: String(row.sort_order) })
    setError(null)
    setGroupDialogOpen(true)
    groupDialogRef.current?.showModal()
  }

  async function submitGroup(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const sort = Number.parseInt(groupForm.sort_order, 10)
    const sort_order = Number.isFinite(sort) ? sort : 0
    let err: { message: string } | null = null
    if (editingGroupId) {
      const r = await supabase
        .from('skill_groups')
        .update({ name: groupForm.name.trim(), sort_order })
        .eq('id', editingGroupId)
      err = r.error
    } else {
      const r = await supabase.from('skill_groups').insert({
        name: groupForm.name.trim(),
        sort_order,
      })
      err = r.error
    }
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    closeGroupDialog()
    setLoading(true)
    await fetchAll()
  }

  async function deleteGroup(row: SkillGroupRow) {
    if (!window.confirm(`Delete group “${row.name}”? Skills stay but become ungrouped.`)) return
    setError(null)
    const { error: err } = await supabase.from('skill_groups').delete().eq('id', row.id)
    if (err) setError(err.message)
    else void fetchAll()
  }

  function openCreateSkill() {
    setEditingSkillId(null)
    setSkillForm({
      name: '',
      kind: 'numeric',
      sort_order: String(skills.length > 0 ? Math.max(...skills.map((s) => s.sort_order)) + 1 : 0),
      skill_group_id: groups[0]?.id ?? '',
    })
    setError(null)
    setSkillDialogOpen(true)
    skillDialogRef.current?.showModal()
  }

  function openEditSkill(row: SkillRow) {
    setEditingSkillId(row.id)
    setSkillForm({
      name: row.name,
      kind: row.kind,
      sort_order: String(row.sort_order),
      skill_group_id: row.skill_group_id ?? '',
    })
    setError(null)
    setSkillDialogOpen(true)
    skillDialogRef.current?.showModal()
  }

  async function submitSkill(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const sort = Number.parseInt(skillForm.sort_order, 10)
    const sort_order = Number.isFinite(sort) ? sort : 0
    const gid = skillForm.skill_group_id.trim() || null
    if (skillForm.kind === 'plan' && gid == null) {
      setSaving(false)
      setError('Plan skills must belong to a skill group.')
      return
    }
    let err: { message: string } | null = null
    if (editingSkillId) {
      const r = await supabase
        .from('skills')
        .update({
          name: skillForm.name.trim(),
          kind: skillForm.kind,
          sort_order,
          skill_group_id: gid,
        })
        .eq('id', editingSkillId)
      err = r.error
    } else {
      const r = await supabase.from('skills').insert({
        name: skillForm.name.trim(),
        kind: skillForm.kind,
        sort_order,
        skill_group_id: gid,
      })
      err = r.error
    }
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    closeSkillDialog()
    setLoading(true)
    await fetchAll()
  }

  async function deleteSkill(row: SkillRow) {
    if (
      !window.confirm(
        `Delete skill “${row.name}”? This removes role requirements and person skill cells for it.`,
      )
    )
      return
    setError(null)
    const { error: err } = await supabase.from('skills').delete().eq('id', row.id)
    if (err) setError(err.message)
    else void fetchAll()
  }

  function openCreateRole() {
    setEditingRoleId(null)
    setRoleForm({
      name: '',
      sort_order: String(roles.length > 0 ? Math.max(...roles.map((r) => r.sort_order)) + 1 : 0),
    })
    setError(null)
    setRoleDialogOpen(true)
    roleDialogRef.current?.showModal()
  }

  function openEditRole(row: RoleRow) {
    setEditingRoleId(row.id)
    setRoleForm({ name: row.name, sort_order: String(row.sort_order) })
    setError(null)
    setRoleDialogOpen(true)
    roleDialogRef.current?.showModal()
  }

  async function submitRole(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const sort = Number.parseInt(roleForm.sort_order, 10)
    const sort_order = Number.isFinite(sort) ? sort : 0
    let err: { message: string } | null = null
    if (editingRoleId) {
      const r = await supabase
        .from('roles')
        .update({ name: roleForm.name.trim(), sort_order })
        .eq('id', editingRoleId)
      err = r.error
    } else {
      const r = await supabase.from('roles').insert({
        name: roleForm.name.trim(),
        sort_order,
      })
      err = r.error
    }
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    closeRoleDialog()
    setLoading(true)
    await fetchAll()
  }

  async function deleteRole(row: RoleRow) {
    if (
      !window.confirm(
        `Delete job role “${row.name}”? People lose this role link; requirements for this role are removed.`,
      )
    )
      return
    setError(null)
    const { error: err } = await supabase.from('roles').delete().eq('id', row.id)
    if (err) setError(err.message)
    else void fetchAll()
  }

  async function updateRsrLevel(skillId: string, level: number) {
    if (level < 0 || level > 4 || !Number.isFinite(level)) return
    setError(null)
    const { error: err } = await supabase
      .from('role_skill_requirements')
      .update({ required_level: level })
      .eq('role_id', selectedRoleId)
      .eq('skill_id', skillId)
    if (err) setError(err.message)
    else void fetchAll()
  }

  async function addRsr(e: FormEvent) {
    e.preventDefault()
    if (!selectedRoleId || !newRsrSkillId) return
    const lv = Number.parseInt(newRsrLevel, 10)
    const required_level = Number.isFinite(lv) ? Math.min(4, Math.max(0, lv)) : 3
    setError(null)
    const { error: err } = await supabase.from('role_skill_requirements').insert({
      role_id: selectedRoleId,
      skill_id: newRsrSkillId,
      required_level,
    })
    if (err) {
      setError(err.message)
      return
    }

    const skillKind = skillById.get(newRsrSkillId)?.kind ?? 'numeric'
    const targetDate = localYMD(addMonths(startOfDay(new Date()), 3))
    const rolePeopleRes = await supabase.from('person_roles').select('person_id').eq('role_id', selectedRoleId)
    if (rolePeopleRes.error) {
      setError(rolePeopleRes.error.message)
      return
    }

    const personIds = ((rolePeopleRes.data ?? []) as PersonRoleRow[]).map((x) => x.person_id)
    if (personIds.length > 0) {
      const existingRes = await supabase
        .from('person_skills')
        .select('person_id, skill_id, actual_level, is_extra, due_date')
        .eq('skill_id', newRsrSkillId)
        .in('person_id', personIds)
      if (existingRes.error) {
        setError(existingRes.error.message)
        return
      }

      const existingByPerson = new Map<string, PersonSkillSeedRow>()
      for (const row of (existingRes.data ?? []) as PersonSkillSeedRow[]) {
        existingByPerson.set(row.person_id, row)
      }

      const payload = personIds.map((personId) => {
        const existing = existingByPerson.get(personId)
        const actual = existing?.actual_level ?? 1
        const gap = classifyCell({
          kind: skillKind,
          required: required_level,
          actual,
          isExtra: false,
        })
        const due_date =
          existing?.due_date?.trim() ||
          (gap === 'critical' || gap === 'minor' ? targetDate : null)

        return {
          person_id: personId,
          skill_id: newRsrSkillId,
          actual_level: actual,
          is_extra: false,
          due_date,
        }
      })

      const { error: seedErr } = await supabase.from('person_skills').upsert(payload, {
        onConflict: 'person_id,skill_id',
      })
      if (seedErr) {
        setError(seedErr.message)
        return
      }
    }

    setNewRsrSkillId('')
    setNewRsrLevel('3')
    void fetchAll()
  }

  async function deleteRsr(skillId: string, label: string) {
    if (!window.confirm(`Remove requirement for “${label}” from this role?`)) return
    setError(null)
    const { error: err } = await supabase
      .from('role_skill_requirements')
      .delete()
      .eq('role_id', selectedRoleId)
      .eq('skill_id', skillId)
    if (err) setError(err.message)
    else void fetchAll()
  }

  const showGlobalError = error && !groupDialogOpen && !skillDialogOpen && !roleDialogOpen

  return (
    <div className="space-y-6">
      {showGlobalError ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {/* Skill groups */}
      {activeSection === 'skill-groups' ? (
      <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-accent" aria-hidden />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Skill groups</h2>
              <p className="text-xs text-muted">Organize skills in the matrix column headers.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateGroup}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus className="size-4" />
            Add group
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No groups yet.</p>
          ) : (
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 w-24">Sort</th>
                  <th className="px-4 py-3 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groups.map((row) => (
                  <tr key={row.id} className="hover:bg-black/[0.04]">
                    <td className="px-4 py-3 font-medium text-fg">{row.name}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{row.sort_order}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditGroup(row)}
                          className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteGroup(row)}
                          className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      ) : null}

      {/* Skills */}
      {activeSection === 'skills' ? (
      <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-accent" aria-hidden />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Skills</h2>
              <p className="text-xs text-muted">Numeric (1–4 scale) or certification (yes/no in the matrix).</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateSkill}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus className="size-4" />
            Add skill
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : skills.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No skills yet.</p>
          ) : (
            <div className="space-y-4 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Plan skills and knowledges</p>
                <div className="space-y-2">
                  {skillRowsByPlan.planSkills.map((plan) => {
                    const rows = skillRowsByPlan.childrenByPlan.get(plan.id) ?? []
                    const collapsed = collapsedPlanIds.has(plan.id)
                    const rowsByStage = new Map<number, Array<{ skill: SkillRow; stages: number[] }>>()
                    for (const row of rows) {
                      for (const stageNo of row.stages) {
                        const arr = rowsByStage.get(stageNo) ?? []
                        arr.push(row)
                        rowsByStage.set(stageNo, arr)
                      }
                    }
                    const orderedStages = Array.from(rowsByStage.keys()).sort((a, b) => a - b)
                    return (
                      <article key={plan.id} className="rounded-xl border border-border bg-surface p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-fg">{plan.name}</p>
                              <button
                                type="button"
                                onClick={() => togglePlanCollapse(plan.id)}
                                className="shrink-0 rounded-full border border-border bg-canvas/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted hover:bg-canvas"
                                aria-expanded={!collapsed}
                                aria-label={`${collapsed ? 'Show' : 'Hide'} knowledges for ${plan.name}`}
                              >
                                {rows.length} knowledges · {collapsed ? 'show' : 'hide'}
                              </button>
                            </div>
                            <p className="text-xs text-muted">
                              {plan.skill_groups?.name ?? '—'} · plan · sort {plan.sort_order}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditSkill(plan)}
                              className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
                              aria-label={`Edit ${plan.name}`}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteSkill(plan)}
                              className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                              aria-label={`Delete ${plan.name}`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                        {collapsed ? null : (
                          <div className="mt-3 space-y-1.5">
                            {rows.length === 0 ? (
                              <p className="text-xs text-muted">No knowledges linked yet.</p>
                            ) : (
                              orderedStages.map((stageNo) => {
                                const stageRows = rowsByStage.get(stageNo) ?? []
                                return (
                                  <div key={`${plan.id}:stage:${stageNo}`} className="rounded-lg border border-border/70 bg-canvas/40 p-2">
                                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Stage {stageNo}</p>
                                    <div className="space-y-1.5">
                                      {stageRows.map(({ skill, stages }) => (
                                        <div key={`${plan.id}:${stageNo}:${skill.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-canvas/60 px-2.5 py-2">
                                          <div className="min-w-0 pl-4">
                                            <p className="truncate text-sm font-medium text-fg">{skill.name}</p>
                                            <p className="text-xs text-muted">
                                              knowledge · {skill.kind} · stages {stages.join(', ')} · sort {skill.sort_order}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => openEditSkill(skill)}
                                              className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
                                              aria-label={`Edit ${skill.name}`}
                                            >
                                              <Pencil className="size-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => void deleteSkill(skill)}
                                              className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                                              aria-label={`Delete ${skill.name}`}
                                            >
                                              <Trash2 className="size-4" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Other skills</p>
                {skillRowsByPlan.ungroupedSkills.length === 0 ? (
                  <p className="text-xs text-muted">All non-plan skills are linked as plan knowledges.</p>
                ) : (
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Group</th>
                        <th className="px-3 py-2">Kind</th>
                        <th className="px-3 py-2 w-20">Sort</th>
                        <th className="px-3 py-2 w-28 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {skillRowsByPlan.ungroupedSkills.map((row) => (
                        <tr key={row.id} className="hover:bg-black/[0.04]">
                          <td className="px-3 py-2 font-medium text-fg">{row.name}</td>
                          <td className="px-3 py-2 text-muted">{row.skill_groups?.name ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-lg bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent">{row.kind}</span>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted">{row.sort_order}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditSkill(row)}
                                className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
                                aria-label={`Edit ${row.name}`}
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteSkill(row)}
                                className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                                aria-label={`Delete ${row.name}`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      ) : null}

      {/* Job roles */}
      {activeSection === 'job-roles' ? (
      <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-accent" aria-hidden />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Job roles</h2>
              <p className="text-xs text-muted">Assign to people on the roster; drive required levels below.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateRole}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus className="size-4" />
            Add role
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : roles.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No job roles yet.</p>
          ) : (
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 w-24">Sort</th>
                  <th className="px-4 py-3 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roles.map((row) => (
                  <tr key={row.id} className="hover:bg-black/[0.04]">
                    <td className="px-4 py-3 font-medium text-fg">{row.name}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{row.sort_order}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditRole(row)}
                          className="rounded-lg p-2 text-muted hover:bg-black/[0.06] hover:text-fg"
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteRole(row)}
                          className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      ) : null}

      {/* Requirements */}
      {activeSection === 'role-requirements' ? (
      <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="size-5 text-accent" aria-hidden />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Role skill requirements</h2>
              <p className="text-xs text-muted">Required level per skill for each job role (0–4).</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">Role</span>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className={`${inputClass} max-w-[16rem]`}
              disabled={roles.length === 0}
            >
              {roles.length === 0 ? <option value="">No roles</option> : null}
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {roles.length === 0 || !selectedRoleId ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Add a job role first.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Skill</th>
                    <th className="px-4 py-3">Kind</th>
                    <th className="px-4 py-3 w-36">Required level</th>
                    <th className="px-4 py-3 w-20 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rsrForRole.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted">
                        No requirements for this role yet.
                      </td>
                    </tr>
                  ) : (
                    rsrForRole.map((x) => {
                      const sk = skillById.get(x.skill_id)
                      const label = sk?.name ?? x.skill_id.slice(0, 8)
                      return (
                        <tr key={x.skill_id} className="hover:bg-black/[0.04]">
                          <td className="px-4 py-3 font-medium text-fg">{label}</td>
                          <td className="px-4 py-3">
                            {sk ? (
                              <span className="rounded-lg bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent">
                                {sk.kind}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              max={4}
                              defaultValue={x.required_level}
                              key={`${x.role_id}-${x.skill_id}-${x.required_level}`}
                              onBlur={(e) => {
                                const v = Number.parseInt(e.target.value, 10)
                                if (!Number.isFinite(v) || v < 0 || v > 4) return
                                if (v !== x.required_level) void updateRsrLevel(x.skill_id, v)
                              }}
                              className="w-20 rounded-lg border border-border bg-canvas/60 px-2 py-1.5 text-sm tabular-nums outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void deleteRsr(x.skill_id, label)}
                              className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                              aria-label={`Remove ${label}`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => void addRsr(e)}
              className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="min-w-0 flex-1 sm:max-w-xs">
                <label htmlFor="rsr-skill" className="mb-1 block text-xs font-medium text-muted">
                  Add skill
                </label>
                <select
                  id="rsr-skill"
                  value={newRsrSkillId}
                  onChange={(e) => setNewRsrSkillId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose skill…</option>
                  {skillsAvailableForRsr.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label htmlFor="rsr-lv" className="mb-1 block text-xs font-medium text-muted">
                  Level
                </label>
                <input
                  id="rsr-lv"
                  type="number"
                  min={0}
                  max={4}
                  value={newRsrLevel}
                  onChange={(e) => setNewRsrLevel(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={!newRsrSkillId}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
              >
                Add requirement
              </button>
            </form>
          </>
        )}
      </section>
      ) : null}

      {/* Dialog: skill group */}
      <dialog
        ref={groupDialogRef}
        className="w-[min(100%,28rem)] rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow backdrop:bg-black/30"
        onClose={() => {
          setGroupDialogOpen(false)
          setEditingGroupId(null)
          setGroupForm({ name: '', sort_order: '0' })
        }}
      >
        <form onSubmit={(e) => void submitGroup(e)} className="p-6">
          <h3 className="font-display text-lg font-semibold">{editingGroupId ? 'Edit group' : 'Add group'}</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="cg-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Name
              </label>
              <input
                id="cg-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="cg-sort" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Sort order
              </label>
              <input
                id="cg-sort"
                type="number"
                value={groupForm.sort_order}
                onChange={(e) => setGroupForm((f) => ({ ...f, sort_order: e.target.value }))}
                className={inputClass}
              />
            </div>
            {error && groupDialogOpen ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeGroupDialog}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingGroupId ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </dialog>

      {/* Dialog: skill */}
      <dialog
        ref={skillDialogRef}
        className="w-[min(100%,28rem)] rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow backdrop:bg-black/30"
        onClose={() => {
          setSkillDialogOpen(false)
          setEditingSkillId(null)
          setSkillForm({ name: '', kind: 'numeric', sort_order: '0', skill_group_id: '' })
        }}
      >
        <form onSubmit={(e) => void submitSkill(e)} className="p-6">
          <h3 className="font-display text-lg font-semibold">{editingSkillId ? 'Edit skill' : 'Add skill'}</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="cs-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Name
              </label>
              <input
                id="cs-name"
                value={skillForm.name}
                onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="cs-group" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Group
              </label>
              <select
                id="cs-group"
                value={skillForm.skill_group_id}
                onChange={(e) => setSkillForm((f) => ({ ...f, skill_group_id: e.target.value }))}
                className={inputClass}
              >
                <option value="" disabled={skillForm.kind === 'plan'}>
                  Ungrouped
                </option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cs-kind" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Kind
              </label>
              <select
                id="cs-kind"
                value={skillForm.kind}
                onChange={(e) => setSkillForm((f) => ({ ...f, kind: e.target.value as SkillKind }))}
                className={inputClass}
              >
                <option value="numeric">Numeric (1–4)</option>
                <option value="certification">Certification (yes/no)</option>
                <option value="plan">Plan (stage-based)</option>
              </select>
              {skillForm.kind === 'plan' ? (
                <p className="mt-1.5 text-xs text-muted">
                  After creating this plan skill, add knowledges and stages in Skill plans.
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="cs-sort" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Sort order
              </label>
              <input
                id="cs-sort"
                type="number"
                value={skillForm.sort_order}
                onChange={(e) => setSkillForm((f) => ({ ...f, sort_order: e.target.value }))}
                className={inputClass}
              />
            </div>
            {error && skillDialogOpen ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeSkillDialog}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingSkillId ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </dialog>

      {/* Dialog: job role */}
      <dialog
        ref={roleDialogRef}
        className="w-[min(100%,28rem)] rounded-2xl border border-border bg-surface-raised p-0 text-fg shadow-glow backdrop:bg-black/30"
        onClose={() => {
          setRoleDialogOpen(false)
          setEditingRoleId(null)
          setRoleForm({ name: '', sort_order: '0' })
        }}
      >
        <form onSubmit={(e) => void submitRole(e)} className="p-6">
          <h3 className="font-display text-lg font-semibold">{editingRoleId ? 'Edit job role' : 'Add job role'}</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="cr-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Name
              </label>
              <input
                id="cr-name"
                value={roleForm.name}
                onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="cr-sort" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Sort order
              </label>
              <input
                id="cr-sort"
                type="number"
                value={roleForm.sort_order}
                onChange={(e) => setRoleForm((f) => ({ ...f, sort_order: e.target.value }))}
                className={inputClass}
              />
            </div>
            {error && roleDialogOpen ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeRoleDialog}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingRoleId ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
