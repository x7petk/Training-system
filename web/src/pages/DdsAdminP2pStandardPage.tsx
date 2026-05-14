import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DDS_P2P_RESPONSE_KINDS, type DdsP2pResponseKind, isDdsP2pResponseKind } from '../features/dds/ddsP2pResponseKind'

type CategoryRow = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

type QuestionRow = {
  id: string
  category_id: string
  prompt: string
  sort_order: number
  response_kind: string
  target_number: number | string | null
}

const inputClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

const textareaClass =
  'mt-1 min-h-[4.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

const selectClass =
  'mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none ring-accent/30 focus:border-accent/50 focus:ring-2'

function parseTargetNumber(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function targetToInputValue(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function DdsAdminP2pStandardPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [catDrafts, setCatDrafts] = useState<Record<string, { name: string; is_active: boolean }>>({})
  const [loadingCats, setLoadingCats] = useState(true)
  const [newCatName, setNewCatName] = useState('')
  const [newCatActive, setNewCatActive] = useState(true)
  const [catSavingId, setCatSavingId] = useState<string | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [qDrafts, setQDrafts] = useState<
    Record<string, { prompt: string; response_kind: DdsP2pResponseKind; targetText: string }>
  >({})
  const [loadingQs, setLoadingQs] = useState(false)
  const [newPrompt, setNewPrompt] = useState('')
  const [newKind, setNewKind] = useState<DdsP2pResponseKind>('yes_no')
  const [newTargetText, setNewTargetText] = useState('')
  const [qSavingId, setQSavingId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setLoadingCats(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_p2p_standard_categories')
      .select('id, name, sort_order, is_active')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoadingCats(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as CategoryRow[]
    setCategories(list)
    const next: Record<string, { name: string; is_active: boolean }> = {}
    for (const c of list) {
      next[c.id] = { name: c.name, is_active: c.is_active }
    }
    setCatDrafts(next)
    setCategoryId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev
      return list[0]?.id ?? ''
    })
  }, [])

  const loadQuestions = useCallback(async (cid: string) => {
    if (!cid) {
      setQuestions([])
      setQDrafts({})
      return
    }
    setLoadingQs(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_p2p_standard_questions')
      .select('id, category_id, prompt, sort_order, response_kind, target_number')
      .eq('category_id', cid)
      .order('sort_order', { ascending: true })
      .order('prompt', { ascending: true })
    setLoadingQs(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as QuestionRow[]
    setQuestions(list)
    const next: Record<string, { prompt: string; response_kind: DdsP2pResponseKind; targetText: string }> = {}
    for (const q of list) {
      const kind = isDdsP2pResponseKind(q.response_kind) ? q.response_kind : 'yes_no'
      next[q.id] = {
        prompt: q.prompt,
        response_kind: kind,
        targetText: kind === 'number_with_target' ? targetToInputValue(q.target_number) : '',
      }
    }
    setQDrafts(next)
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  useEffect(() => {
    void loadQuestions(categoryId)
  }, [categoryId, loadQuestions])

  async function addCategory() {
    const name = newCatName.trim()
    if (!name) return
    setError(null)
    const nextOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_p2p_standard_categories').insert({
      name,
      sort_order: nextOrder,
      is_active: newCatActive,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewCatName('')
    setNewCatActive(true)
    await loadCategories()
  }

  async function saveCategory(id: string) {
    const d = catDrafts[id]
    if (!d) return
    const name = d.name.trim()
    if (!name) return
    setCatSavingId(id)
    setError(null)
    const { error: uErr } = await supabase
      .from('dds_p2p_standard_categories')
      .update({ name, is_active: d.is_active })
      .eq('id', id)
    setCatSavingId(null)
    if (uErr) setError(uErr.message)
    else await loadCategories()
  }

  async function removeCategory(row: CategoryRow) {
    if (!confirm(`Remove category "${row.name}" and all of its questions?`)) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_p2p_standard_categories').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else {
      if (categoryId === row.id) setCategoryId('')
      await loadCategories()
    }
  }

  function buildQuestionPayload(d: { prompt: string; response_kind: DdsP2pResponseKind; targetText: string }): {
    prompt: string
    response_kind: DdsP2pResponseKind
    target_number: number | null
  } | null {
    const prompt = d.prompt.trim()
    if (!prompt) return null
    if (d.response_kind === 'yes_no') {
      return { prompt, response_kind: 'yes_no', target_number: null }
    }
    const target = parseTargetNumber(d.targetText)
    if (target === null) {
      setError('Number questions need a target value.')
      return null
    }
    return { prompt, response_kind: 'number_with_target', target_number: target }
  }

  async function addQuestion() {
    if (!categoryId) return
    if (!newPrompt.trim()) return
    setError(null)
    const payload = buildQuestionPayload({
      prompt: newPrompt,
      response_kind: newKind,
      targetText: newTargetText,
    })
    if (!payload) return
    const nextOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 0
    const { error: insErr } = await supabase.from('dds_p2p_standard_questions').insert({
      category_id: categoryId,
      prompt: payload.prompt,
      response_kind: payload.response_kind,
      target_number: payload.target_number,
      sort_order: nextOrder,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNewPrompt('')
    setNewKind('yes_no')
    setNewTargetText('')
    await loadQuestions(categoryId)
  }

  async function saveQuestion(id: string) {
    const d = qDrafts[id]
    if (!d) return
    setError(null)
    const payload = buildQuestionPayload(d)
    if (!payload) {
      if (!d.prompt.trim()) setError('Question text is required.')
      return
    }
    setQSavingId(id)
    const { error: uErr } = await supabase
      .from('dds_p2p_standard_questions')
      .update({
        prompt: payload.prompt,
        response_kind: payload.response_kind,
        target_number: payload.target_number,
      })
      .eq('id', id)
    setQSavingId(null)
    if (uErr) setError(uErr.message)
    else await loadQuestions(categoryId)
  }

  async function removeQuestion(row: QuestionRow) {
    if (!confirm('Remove this question?')) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_p2p_standard_questions').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await loadQuestions(categoryId)
  }

  if (loadingCats) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted" role="status">
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted">
        Categories and questions apply to every cell. Tick a category as active to include it in P2P. Each question is either yes/no or a number compared to a target.
      </p>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">P2P categories</h2>
        <p className="mt-1 text-xs text-muted">Name is unique (case-insensitive). Only active categories are intended for P2P screens later.</p>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="p2p-new-cat-name" className="text-xs font-medium text-muted">
              New category name
            </label>
            <input
              id="p2p-new-cat-name"
              className={inputClass}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Safety"
              autoComplete="off"
            />
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 pb-2 text-xs text-muted sm:pb-3">
            <input
              type="checkbox"
              className="size-3.5 rounded border-border accent-accent"
              checked={newCatActive}
              onChange={(e) => setNewCatActive(e.target.checked)}
            />
            Active
          </label>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            disabled={!newCatName.trim()}
            onClick={() => void addCategory()}
          >
            <Plus className="size-4" aria-hidden />
            Add category
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No categories yet. Add one to create questions.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {categories.map((row) => {
              const d = catDrafts[row.id]
              if (!d) return null
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
                >
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-border accent-accent"
                      checked={d.is_active}
                      onChange={(e) =>
                        setCatDrafts((prev) => ({
                          ...prev,
                          [row.id]: { ...d, is_active: e.target.checked },
                        }))
                      }
                    />
                    Active
                  </label>
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor={`p2p-cat-name-${row.id}`}>
                      Name
                    </label>
                    <input
                      id={`p2p-cat-name-${row.id}`}
                      className={inputClass}
                      value={d.name}
                      onChange={(e) =>
                        setCatDrafts((prev) => ({ ...prev, [row.id]: { ...d, name: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]"
                      disabled={catSavingId === row.id}
                      onClick={() => void saveCategory(row.id)}
                    >
                      {catSavingId === row.id ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-10 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                      title="Delete category"
                      onClick={() => void removeCategory(row)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-fg">Questions</h2>
        <p className="mt-1 text-xs text-muted">Pick a category, then add questions shown in P2P for every cell.</p>

        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Add a category above first.</p>
        ) : (
          <>
            <div className="mt-4">
              <label htmlFor="p2p-q-category" className="text-xs font-medium text-muted">
                Category
              </label>
              <select
                id="p2p-q-category"
                className={selectClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!catDrafts[c.id]?.is_active ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">New question</h3>
              <div>
                <label htmlFor="p2p-new-q-prompt" className="text-xs font-medium text-muted">
                  Question
                </label>
                <textarea
                  id="p2p-new-q-prompt"
                  className={textareaClass}
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="What do you ask on the line?"
                  rows={3}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="p2p-new-q-kind" className="text-xs font-medium text-muted">
                    Answer type
                  </label>
                  <select
                    id="p2p-new-q-kind"
                    className={selectClass}
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as DdsP2pResponseKind)}
                  >
                    {DDS_P2P_RESPONSE_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                {newKind === 'number_with_target' ? (
                  <div>
                    <label htmlFor="p2p-new-q-target" className="text-xs font-medium text-muted">
                      Target number
                    </label>
                    <input
                      id="p2p-new-q-target"
                      className={inputClass}
                      value={newTargetText}
                      onChange={(e) => setNewTargetText(e.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 100"
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
                disabled={!newPrompt.trim()}
                onClick={() => void addQuestion()}
              >
                <Plus className="size-4" aria-hidden />
                Add question
              </button>
            </div>

            {loadingQs ? (
              <p className="mt-4 text-sm text-muted">Loading questions…</p>
            ) : questions.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No questions in this category yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {questions.map((row) => {
                  const d = qDrafts[row.id]
                  if (!d) return null
                  return (
                    <li key={row.id} className="rounded-xl border border-border bg-surface p-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted" htmlFor={`p2p-q-prompt-${row.id}`}>
                            Question
                          </label>
                          <textarea
                            id={`p2p-q-prompt-${row.id}`}
                            className={textareaClass}
                            rows={3}
                            value={d.prompt}
                            onChange={(e) =>
                              setQDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...d, prompt: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <label className="text-xs font-medium text-muted" htmlFor={`p2p-q-kind-${row.id}`}>
                              Answer type
                            </label>
                            <select
                              id={`p2p-q-kind-${row.id}`}
                              className={selectClass}
                              value={d.response_kind}
                              onChange={(e) => {
                                const kind = e.target.value as DdsP2pResponseKind
                                setQDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...d,
                                    response_kind: kind,
                                    targetText: kind === 'number_with_target' ? d.targetText : '',
                                  },
                                }))
                              }}
                            >
                              {DDS_P2P_RESPONSE_KINDS.map((k) => (
                                <option key={k.value} value={k.value}>
                                  {k.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {d.response_kind === 'number_with_target' ? (
                            <div>
                              <label className="text-xs font-medium text-muted" htmlFor={`p2p-q-target-${row.id}`}>
                                Target number
                              </label>
                              <input
                                id={`p2p-q-target-${row.id}`}
                                className={inputClass}
                                value={d.targetText}
                                onChange={(e) =>
                                  setQDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...d, targetText: e.target.value },
                                  }))
                                }
                                inputMode="decimal"
                              />
                            </div>
                          ) : null}
                          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                            <button
                              type="button"
                              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-semibold hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06] lg:flex-none"
                              disabled={qSavingId === row.id}
                              onClick={() => void saveQuestion(row.id)}
                            >
                              {qSavingId === row.id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                              title="Delete question"
                              onClick={() => void removeQuestion(row)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
