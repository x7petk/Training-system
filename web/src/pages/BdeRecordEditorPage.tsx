import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePlan24Workspace } from '../features/plan24/Plan24WorkspaceContext'
import {
  deleteBdePhoto,
  replaceBdeCodes,
  replaceBdeTeamMembers,
  signedBdePhotoUrl,
  uploadBdePhoto,
} from '../features/bde/bdeApi'
import {
  BDE_CODE_KIND_META,
  BDE_MAX_PHOTOS,
  bdeActionStatusLabel,
  personLabel,
  type BdeActionRow,
  type BdeActionStatus,
  type BdeCatalogOption,
  type BdeCodeKind,
  type BdePersonMini,
  type BdePhotoRow,
  type BdeRecordRow,
  type BdeStatus,
} from '../features/bde/bdeTypes'

const inputClass =
  'mt-1 w-full rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'
const labelClass = 'block text-xs font-medium uppercase tracking-wider text-muted'
const selectClass =
  'mt-1 h-10 w-full rounded-xl border border-border bg-canvas/60 px-3 text-sm outline-none ring-accent/40 focus:border-accent/50 focus:ring-2'

type Step = 'details' | 'codes'

const emptyCodes = (): Record<BdeCodeKind, string[]> => ({
  activity: [],
  object_part: [],
  damage: [],
  cause: [],
})

