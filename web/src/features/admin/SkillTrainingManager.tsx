import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpenCheck, FileUp, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type SkillKind = 'numeric' | 'certification'
type SkillRow = { id: string; name: string; kind: SkillKind; skill_groups: { name: string } | null }
type TrainingPackRow = {
  skill_id: string
  document_path: string | null
  document_name: string | null
  document_mime: string | null
  document_size_bytes: number | null
  pass_score_percent: number
  updated_at: string
}
type QuestionRow = {
  id: string
  skill_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  option_count: number
  sort_order: number
}

type EditableQuestion = {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  option_count: 2 | 3 | 4
}

const MAX_FILE_BYTES = 10 * 1024 * 1024
const DOC_BUCKET = 'skill-training-docs'

const inputClass =
  'w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

const LazyTrainingStandardsEditor = lazy(async () => {
  const mod = await import('./TrainingStandardsEditor')
  return { default: mod.TrainingStandardsEditor }
})

function emptyQuestion(): EditableQuestion {
  return {
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    option_count: 4,
  }
}

function defaultFirstQuestion(): EditableQuestion {
  return {
    question_text: 'Do you understand a theory?',
    option_a: 'Yes',
    option_b: 'No',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    option_count: 2,
  }
}

function toSafeName(x: string): string {
  return x.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function SkillTrainingManager() {
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [packs, setPacks] = useState<TrainingPackRow[]>([])
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [passScore, setPassScore] = useState('100')
  const [qEdit, setQEdit] = useState<EditableQuestion[]>([defaultFirstQuestion()])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const applySkillState = useCallback((skillId: string, allPacks: TrainingPackRow[], allQuestions: QuestionRow[]) => {
    const pack = allPacks.find((x) => x.skill_id === skillId) ?? null
    const existingQ = allQuestions.filter((x) => x.skill_id === skillId).sort((a, b) => a.sort_order - b.sort_order)
    setPassScore(String(pack?.pass_score_percent ?? 100))
    if (existingQ.length > 0) {
      setQEdit(
        existingQ.map((q) => ({
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          option_count: (q.option_count === 2 || q.option_count === 3 || q.option_count === 4 ? q.option_count : 4) as 2 | 3 | 4,
        })),
      )
    } else {
      setQEdit([defaultFirstQuestion()])
    }
    setFile(null)
    setInfo(null)
    setError(null)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [sRes, pRes, qRes] = await Promise.all([
      supabase
        .from('skills')
        .select('id, name, kind, skill_groups(name)')
        .eq('kind', 'numeric')
        .order('sort_order', { ascending: true }),
      supabase.from('skill_training_packs').select('skill_id, document_path, document_name, document_mime, document_size_bytes, pass_score_percent, updated_at'),
      supabase
        .from('skill_training_questions')
        .select(
          'id, skill_id, question_text, option_a, option_b, option_c, option_d, correct_option, option_count, sort_order',
        )
        .order('sort_order', { ascending: true }),
    ])
    setLoading(false)
    if (sRes.error || pRes.error || qRes.error) {
      setError(sRes.error?.message ?? pRes.error?.message ?? qRes.error?.message ?? 'Failed to load training settings')
      setSkills([])
      setPacks([])
      setQuestions([])
      return
    }
    const numericSkills = (sRes.data ?? []) as unknown as SkillRow[]
    const p = (pRes.data ?? []) as TrainingPackRow[]
    const q = (qRes.data ?? []) as QuestionRow[]
    setSkills(numericSkills)
    setPacks(p)
    setQuestions(q)
    if (numericSkills.length === 0) return
    const nextSelected = numericSkills.some((x) => x.id === selectedSkillId) ? selectedSkillId : numericSkills[0].id
    if (nextSelected !== selectedSkillId) setSelectedSkillId(nextSelected)
    if (nextSelected) {
      applySkillState(nextSelected, p, q)
    }
  }, [selectedSkillId, applySkillState])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void loadAll()
    })
    return () => cancelAnimationFrame(id)
  }, [loadAll])

  const packBySkill = useMemo(() => new Map(packs.map((p) => [p.skill_id, p])), [packs])

  const qBySkill = useMemo(() => {
    const m = new Map<string, QuestionRow[]>()
    for (const q of questions) {
      const arr = m.get(q.skill_id) ?? []
      arr.push(q)
      m.set(q.skill_id, arr)
    }
    return m
  }, [questions])

  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? null
  const selectedPack = selectedSkillId ? packBySkill.get(selectedSkillId) ?? null : null
  const selectedQuestionCount = qEdit.length

  function validate() {
    const n = Number.parseInt(passScore, 10)
    if (!Number.isFinite(n) || n < 1 || n > 100) return 'Pass score must be 1-100%.'
    if (!selectedSkillId) return 'Select a skill first.'
    if (selectedQuestionCount < 1 || selectedQuestionCount > 10) return 'Set from 1 to 10 questions.'
    for (let i = 0; i < qEdit.length; i++) {
      const q = qEdit[i]
      if (!q.question_text.trim()) return `Question ${i + 1} is empty.`
      if (!q.option_a.trim() || !q.option_b.trim()) return `Question ${i + 1} needs at least options A and B.`
      if (q.option_count >= 3 && !q.option_c.trim()) return `Question ${i + 1} needs option C (3+ choices).`
      if (q.option_count >= 4 && !q.option_d.trim()) return `Question ${i + 1} needs option D (4 choices).`
      const allowed: ('A' | 'B' | 'C' | 'D')[] =
        q.option_count === 2 ? ['A', 'B'] : q.option_count === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']
      if (!allowed.includes(q.correct_option)) return `Question ${i + 1}: pick a correct answer among the choices you enabled.`
    }
    if (file) {
      const okType =
        file.type === 'application/pdf' ||
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/vnd.ms-powerpoint' ||
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      const ext = file.name.toLowerCase()
      const okExt = ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx') || ext.endsWith('.ppt') || ext.endsWith('.pptx')
      if (!okType && !okExt) return 'Allowed files: PDF, DOC, DOCX, PPT, PPTX.'
      if (file.size > MAX_FILE_BYTES) return 'File is too large. Maximum size is 10MB.'
    }
    return null
  }

  async function saveTraining(e: FormEvent) {
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
    let nextPath: string | null = selectedPack?.document_path ?? null
    let nextName: string | null = selectedPack?.document_name ?? null
    let nextMime: string | null = selectedPack?.document_mime ?? null
    let nextSize: number | null = selectedPack?.document_size_bytes ?? 0

    if (file) {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${selectedSkillId}/${Date.now()}_${toSafeName(file.name)}.${toSafeName(ext)}`
      const upRes = await supabase.storage.from(DOC_BUCKET).upload(path, file, { upsert: false, cacheControl: '3600' })
      if (upRes.error) {
        setSaving(false)
        setError(upRes.error.message)
        return
      }
      nextPath = upRes.data.path
      nextName = file.name
      nextMime = file.type || 'application/octet-stream'
      nextSize = file.size
    }

    const score = Math.max(1, Math.min(100, Number.parseInt(passScore, 10)))
    const { error: packErr } = await supabase.from('skill_training_packs').upsert({
      skill_id: selectedSkillId,
      document_path: nextPath,
      document_name: nextName,
      document_mime: nextMime,
      document_size_bytes: nextSize ?? 0,
      pass_score_percent: score,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    if (packErr) {
      setSaving(false)
      setError(packErr.message)
      return
    }

    const { error: delErr } = await supabase.from('skill_training_questions').delete().eq('skill_id', selectedSkillId)
    if (delErr) {
      setSaving(false)
      setError(delErr.message)
      return
    }
    const payload = qEdit.map((q, idx) => ({
      skill_id: selectedSkillId,
      question_text: q.question_text.trim(),
      option_a: q.option_a.trim(),
      option_b: q.option_b.trim(),
      option_c: q.option_count >= 3 ? q.option_c.trim() : '',
      option_d: q.option_count >= 4 ? q.option_d.trim() : '',
      correct_option: q.correct_option,
      option_count: q.option_count,
      sort_order: idx + 1,
    }))
    const { error: insErr } = await supabase.from('skill_training_questions').insert(payload)
    if (insErr) {
      setSaving(false)
      setError(insErr.message)
      return
    }

    if (file && selectedPack?.document_path && nextPath && selectedPack.document_path !== nextPath) {
      await supabase.storage.from(DOC_BUCKET).remove([selectedPack.document_path])
    }

    setSaving(false)
    setInfo('Training pack saved.')
    await loadAll()
  }

  async function previewCurrentDocument() {
    if (!selectedPack?.document_path) return
    const { data, error: signedErr } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(selectedPack.document_path, 60 * 10)
    if (signedErr || !data?.signedUrl) {
      setError(signedErr?.message ?? 'Could not create preview URL.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-raised/40 backdrop-blur-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="size-5 text-accent" aria-hidden />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Skill training (operator 1→2)</h2>
            <p className="text-xs text-muted">
              Admin-only: one pack per numeric skill (optional document, up to 10 quiz questions, pass score).
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
        <form onSubmit={(e) => void saveTraining(e)} className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="training-skill" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Skill
              </label>
              <select
                id="training-skill"
                className={inputClass}
                value={selectedSkillId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedSkillId(id)
                  applySkillState(id, packs, questions)
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
              <label htmlFor="training-pass-score" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Pass score (%)
              </label>
              <input
                id="training-pass-score"
                type="number"
                min={1}
                max={100}
                value={passScore}
                onChange={(e) => setPassScore(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">Training document (optional · PDF/DOC/DOCX/PPT/PPTX, up to 10MB)</p>
              {selectedPack?.document_path ? (
                <button
                  type="button"
                  onClick={() => void previewCurrentDocument()}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
                >
                  Open current
                </button>
              ) : null}
            </div>
            {selectedPack?.document_path ? (
              <p className="mb-2 text-xs text-muted">
                Current: <span className="font-medium text-fg">{selectedPack.document_name ?? '—'}</span> (
                {Math.ceil((selectedPack.document_size_bytes ?? 0) / 1024)} KB)
              </p>
            ) : selectedPack ? (
              <p className="mb-2 text-xs text-muted">No document on file — quiz-only training.</p>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted hover:bg-black/[0.06] hover:text-fg">
              <FileUp className="size-4" />
              {file ? `Selected: ${file.name}` : selectedPack ? 'Replace document' : 'Upload document'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {selectedSkill ? (
            <Suspense fallback={<p className="rounded-xl border border-border p-3 text-xs text-muted">Loading standards editor…</p>}>
              <LazyTrainingStandardsEditor
                key={selectedSkill.id}
                skillId={selectedSkill.id}
                skillName={selectedSkill.name}
              />
            </Suspense>
          ) : null}

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-fg">Quiz questions ({selectedQuestionCount}/10)</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQEdit((prev) => (prev.length >= 10 ? prev : [...prev, emptyQuestion()]))}
                  className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
                  disabled={qEdit.length >= 10}
                >
                  Add question
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSkillId) {
                      const existingQ = qBySkill.get(selectedSkillId) ?? []
                      if (existingQ.length > 0) {
                        setQEdit(
                          existingQ.map((q) => ({
                            question_text: q.question_text,
                            option_a: q.option_a,
                            option_b: q.option_b,
                            option_c: q.option_c,
                            option_d: q.option_d,
                            correct_option: q.correct_option,
                            option_count: (q.option_count === 2 || q.option_count === 3 || q.option_count === 4
                              ? q.option_count
                              : 4) as 2 | 3 | 4,
                          })),
                        )
                      } else {
                        setQEdit([defaultFirstQuestion()])
                      }
                    }
                  }}
                  className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted hover:bg-black/[0.06] hover:text-fg"
                >
                  <RotateCcw className="mr-1 inline size-3.5" />
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {qEdit.map((q, i) => (
                <div key={`q-${i}`} className="rounded-lg border border-border/70 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Question {i + 1}</p>
                    {qEdit.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setQEdit((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    value={q.question_text}
                    onChange={(e) =>
                      setQEdit((prev) => prev.map((x, idx) => (idx === i ? { ...x, question_text: e.target.value } : x)))
                    }
                    placeholder="Question text"
                    className={`${inputClass} mb-2`}
                  />
                  <label className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-medium">Choices</span>
                    <select
                      className={`${inputClass} max-w-[10rem] py-1.5 text-xs`}
                      value={q.option_count}
                      onChange={(e) => {
                        const n = Number(e.target.value) as 2 | 3 | 4
                        setQEdit((prev) =>
                          prev.map((x, idx) => {
                            if (idx !== i) return x
                            let co = x.correct_option
                            if (n === 2 && (co === 'C' || co === 'D')) co = 'A'
                            if (n === 3 && co === 'D') co = 'A'
                            return { ...x, option_count: n, correct_option: co }
                          }),
                        )
                      }}
                    >
                      <option value={2}>2 answers</option>
                      <option value={3}>3 answers</option>
                      <option value={4}>4 answers</option>
                    </select>
                    <span className="text-[11px]">Select the radio next to the correct choice.</span>
                  </label>
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const ord = opt === 'A' ? 1 : opt === 'B' ? 2 : opt === 'C' ? 3 : 4
                    if (ord > q.option_count) return null
                    const key = `option_${opt.toLowerCase()}` as keyof EditableQuestion
                    return (
                      <div key={opt} className="mb-2 flex items-center gap-2">
                        <label className="flex min-w-[2.5rem] items-center gap-1 text-xs text-muted">
                          <input
                            type="radio"
                            name={`correct-${i}`}
                            checked={q.correct_option === opt}
                            onChange={() =>
                              setQEdit((prev) => prev.map((x, idx) => (idx === i ? { ...x, correct_option: opt } : x)))
                            }
                          />
                          {opt}
                        </label>
                        <input
                          value={(q[key] as string) ?? ''}
                          onChange={(e) =>
                            setQEdit((prev) => prev.map((x, idx) => (idx === i ? { ...x, [key]: e.target.value } : x)))
                          }
                          placeholder={`Option ${opt}`}
                          className={inputClass}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !selectedSkill}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {saving ? 'Saving…' : selectedPack ? 'Update training pack' : 'Create training pack'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
