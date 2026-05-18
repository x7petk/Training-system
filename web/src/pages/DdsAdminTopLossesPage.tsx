import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { DdsTlConfigOption } from '../features/dds/ddsTopLosses'
import { ddsBtn, ddsErr, ddsH2, ddsHint, ddsInput, ddsInset, ddsSection, ddsStack } from '../features/dds/ddsAdminCompactClasses'

function ConfigSection({
  title,
  options,
  draft,
  setDraft,
}: {
  title: string
  options: DdsTlConfigOption[]
  draft: Record<string, string>
  setDraft: Dispatch<SetStateAction<Record<string, string>>>
}) {
  return (
    <section className={ddsSection}>
      <h2 className={ddsH2}>{title}</h2>
      <ul className="mt-2 space-y-2">
        {options.map((o) => (
          <li key={o.id} className={ddsInset}>
            <label className="block text-[10px] font-medium text-muted">
              Choice {o.sort_order + 1}
              <input
                className={`${ddsInput} mt-1`}
                value={draft[o.id] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [o.id]: e.target.value }))}
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DdsAdminTopLossesPage() {
  const [types, setTypes] = useState<DdsTlConfigOption[]>([])
  const [rootCauses, setRootCauses] = useState<DdsTlConfigOption[]>([])
  const [problemSolves, setProblemSolves] = useState<DdsTlConfigOption[]>([])
  const [draftTypes, setDraftTypes] = useState<Record<string, string>>({})
  const [draftRoots, setDraftRoots] = useState<Record<string, string>>({})
  const [draftPs, setDraftPs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [tRes, rRes, pRes] = await Promise.all([
      supabase.from('dds_tl_type_options').select('id, sort_order, label').order('sort_order'),
      supabase.from('dds_tl_root_cause_options').select('id, sort_order, label').order('sort_order'),
      supabase.from('dds_tl_problem_solve_options').select('id, sort_order, label').order('sort_order'),
    ])
    setLoading(false)
    if (tRes.error || rRes.error || pRes.error) {
      setError(tRes.error?.message ?? rRes.error?.message ?? pRes.error?.message ?? 'Load failed')
      return
    }
    const tList = (tRes.data ?? []) as DdsTlConfigOption[]
    const rList = (rRes.data ?? []) as DdsTlConfigOption[]
    const pList = (pRes.data ?? []) as DdsTlConfigOption[]
    setTypes(tList)
    setRootCauses(rList)
    setProblemSolves(pList)
    const dt: Record<string, string> = {}
    for (const o of tList) dt[o.id] = o.label
    setDraftTypes(dt)
    const dr: Record<string, string> = {}
    for (const o of rList) dr[o.id] = o.label
    setDraftRoots(dr)
    const dp: Record<string, string> = {}
    for (const o of pList) dp[o.id] = o.label
    setDraftPs(dp)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveGroup(
    table: 'dds_tl_type_options' | 'dds_tl_root_cause_options' | 'dds_tl_problem_solve_options',
    options: DdsTlConfigOption[],
    draft: Record<string, string>,
    label: string,
  ) {
    for (const o of options) {
      const lbl = (draft[o.id] ?? '').trim()
      if (!lbl) {
        setError(`Each ${label} choice needs a label.`)
        return false
      }
      const { error: uErr } = await supabase.from(table).update({ label: lbl }).eq('id', o.id)
      if (uErr) {
        setError(uErr.message)
        return false
      }
    }
    return true
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    if (!(await saveGroup('dds_tl_type_options', types, draftTypes, 'type'))) {
      setSaving(false)
      return
    }
    if (!(await saveGroup('dds_tl_root_cause_options', rootCauses, draftRoots, 'root cause'))) {
      setSaving(false)
      return
    }
    if (!(await saveGroup('dds_tl_problem_solve_options', problemSolves, draftPs, 'problem solve'))) {
      setSaving(false)
      return
    }
    setSaving(false)
    setSuccess('Saved.')
    void load()
  }

  if (loading) {
    return (
      <p className="mt-4 text-xs text-muted" role="status">
        Loading…
      </p>
    )
  }

  return (
    <div className={ddsStack}>
      <p className={ddsHint}>
        Configure type, root cause, and problem solve dropdowns used on Line and Site DDS Top Losses forms. Use short
        labels (e.g. root cause: Man / Mach / Meth; problem solve: IPS / BDE / W-W) so they fit the table columns.
      </p>

      {error ? <p className={ddsErr}>{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      <ConfigSection title="Loss types" options={types} draft={draftTypes} setDraft={setDraftTypes} />
      <ConfigSection title="Root causes" options={rootCauses} draft={draftRoots} setDraft={setDraftRoots} />
      <ConfigSection title="Problem solve" options={problemSolves} draft={draftPs} setDraft={setDraftPs} />

      <button type="button" className={ddsBtn} disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save labels'}
      </button>
    </div>
  )
}