export function BdeRecordEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cellId, status: scopeStatus } = usePlan24Workspace()

  const [step, setStep] = useState<Step>('details')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordId, setRecordId] = useState<string | null>(isNew ? null : id)
  const [displayId, setDisplayId] = useState<string>(isNew ? 'New' : '')
  const [status, setStatus] = useState<BdeStatus>('saved')

  const [title, setTitle] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [functionalLocation, setFunctionalLocation] = useState('')
  const [componentPart, setComponentPart] = useState('')
  const [whatWasChecked, setWhatWasChecked] = useState('')
  const [notificationNumber, setNotificationNumber] = useState('')
  const [workOrderNumber, setWorkOrderNumber] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [whatWereTheResults, setWhatWereTheResults] = useState('')
  const [areaId, setAreaId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [problemTypeId, setProblemTypeId] = useState('')
  const [plan24EventId, setPlan24EventId] = useState('')
  const [plan24EventLabel, setPlan24EventLabel] = useState('')
  const [ddsTlEntryId, setDdsTlEntryId] = useState('')
  const [ddsTlLabel, setDdsTlLabel] = useState('')
  const [ipsReference, setIpsReference] = useState('')
  const [plan24Options, setPlan24Options] = useState<{ id: string; label: string }[]>([])
  const [ddsTlOptions, setDdsTlOptions] = useState<{ id: string; label: string }[]>([])
  const [linksHint, setLinksHint] = useState<string | null>(null)

  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [equipment, setEquipment] = useState<{ id: string; area_id: string; name: string }[]>([])
  const [problemTypes, setProblemTypes] = useState<BdeCatalogOption[]>([])
  const [codeOptions, setCodeOptions] = useState<Record<BdeCodeKind, BdeCatalogOption[]>>({
    activity: [],
    object_part: [],
    damage: [],
    cause: [],
  })
  const [codeSearch, setCodeSearch] = useState<Record<BdeCodeKind, string>>({
    activity: '',
    object_part: '',
    damage: '',
    cause: '',
  })
  const [selectedCodes, setSelectedCodes] = useState<Record<BdeCodeKind, string[]>>(emptyCodes())

  const [people, setPeople] = useState<BdePersonMini[]>([])
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [teamQuery, setTeamQuery] = useState('')
  const [photos, setPhotos] = useState<BdePhotoRow[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [actions, setActions] = useState<BdeActionRow[]>([])
  const [actionDraft, setActionDraft] = useState<{
    open: boolean
    id?: string
    title: string
    status: BdeActionStatus
    due_date: string
    owner_person_id: string
    system_text: string
  } | null>(null)

  const equipmentForArea = useMemo(() => {
    if (!areaId) return equipment
    return equipment.filter((e) => e.area_id === areaId)
  }, [areaId, equipment])

  const actorName = useMemo(() => {
    return user?.email?.split('@')[0] ?? 'User'
  }, [user?.email])

  const loadLookups = useCallback(async () => {
    if (!cellId) return
    const [areaRes, eqRes, typeRes, actRes, objRes, dmgRes, causeRes, peopleRes] = await Promise.all([
      supabase.from('master_areas').select('id, name').eq('cell_id', cellId).order('sort_order').order('name'),
      supabase.from('master_equipment').select('id, area_id, name').order('sort_order').order('name'),
      supabase
        .from('bde_problem_types')
        .select('id, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('bde_activity_codes').select('id, label, sort_order, is_active').eq('is_active', true).order('sort_order'),
      supabase
        .from('bde_object_part_codes')
        .select('id, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('bde_damage_codes').select('id, label, sort_order, is_active').eq('is_active', true).order('sort_order'),
      supabase.from('bde_cause_codes').select('id, label, sort_order, is_active').eq('is_active', true).order('sort_order'),
      supabase.from('people').select('id, display_name, first_name, last_name').order('display_name').limit(500),
    ])

    const areaList = (areaRes.data ?? []) as { id: string; name: string }[]
    const areaIds = new Set(areaList.map((a) => a.id))
    setAreas(areaList)
    setEquipment(((eqRes.data ?? []) as { id: string; area_id: string; name: string }[]).filter((e) => areaIds.has(e.area_id)))
    setProblemTypes((typeRes.data ?? []) as BdeCatalogOption[])
    setCodeOptions({
      activity: (actRes.data ?? []) as BdeCatalogOption[],
      object_part: (objRes.data ?? []) as BdeCatalogOption[],
      damage: (dmgRes.data ?? []) as BdeCatalogOption[],
      cause: (causeRes.data ?? []) as BdeCatalogOption[],
    })
    setPeople((peopleRes.data ?? []) as BdePersonMini[])

    const linkHints: string[] = []
    const [evRes, tlRes] = await Promise.all([
      supabase
        .from('plan24_events')
        .select('id, title, event_type, plan_date, start_at')
        .eq('master_cell_id', cellId)
        .is('deleted_at', null)
        .order('start_at', { ascending: false })
        .limit(40),
      supabase
        .from('dds_tl_entries')
        .select('id, top_loss, plan_date, amount')
        .eq('master_cell_id', cellId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    if (evRes.error) {
      setPlan24Options([])
      linkHints.push('Plan 24 events unavailable (need RTT access).')
    } else {
      setPlan24Options(
        ((evRes.data ?? []) as { id: string; title: string | null; event_type: string | null; plan_date: string }[]).map(
          (e) => ({
            id: e.id,
            label: `${e.plan_date} · ${e.title?.trim() || e.event_type || 'Event'}`,
          }),
        ),
      )
    }

    if (tlRes.error) {
      setDdsTlOptions([])
      linkHints.push('DDS Top Losses unavailable (need DDS access).')
    } else {
      setDdsTlOptions(
        ((tlRes.data ?? []) as { id: string; top_loss: string; plan_date: string; amount: string }[]).map((e) => ({
          id: e.id,
          label: `${e.plan_date} · ${e.top_loss}${e.amount ? ` (${e.amount})` : ''}`,
        })),
      )
    }
    setLinksHint(linkHints.length ? linkHints.join(' ') : null)
  }, [cellId])

  const loadRecord = useCallback(
    async (rid: string) => {
      setLoading(true)
      setError(null)
      const { data, error: qErr } = await supabase.from('bde_records').select('*').eq('id', rid).is('deleted_at', null).maybeSingle()
      if (qErr || !data) {
        setLoading(false)
        setError(qErr?.message ?? 'Record not found')
        return
      }
      const row = data as BdeRecordRow
      setRecordId(row.id)
      setDisplayId(row.display_id)
      setStatus(row.status)
      setTitle(row.title)
      setProblemStatement(row.problem_statement ?? '')
      setFunctionalLocation(row.functional_location ?? '')
      setComponentPart(row.component_part ?? '')
      setWhatWasChecked(row.what_was_checked ?? '')
      setNotificationNumber(row.notification_number ?? '')
      setWorkOrderNumber(row.work_order_number ?? '')
      setWhatHappened(row.what_happened ?? '')
      setWhatWereTheResults(row.what_were_the_results ?? '')
      setAreaId(row.area_id ?? '')
      setEquipmentId(row.equipment_id ?? '')
      setProblemTypeId(row.problem_type_id ?? '')
      setPlan24EventId(row.plan24_event_id ?? '')
      setPlan24EventLabel(row.plan24_event_label ?? '')
      setDdsTlEntryId(row.dds_tl_entry_id ?? '')
      setDdsTlLabel(row.dds_tl_label ?? '')
      setIpsReference(row.ips_reference ?? '')

      const [codesRes, teamRes, photoRes, actionRes] = await Promise.all([
        supabase.from('bde_record_codes').select('code_kind, code_id').eq('bde_id', rid),
        supabase.from('bde_record_team_members').select('person_id').eq('bde_id', rid),
        supabase.from('bde_record_photos').select('id, bde_id, storage_path, file_name, sort_order, created_at').eq('bde_id', rid).order('sort_order'),
        supabase
          .from('bde_actions')
          .select('*')
          .eq('bde_id', rid)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ])

      const nextCodes = emptyCodes()
      for (const c of (codesRes.data ?? []) as { code_kind: BdeCodeKind; code_id: string }[]) {
        if (nextCodes[c.code_kind]) nextCodes[c.code_kind].push(c.code_id)
      }
      setSelectedCodes(nextCodes)
      setTeamIds(((teamRes.data ?? []) as { person_id: string }[]).map((t) => t.person_id))
      const photoList = (photoRes.data ?? []) as BdePhotoRow[]
      setPhotos(photoList)
      setActions((actionRes.data ?? []) as BdeActionRow[])

      const urls: Record<string, string> = {}
      await Promise.all(
        photoList.map(async (p) => {
          const u = await signedBdePhotoUrl(p.storage_path)
          if (u) urls[p.id] = u
        }),
      )
      setPhotoUrls(urls)
      setLoading(false)
    },
    [],
  )

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    if (!isNew && id) void loadRecord(id)
  }, [id, isNew, loadRecord])

  function toggleCode(kind: BdeCodeKind, codeId: string) {
    setSelectedCodes((prev) => {
      const set = new Set(prev[kind])
      if (set.has(codeId)) set.delete(codeId)
      else set.add(codeId)
      return { ...prev, [kind]: Array.from(set) }
    })
  }

  async function persist(
    nextStatus: BdeStatus,
    opts?: { goCodes?: boolean; goList?: boolean },
  ): Promise<{ error: string | null; id: string | null }> {
    if (!cellId) return { error: 'Select a cell first.', id: null }
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return { error: 'Title is required.', id: null }

    setSaving(true)
    setError(null)

    const resolvedPlan24Label = plan24EventId
      ? (plan24Options.find((o) => o.id === plan24EventId)?.label ?? plan24EventLabel).trim() || null
      : plan24EventLabel.trim() || null
    const resolvedTlLabel = ddsTlEntryId
      ? (ddsTlOptions.find((o) => o.id === ddsTlEntryId)?.label ?? ddsTlLabel).trim() || null
      : ddsTlLabel.trim() || null

    const payload = {
      master_cell_id: cellId,
      area_id: areaId || null,
      equipment_id: equipmentId || null,
      problem_type_id: problemTypeId || null,
      status: nextStatus,
      title: trimmedTitle,
      problem_statement: problemStatement.trim() || null,
      functional_location: functionalLocation.trim() || null,
      component_part: componentPart.trim() || null,
      what_was_checked: whatWasChecked.trim() || null,
      notification_number: notificationNumber.trim() || null,
      work_order_number: workOrderNumber.trim() || null,
      what_happened: whatHappened.trim() || null,
      what_were_the_results: whatWereTheResults.trim() || null,
      plan24_event_id: plan24EventId || null,
      plan24_event_label: resolvedPlan24Label,
      dds_tl_entry_id: ddsTlEntryId || null,
      dds_tl_label: resolvedTlLabel,
      ips_reference: ipsReference.trim() || null,
      updated_by: user?.id ?? null,
      updated_by_name: actorName,
    }

    let rid = recordId
    if (!rid) {
      const { data, error: insErr } = await supabase
        .from('bde_records')
        .insert({
          ...payload,
          created_by: user?.id ?? null,
          created_by_name: actorName,
          display_id: '',
        })
        .select('id, display_id')
        .single()
      if (insErr || !data) {
        setSaving(false)
        return { error: insErr?.message ?? 'Could not create BDE', id: null }
      }
      rid = data.id as string
      setRecordId(rid)
      setDisplayId(data.display_id as string)
      navigate(`/problem-solve/bde/${rid}`, { replace: true })
    } else {
      const { error: uErr } = await supabase.from('bde_records').update(payload).eq('id', rid)
      if (uErr) {
        setSaving(false)
        return { error: uErr.message, id: rid }
      }
    }

    const codeErr = await replaceBdeCodes(rid, selectedCodes)
    if (codeErr) {
      setSaving(false)
      return { error: codeErr, id: rid }
    }
    const teamErr = await replaceBdeTeamMembers(rid, teamIds)
    if (teamErr) {
      setSaving(false)
      return { error: teamErr, id: rid }
    }

    setStatus(nextStatus)
    setSaving(false)
    if (opts?.goCodes) setStep('codes')
    if (opts?.goList) navigate('/problem-solve/bde')
    return { error: null, id: rid }
  }

  async function onSaveDetails(e?: FormEvent) {
    e?.preventDefault()
    const { error: err } = await persist('saved')
    if (err) setError(err)
  }

  async function onNext() {
    const { error: err } = await persist('saved', { goCodes: true })
    if (err) setError(err)
  }

  async function onSubmit() {
    const { error: err } = await persist('completed', { goList: true })
    if (err) setError(err)
  }

  async function onReopen() {
    const { error: err } = await persist('saved')
    if (err) setError(err)
  }

  async function onPhotoPick(files: FileList | null) {
    if (!files?.length) return
    let rid = recordId
    if (!rid) {
      const { error: err, id } = await persist('saved')
      if (err) {
        setError(err)
        return
      }
      rid = id
    }
    if (!rid) {
      setError('Save the BDE before adding photos.')
      return
    }
    let count = photos.length
    for (const file of Array.from(files)) {
      const { photo, error: upErr } = await uploadBdePhoto(rid, file, user?.id, count)
      if (upErr) {
        setError(upErr)
        break
      }
      if (photo) {
        count += 1
        setPhotos((p) => [...p, photo])
        const url = await signedBdePhotoUrl(photo.storage_path)
        if (url) setPhotoUrls((u) => ({ ...u, [photo.id]: url }))
      }
    }
  }

  async function onDeletePhoto(photo: BdePhotoRow) {
    const err = await deleteBdePhoto(photo)
    if (err) {
      setError(err)
      return
    }
    setPhotos((p) => p.filter((x) => x.id !== photo.id))
    setPhotoUrls((u) => {
      const next = { ...u }
      delete next[photo.id]
      return next
    })
  }

  async function saveAction() {
    if (!actionDraft || !recordId) return
    const t = actionDraft.title.trim()
    if (!t) {
      setError('Action title is required.')
      return
    }
    setSaving(true)
    setError(null)
    if (actionDraft.id) {
      const { error: uErr } = await supabase
        .from('bde_actions')
        .update({
          title: t,
          status: actionDraft.status,
          due_date: actionDraft.due_date || null,
          owner_person_id: actionDraft.owner_person_id || null,
          system_text: actionDraft.system_text.trim() || null,
          updated_by: user?.id ?? null,
        })
        .eq('id', actionDraft.id)
      setSaving(false)
      if (uErr) {
        setError(uErr.message)
        return
      }
    } else {
      const { error: insErr } = await supabase.from('bde_actions').insert({
        bde_id: recordId,
        title: t,
        status: actionDraft.status,
        due_date: actionDraft.due_date || null,
        owner_person_id: actionDraft.owner_person_id || null,
        system_text: actionDraft.system_text.trim() || null,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
        display_id: '',
      })
      setSaving(false)
      if (insErr) {
        setError(insErr.message)
        return
      }
    }
    setActionDraft(null)
    const { data } = await supabase
      .from('bde_actions')
      .select('*')
      .eq('bde_id', recordId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setActions((data ?? []) as BdeActionRow[])
  }

  async function deleteAction(action: BdeActionRow) {
    if (!window.confirm(`Delete ${action.display_id}?`)) return
    const { error: uErr } = await supabase
      .from('bde_actions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', action.id)
    if (uErr) {
      setError(uErr.message)
      return
    }
    setActions((a) => a.filter((x) => x.id !== action.id))
  }

  const teamMatches = useMemo(() => {
    const q = teamQuery.trim().toLowerCase()
    const chosen = new Set(teamIds)
    return people
      .filter((p) => !chosen.has(p.id))
      .filter((p) => !q || personLabel(p).toLowerCase().includes(q))
      .slice(0, 8)
  }, [people, teamIds, teamQuery])

  if (scopeStatus === 'loading' || loading) {
    return <p className="text-sm text-muted">Loading…</p>
  }

  if (!cellId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        Select a cell in the scope bar, then create a BDE.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/problem-solve/bde"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <div className="flex flex-wrap gap-2">
          {status === 'completed' ? (
            <button
              type="button"
              className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-canvas"
              disabled={saving}
              onClick={() => void onReopen()}
            >
              Move to Saved
            </button>
          ) : null}
          {step === 'details' ? (
            <>
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-50"
                disabled={saving}
                onClick={() => void onSaveDetails()}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                disabled={saving}
                onClick={() => void onNext()}
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-canvas"
                onClick={() => setStep('details')}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-50"
                disabled={saving}
                onClick={() => void onSaveDetails()}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                disabled={saving}
                onClick={() => void onSubmit()}
              >
                Submit
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2 rounded-2xl border border-border bg-surface-raised/40 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className={labelClass}>
          Area
          <select
            className={selectClass}
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value)
              setEquipmentId('')
            }}
          >
            <option value="">—</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Equipment
          <select className={selectClass} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            <option value="">—</option>
            {equipmentForArea.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Problem type
          <select className={selectClass} value={problemTypeId} onChange={(e) => setProblemTypeId(e.target.value)}>
            <option value="">—</option>
            {problemTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className={labelClass}>
          BDE ID
          <p className="mt-1 flex h-10 items-center rounded-xl border border-border bg-canvas/40 px-3 font-mono text-sm">
            {displayId}
          </p>
        </div>
        <div className={labelClass}>
          Status
          <p className="mt-1 flex h-10 items-center px-1 text-sm font-medium capitalize">{status}</p>
        </div>
      </div>

      {step === 'details' ? (
        <form className="grid gap-4 lg:grid-cols-[1fr_18rem]" onSubmit={(e) => void onSaveDetails(e)}>
          <div className="space-y-3 rounded-2xl border border-border bg-surface-raised/30 p-4">
            <label className={labelClass}>
              Title <span className="text-danger">*</span>
              <input
                className={inputClass}
                value={title}
                maxLength={100}
                required
                onChange={(e) => setTitle(e.target.value)}
              />
              <span className="mt-0.5 block text-[10px] text-muted">{title.length}/100</span>
            </label>
            <label className={labelClass}>
              BDE problem statement
              <textarea
                className={`${inputClass} min-h-[4rem]`}
                value={problemStatement}
                maxLength={2000}
                onChange={(e) => setProblemStatement(e.target.value)}
              />
              <span className="mt-0.5 block text-[10px] text-muted">{problemStatement.length}/2000</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className={labelClass}>
                Functional location # (asset tag)
                <input
                  className={inputClass}
                  value={functionalLocation}
                  maxLength={100}
                  onChange={(e) => setFunctionalLocation(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Component / Part
                <input
                  className={inputClass}
                  value={componentPart}
                  maxLength={100}
                  onChange={(e) => setComponentPart(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Notification #
                <input
                  className={inputClass}
                  value={notificationNumber}
                  maxLength={100}
                  onChange={(e) => setNotificationNumber(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Work order #
                <input
                  className={inputClass}
                  value={workOrderNumber}
                  maxLength={100}
                  onChange={(e) => setWorkOrderNumber(e.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                What happened?
                <textarea
                  className={`${inputClass} min-h-[5rem]`}
                  value={whatHappened}
                  maxLength={2000}
                  onChange={(e) => setWhatHappened(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                What was checked?
                <textarea
                  className={`${inputClass} min-h-[5rem]`}
                  value={whatWasChecked}
                  maxLength={2000}
                  onChange={(e) => setWhatWasChecked(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                What were the results?
                <textarea
                  className={`${inputClass} min-h-[5rem]`}
                  value={whatWereTheResults}
                  maxLength={2000}
                  onChange={(e) => setWhatWereTheResults(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-surface-raised/30 p-4">
              <h2 className="text-sm font-semibold">Team members</h2>
              <input
                className={inputClass}
                placeholder="Search people directory"
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
              />
              {teamQuery.trim() && teamMatches.length > 0 ? (
                <ul className="mt-2 max-h-40 overflow-auto rounded-lg border border-border">
                  {teamMatches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent-dim"
                        onClick={() => {
                          setTeamIds((ids) => [...ids, p.id])
                          setTeamQuery('')
                        }}
                      >
                        {personLabel(p)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-2 space-y-1">
                {teamIds.map((pid) => {
                  const p = people.find((x) => x.id === pid)
                  return (
                    <li
                      key={pid}
                      className="flex items-center justify-between rounded-lg bg-canvas/50 px-2 py-1 text-sm"
                    >
                      <span>{p ? personLabel(p) : pid.slice(0, 8)}</span>
                      <button
                        type="button"
                        className="p-1 text-muted hover:text-danger"
                        onClick={() => setTeamIds((ids) => ids.filter((x) => x !== pid))}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-surface-raised/30 p-4">
              <h2 className="text-sm font-semibold">Photos (up to {BDE_MAX_PHOTOS})</h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {photos.map((ph) => (
                  <div key={ph.id} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                    {photoUrls[ph.id] ? (
                      <img src={photoUrls[ph.id]} alt={ph.file_name ?? 'BDE photo'} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-muted">…</div>
                    )}
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white"
                      onClick={() => void onDeletePhoto(ph)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < BDE_MAX_PHOTOS ? (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted hover:bg-canvas">
                    <ImagePlus className="size-6" />
                    <span className="text-xs">Add</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void onPhotoPick(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">Soft links</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Optional links to Plan 24, DDS Top Losses, and IPS. Labels are stored even if the source is later
                  removed.
                </p>
              </div>
              <Link to="/problem-solve/ips" className="text-xs font-medium text-accent hover:underline">
                Open IPS
              </Link>
            </div>
            {linksHint ? <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{linksHint}</p> : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className={labelClass}>
                Plan 24 event
                <select
                  className={selectClass}
                  value={plan24EventId}
                  onChange={(e) => {
                    const id = e.target.value
                    setPlan24EventId(id)
                    const opt = plan24Options.find((o) => o.id === id)
                    if (opt) setPlan24EventLabel(opt.label)
                  }}
                >
                  <option value="">—</option>
                  {plan24Options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {!plan24Options.length ? (
                  <input
                    className={inputClass}
                    placeholder="Manual Plan 24 label (optional)"
                    value={plan24EventLabel}
                    onChange={(e) => setPlan24EventLabel(e.target.value)}
                  />
                ) : null}
              </label>
              <label className={labelClass}>
                DDS Top Loss
                <select
                  className={selectClass}
                  value={ddsTlEntryId}
                  onChange={(e) => {
                    const id = e.target.value
                    setDdsTlEntryId(id)
                    const opt = ddsTlOptions.find((o) => o.id === id)
                    if (opt) setDdsTlLabel(opt.label)
                  }}
                >
                  <option value="">—</option>
                  {ddsTlOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {!ddsTlOptions.length ? (
                  <input
                    className={inputClass}
                    placeholder="Manual top loss label (optional)"
                    value={ddsTlLabel}
                    onChange={(e) => setDdsTlLabel(e.target.value)}
                  />
                ) : null}
              </label>
              <label className={labelClass}>
                IPS reference
                <input
                  className={inputClass}
                  placeholder="e.g. IPS-0012 or short note"
                  value={ipsReference}
                  maxLength={200}
                  onChange={(e) => setIpsReference(e.target.value)}
                />
              </label>
            </div>
            {(plan24EventLabel || ddsTlLabel || ipsReference) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {plan24EventLabel ? (
                  <span className="rounded-full border border-border bg-canvas/60 px-2.5 py-0.5 text-xs">
                    Plan 24: {plan24EventLabel}
                  </span>
                ) : null}
                {ddsTlLabel ? (
                  <span className="rounded-full border border-border bg-canvas/60 px-2.5 py-0.5 text-xs">
                    Top loss: {ddsTlLabel}
                  </span>
                ) : null}
                {ipsReference ? (
                  <span className="rounded-full border border-border bg-canvas/60 px-2.5 py-0.5 text-xs">
                    IPS: {ipsReference}
                  </span>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface-raised/30 p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">Problem Solve Actions</h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-canvas disabled:opacity-50"
                disabled={!recordId}
                onClick={() =>
                  setActionDraft({
                    open: true,
                    title: '',
                    status: 'open',
                    due_date: '',
                    owner_person_id: '',
                    system_text: '',
                  })
                }
              >
                <Plus className="size-4" />
                New Problem Solve Action
              </button>
            </div>
            {!recordId ? (
              <p className="mt-2 text-xs text-muted">Save the BDE first to add actions.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted">
                    <tr>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Due</th>
                      <th className="px-2 py-2">Owner</th>
                      <th className="px-2 py-2">System</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {actions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-4 text-muted">
                          No actions yet.
                        </td>
                      </tr>
                    ) : (
                      actions.map((a) => {
                        const owner = people.find((p) => p.id === a.owner_person_id)
                        return (
                          <tr key={a.id} className="border-b border-border/60">
                            <td className="px-2 py-2">{bdeActionStatusLabel(a.status)}</td>
                            <td className="px-2 py-2">
                              <span className="font-mono text-xs text-muted">{a.display_id}</span>
                              <div>{a.title}</div>
                            </td>
                            <td className="px-2 py-2">{a.due_date ?? '—'}</td>
                            <td className="px-2 py-2">{owner ? personLabel(owner) : '—'}</td>
                            <td className="px-2 py-2">{a.system_text ?? '—'}</td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="rounded p-1 text-muted hover:bg-black/[0.06]"
                                  onClick={() =>
                                    setActionDraft({
                                      open: true,
                                      id: a.id,
                                      title: a.title,
                                      status: a.status,
                                      due_date: a.due_date ?? '',
                                      owner_person_id: a.owner_person_id ?? '',
                                      system_text: a.system_text ?? '',
                                    })
                                  }
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-danger hover:bg-danger/10"
                                  onClick={() => void deleteAction(a)}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </form>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(['activity', 'object_part', 'damage', 'cause'] as BdeCodeKind[]).map((kind) => {
            const meta = BDE_CODE_KIND_META[kind]
            const q = codeSearch[kind].trim().toLowerCase()
            const opts = codeOptions[kind].filter((o) => !q || o.label.toLowerCase().includes(q))
            const selected = new Set(selectedCodes[kind])
            return (
              <section key={kind} className="rounded-2xl border border-border bg-surface-raised/30 p-3">
                <h2 className="text-sm font-semibold">
                  <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded bg-accent/15 text-xs text-accent">
                    {meta.letter}
                  </span>
                  {meta.label}
                </h2>
                <input
                  className={`${inputClass} mt-2`}
                  placeholder="Search codes"
                  value={codeSearch[kind]}
                  onChange={(e) => setCodeSearch((s) => ({ ...s, [kind]: e.target.value }))}
                />
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                  {opts.map((o) => {
                    const on = selected.has(o.id)
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                            on ? 'bg-accent-dim text-accent' : 'hover:bg-canvas'
                          }`}
                          onClick={() => toggleCode(kind, o.id)}
                        >
                          <span>{o.label}</span>
                          <span
                            className={`size-4 rounded border ${on ? 'border-accent bg-accent' : 'border-border'}`}
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {actionDraft?.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-4 shadow-xl">
            <h3 className="font-display text-lg font-semibold">
              {actionDraft.id ? 'Edit action' : 'New problem solve action'}
            </h3>
            <div className="mt-3 space-y-2">
              <label className={labelClass}>
                Title *
                <input
                  className={inputClass}
                  value={actionDraft.title}
                  onChange={(e) => setActionDraft({ ...actionDraft, title: e.target.value })}
                />
              </label>
              <label className={labelClass}>
                Status
                <select
                  className={selectClass}
                  value={actionDraft.status}
                  onChange={(e) =>
                    setActionDraft({ ...actionDraft, status: e.target.value as BdeActionStatus })
                  }
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className={labelClass}>
                Due date
                <input
                  type="date"
                  className={inputClass}
                  value={actionDraft.due_date}
                  onChange={(e) => setActionDraft({ ...actionDraft, due_date: e.target.value })}
                />
              </label>
              <label className={labelClass}>
                Action owner
                <select
                  className={selectClass}
                  value={actionDraft.owner_person_id}
                  onChange={(e) => setActionDraft({ ...actionDraft, owner_person_id: e.target.value })}
                >
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {personLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                System
                <input
                  className={inputClass}
                  value={actionDraft.system_text}
                  onChange={(e) => setActionDraft({ ...actionDraft, system_text: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-2 text-sm"
                onClick={() => setActionDraft(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"
                disabled={saving}
                onClick={() => void saveAction()}
              >
                Save action
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
