import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DdsRrBehaviourOption, DdsRrValueOption } from '../features/dds/ddsRewardRecognition'
import { ddsBtn, ddsErr, ddsH2, ddsHint, ddsInput, ddsInset, ddsSection, ddsStack } from '../features/dds/ddsAdminCompactClasses'

export function DdsAdminRewardRecognitionPage() {
  const [values, setValues] = useState<DdsRrValueOption[]>([])
  const [behaviours, setBehaviours] = useState<DdsRrBehaviourOption[]>([])
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [draftBehaviours, setDraftBehaviours] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [vRes, bRes] = await Promise.all([
      supabase.from('dds_rr_value_options').select('id, sort_order, label').order('sort_order'),
      supabase.from('dds_rr_behaviour_options').select('id, value_option_id, sort_order, label').order('sort_order'),
    ])
    setLoading(false)
    if (vRes.error || bRes.error) {
      setError(vRes.error?.message ?? bRes.error?.message ?? 'Load failed')
      return
    }
    const vList = (vRes.data ?? []) as DdsRrValueOption[]
    const bList = (bRes.data ?? []) as DdsRrBehaviourOption[]
    setValues(vList)
    setBehaviours(bList)
    const dv: Record<string, string> = {}
    for (const v of vList) dv[v.id] = v.label
    setDraftValues(dv)
    const db: Record<string, string> = {}
    for (const b of bList) db[b.id] = b.label
    setDraftBehaviours(db)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    for (const v of values) {
      const label = (draftValues[v.id] ?? '').trim()
      if (!label) {
        setError('Each value choice needs a label.')
        setSaving(false)
        return
      }
      const { error: uErr } = await supabase.from('dds_rr_value_options').update({ label }).eq('id', v.id)
      if (uErr) {
        setError(uErr.message)
        setSaving(false)
        return
      }
    }
    for (const b of behaviours) {
      const label = (draftBehaviours[b.id] ?? '').trim()
      if (!label) {
        setError('Each behaviour choice needs a label.')
        setSaving(false)
        return
      }
      const { error: uErr } = await supabase.from('dds_rr_behaviour_options').update({ label }).eq('id', b.id)
      if (uErr) {
        setError(uErr.message)
        setSaving(false)
        return
      }
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
        Configure the three value choices and three behaviours per value used on Shift, Line, and Site DDS Reward &amp;
        Recognition forms.
      </p>

      {error ? <p className={ddsErr}>{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      <section className={ddsSection}>
        <h2 className={ddsH2}>Value choices</h2>
        <ul className="mt-2 space-y-2">
          {values.map((v) => (
            <li key={v.id} className={ddsInset}>
              <label className="block text-[10px] font-medium text-muted">
                Choice {v.sort_order + 1}
                <input
                  className={`${ddsInput} mt-1`}
                  value={draftValues[v.id] ?? ''}
                  onChange={(e) => setDraftValues((d) => ({ ...d, [v.id]: e.target.value }))}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      {values.map((v) => {
        const beh = behaviours.filter((b) => b.value_option_id === v.id).sort((a, b) => a.sort_order - b.sort_order)
        return (
          <section key={v.id} className={ddsSection}>
            <h2 className={ddsH2}>Behaviours for {draftValues[v.id] ?? v.label}</h2>
            <ul className="mt-2 space-y-2">
              {beh.map((b) => (
                <li key={b.id} className={ddsInset}>
                  <label className="block text-[10px] font-medium text-muted">
                    Behaviour {b.sort_order + 1}
                    <input
                      className={`${ddsInput} mt-1`}
                      value={draftBehaviours[b.id] ?? ''}
                      onChange={(e) => setDraftBehaviours((d) => ({ ...d, [b.id]: e.target.value }))}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <button type="button" className={ddsBtn} disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save labels'}
      </button>
    </div>
  )
}
