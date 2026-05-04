import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ClipboardCheck, Plus, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type SkillKind = 'numeric' | 'certification'
type SkillRow = { id: string; name: string; kind: SkillKind; skill_groups: { name: string } | null }
type SettingsRow = { skill_id: string; assessment_instructions: string; updated_at: string }
type ChecklistRow = { id: string; skill_id: string; item_text: string; sort_order: number }

const MAX_ITEMS = 50

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

function emptyItem(): string {
  return ''
}

export function SkillAssessmentManager() {
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [settingsBySkill, setSettingsBySkill] = useState<Map<string, SettingsRow>>(new Map())
  const [checklistBySkill, setChecklistBySkill] = useState<Map<string, ChecklistRow[]>>(new Map())
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [instructions, setInstructions] = useState('')
  const [itemLines, setItemLines] = useState<string[]>([emptyItem()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const applySkillState = useCallback(
    (skillId: string, settings: Map<string, SettingsRow>, lists: Map<string, ChecklistRow[]>) => {
      const setRow = settings.get(skillId)
      setInstructions(setRow?.assessment_instructions ?? '')
      const lines = lists.get(skillId) ?? []
      if (lines.length > 0) {
        setItemLines(lines.sort((a, b) => a.sort_order - b.sort_order).map((x) => x.item_text))
      } else {
        setItemLines([emptyItem()])
      }
      setInfo(null)
      setError(null)
    },
    [],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [sRes, setRes, listRes] = await Promise.all([
      supabase
        .from('skills')
        .select('id, name, kind, skill_groups(name)')
        .eq('kind', 'numeric')
        .order('sort_order', { ascending: true }),
      supabase.from('skill_assessment_settings').select('skill_id, assessment_instructions, updated_at'),
      supabase.from('skill_assessment_checklist_items').select('id, skill_id, item_text, sort_order'),
    ])
    setLoading(false)
    if (sRes.error || setRes.error || listRes.error) {
      setError(sRes.error?.message ?? setRes.error?.message ?? listRes.error?.message ?? 'Failed to load assessment data')
      setSkills([])
      setSettingsBySkill(new Map())
      setChecklistBySkill(new Map())
      return
    }
    const numericSkills = (sRes.data ?? []) as unknown as SkillRow[]
    const settingsMap = new Map<string, SettingsRow>()
    for (const r of setRes.data ?? []) {
      const row = r as { skill_id: string; assessment_instructions: string; updated_at: string }
      settingsMap.set(row.skill_id, {
        skill_id: row.skill_id,
        assessment_instructions: row.assessment_instructions ?? '',
        updated_at: row.updated_at,
      })
    }
    const listMap = new Map<string, ChecklistRow[]>()
    for (const r of listRes.data ?? []) {
      const row = r as ChecklistRow
      const arr = listMap.get(row.skill_id) ?? []
      arr.push(row)
      listMap.set(row.skill_id, arr)
    }
    setSkills(numericSkills)
    setSettingsBySkill(settingsMap)
    setChecklistBySkill(listMap)
    if (numericSkills.length === 0) return
    const nextSelected = numericSkills.some((x) => x.id === selectedSkillId) ? selectedSkillId : numericSkills[0].id
    if (nextSelected !== selectedSkillId) setSelectedSkillId(nextSelected)
    if (nextSelected) {
      applySkillState(nextSelected, settingsMap, listMap)
    }
  }, [selectedSkillId, applySkillState])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void loadAll()
    })
    return () => cancelAnimationFrame(id)
  }, [loadAll])

  function validate() {
    if (!selectedSkillId) return 'Select a skill first.'
    const nonEmpty = itemLines.map((t) => t.trim()).filter(Boolean)
    if (nonEmpty.length > MAX_ITEMS) return `At most ${MAX_ITEMS} checklist items.`
    return null
  }

  async function saveAssessment(e: FormEvent) {
    e.preventDefault()
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }
    if (!selectedSkillId) return

    setSaving(true)
    setError(null)
    setInfo(null)

    const uid = (await supabase.auth.getUser()).data.user?.id ?? null
    const trimmedLines = itemLines.map((t) => t.trim()).filter(Boolean)

    const { error: upsertErr } = await supabase.from('skill_assessment_settings').upsert({
      skill_id: selectedSkillId,
      assessment_instructions: instructions,
      updated_by: uid,
    })
    if (upsertErr) {
      setSaving(false)
      setError(upsertErr.message)
      return
    }

    const { error: delErr } = await supabase.from('skill_assessment_checklist_items').delete().eq('skill_id', selectedSkillId)
    if (delErr) {
      setSaving(false)
      setError(delErr.message)
      return
    }

    if (trimmedLines.length > 0) {
      const payload = trimmedLines.map((item_text, idx) => ({
        skill_id: selectedSkillId,
        item_text,
        sort_order: idx + 1,
      }))
      const { error: insErr } = await supabase.from('skill_assessment_checklist_items').insert(payload)
      if (insErr) {
        setSaving(false)
        setError(insErr.message)
        return
      }
    }

    setSaving(false)
    setInfo('Assessment settings saved.')
    await loadAll()
  }

  function moveLine(i: number, dir: -1 | 1) {
    setItemLines((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-accent" aria-hidden />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Skill assessment</h2>
            <p className="text-xs text-muted">
              Admin-only: plain-text assessment instructions and an ordered assessor checklist per numeric skill.
            </p>
          </div>
        </div>
      </div>

      {error ? <p className="border-b border-border px-4 py-2 text-sm text-danger">{error}</p> : null}
      {info ? <p className="border-b border-border px-4 py-2 text-sm text-emerald-700">{info}</p> : null}

      {loading ? (
        <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
      ) : skills.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">No numeric skills found. Add numeric skills first.</p>
      ) : (
        <form onSubmit={(e) => void saveAssessment(e)} className="space-y-4 p-4">
          <div>
            <label htmlFor="assessment-skill" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
              Skill
            </label>
            <select
              id="assessment-skill"
              className={inputClass}
              value={selectedSkillId}
              onChange={(e) => {
                const id = e.target.value
                setSelectedSkillId(id)
                applySkillState(id, settingsBySkill, checklistBySkill)
              }}
            >
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.skill_groups?.name ? `${s.skill_groups.name} · ` : '') + s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assessment-instructions" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
              Instructions for assessment (plain text)
            </label>
            <textarea
              id="assessment-instructions"
              rows={6}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What assessors should read before evaluating this skill."
              className={`${inputClass} min-h-[8rem] resize-y`}
            />
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">
                Assessor checklist ({itemLines.filter((x) => x.trim()).length}/{MAX_ITEMS})
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setItemLines((prev) => (prev.length >= MAX_ITEMS ? prev : [...prev, emptyItem()]))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
                  disabled={itemLines.length >= MAX_ITEMS}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add line
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSkillId) {
                      const existing = checklistBySkill.get(selectedSkillId) ?? []
                      if (existing.length > 0) {
                        setItemLines(existing.sort((a, b) => a.sort_order - b.sort_order).map((x) => x.item_text))
                      } else {
                        setItemLines([emptyItem()])
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {itemLines.map((line, i) => (
                <div key={`line-${i}`} className="flex flex-wrap items-start gap-2">
                  <div className="flex shrink-0 flex-col gap-0.5 pt-1">
                    <button
                      type="button"
                      className="rounded border border-border px-1.5 py-0 text-[10px] text-muted hover:bg-black/[0.06]"
                      onClick={() => moveLine(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border px-1.5 py-0 text-[10px] text-muted hover:bg-black/[0.06]"
                      onClick={() => moveLine(i, 1)}
                      disabled={i >= itemLines.length - 1}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                  <input
                    value={line}
                    onChange={(e) =>
                      setItemLines((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    placeholder={`Checklist item ${i + 1}`}
                    className={inputClass}
                  />
                  {itemLines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setItemLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 rounded-lg px-2 py-2 text-xs text-danger hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !selectedSkillId}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save assessment'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
