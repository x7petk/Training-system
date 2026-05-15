import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { DDS_P2P_RESPONSE_KINDS, type DdsP2pResponseKind, isDdsP2pResponseKind } from '../features/dds/ddsP2pResponseKind'
import {
  ddsBtn,
  ddsBtnDanger,
  ddsBtnGhostGrow,
  ddsErr,
  ddsH2,
  ddsH3,
  ddsHint,
  ddsInput,
  ddsInset,
  ddsSection,
  ddsSelect,
  ddsStack,
  ddsTextarea,
} from '../features/dds/ddsAdminCompactClasses'

type KpiGroupRow = {
  id: string
  name: string
  sort_order: number
  display_sections: string[] | null
}

type QuestionRow = {
  id: string
  kpi_group_id: string
  prompt: string
  sort_order: number
  response_kind: string
  target_number: number | string | null
}

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

function groupShowsP2p(g: KpiGroupRow): boolean {
  return (g.display_sections ?? []).includes('p2p')
}

export function DdsAdminP2pStandardPage() {
  const [groups, setGroups] = useState<KpiGroupRow[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [groupId, setGroupId] = useState('')
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

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_kpi_groups')
      .select('id, name, sort_order, display_sections')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoadingGroups(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    const list = (data ?? []) as KpiGroupRow[]
    setGroups(list)
    setGroupId((prev) => {
      if (prev && list.some((g) => g.id === prev)) return prev
      return list[0]?.id ?? ''
    })
  }, [])

  const loadQuestions = useCallback(async (gid: string) => {
    if (!gid) {
      setQuestions([])
      setQDrafts({})
      return
    }
    setLoadingQs(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('dds_p2p_standard_questions')
      .select('id, kpi_group_id, prompt, sort_order, response_kind, target_number')
      .eq('kpi_group_id', gid)
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
    void loadGroups()
  }, [loadGroups])

  useEffect(() => {
    void loadQuestions(groupId)
  }, [groupId, loadQuestions])

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
    if (!groupId) return
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
      kpi_group_id: groupId,
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
    await loadQuestions(groupId)
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
    else await loadQuestions(groupId)
  }

  async function removeQuestion(row: QuestionRow) {
    if (!confirm('Remove this question?')) return
    setError(null)
    const { error: dErr } = await supabase.from('dds_p2p_standard_questions').delete().eq('id', row.id)
    if (dErr) setError(dErr.message)
    else await loadQuestions(groupId)
  }

  if (loadingGroups) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center text-xs text-muted" role="status">
        Loading…
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className={ddsHint}>
        Create{' '}
        <Link to="/dds-process/admin/kpi-groups" className="font-medium text-accent underline-offset-2 hover:underline">
          KPI groups
        </Link>{' '}
        first, then add P2P standard questions for each group here.
      </p>
    )
  }

  return (
    <div className={ddsStack}>
      <p className="max-w-2xl text-xs leading-snug text-muted">
        Questions are global (every cell). Pick a KPI group, then define the standard questions for that group. Turn on
        P2P for a group under KPI groups if those questions should appear on the P2P screen.
      </p>

      {error ? <p className={ddsErr}>{error}</p> : null}

      <section className={ddsSection}>
        <h2 className={ddsH2}>P2P standard questions</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">
          KPI group comes from Admin → KPI groups. Names must be unique per group.
        </p>

        <div className="mt-2">
          <label htmlFor="p2p-q-group" className="text-[10px] font-medium text-muted">
            KPI group
          </label>
          <select
            id="p2p-q-group"
            className={ddsSelect}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {!groupShowsP2p(g) ? ' (P2P display off)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className={`${ddsInset} mt-2 space-y-2`}>
          <h3 className={ddsH3}>New question</h3>
          <div>
            <label htmlFor="p2p-new-q-prompt" className="text-[10px] font-medium text-muted">
              Question
            </label>
            <textarea
              id="p2p-new-q-prompt"
              className={ddsTextarea}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="What do you ask on the line?"
              rows={2}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="p2p-new-q-kind" className="text-[10px] font-medium text-muted">
                Answer type
              </label>
              <select
                id="p2p-new-q-kind"
                className={ddsSelect}
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
                <label htmlFor="p2p-new-q-target" className="text-[10px] font-medium text-muted">
                  Target number
                </label>
                <input
                  id="p2p-new-q-target"
                  className={ddsInput}
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
            className={ddsBtn}
            disabled={!newPrompt.trim()}
            onClick={() => void addQuestion()}
          >
            <Plus className="size-3.5" aria-hidden />
            Add question
          </button>
        </div>

        {loadingQs ? (
          <p className="mt-2 text-xs text-muted">Loading questions…</p>
        ) : questions.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No questions for this group yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {questions.map((row) => {
              const d = qDrafts[row.id]
              if (!d) return null
              return (
                <li key={row.id} className={ddsInset}>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted" htmlFor={`p2p-q-prompt-${row.id}`}>
                        Question
                      </label>
                      <textarea
                        id={`p2p-q-prompt-${row.id}`}
                        className={ddsTextarea}
                        rows={2}
                        value={d.prompt}
                        onChange={(e) =>
                          setQDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...d, prompt: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-[10px] font-medium text-muted" htmlFor={`p2p-q-kind-${row.id}`}>
                          Answer type
                        </label>
                        <select
                          id={`p2p-q-kind-${row.id}`}
                          className={ddsSelect}
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
                          <label className="text-[10px] font-medium text-muted" htmlFor={`p2p-q-target-${row.id}`}>
                            Target number
                          </label>
                          <input
                            id={`p2p-q-target-${row.id}`}
                            className={ddsInput}
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
                      <div className="flex items-end gap-1.5 sm:col-span-2 lg:col-span-1 lg:justify-end">
                        <button
                          type="button"
                          className={ddsBtnGhostGrow}
                          disabled={qSavingId === row.id}
                          onClick={() => void saveQuestion(row.id)}
                        >
                          {qSavingId === row.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className={ddsBtnDanger}
                          title="Delete question"
                          onClick={() => void removeQuestion(row)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
