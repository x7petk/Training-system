import type { SupabaseClient } from '@supabase/supabase-js'
import { DDS_MEETING_SHIFT_KIND } from './ddsMeetingDay'
import { ddsP2pQuestionKey } from './ddsP2pQuestionKey'
import { isDdsKpiSiteByLine } from './ddsKpiSitePresentation'

export type DdsP2pKpiBreakdownItem = {
  roster_role_id: string
  role_name: string
  question_key: string
  prompt: string
  value: number
  comment: string
  line_id?: string
  line_name?: string
}

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseDdsP2pKpiBreakdown(raw: unknown): DdsP2pKpiBreakdownItem[] {
  if (!raw || !Array.isArray(raw)) return []
  const out: DdsP2pKpiBreakdownItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const roster_role_id = typeof o.roster_role_id === 'string' ? o.roster_role_id : ''
    const role_name = typeof o.role_name === 'string' ? o.role_name : ''
    const question_key = typeof o.question_key === 'string' ? o.question_key : ''
    const prompt = typeof o.prompt === 'string' ? o.prompt : ''
    const comment = typeof o.comment === 'string' ? o.comment : ''
    const line_id = typeof o.line_id === 'string' ? o.line_id : undefined
    const line_name = typeof o.line_name === 'string' ? o.line_name : undefined
    const v = numOrNull(o.value as number | string | null)
    if (!roster_role_id || v === null) continue
    out.push({ roster_role_id, role_name, question_key, prompt, value: v, comment, line_id, line_name })
  }
  return out
}

export function kpiHasDdsCommentDetail(comment: string | null | undefined, p2pBreakdown: unknown): boolean {
  if ((comment ?? '').trim()) return true
  return parseDdsP2pKpiBreakdown(p2pBreakdown).some((item) => item.comment.trim())
}

export type DdsKpiLineEntryMergeRow = {
  id: string
  shift_kind: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown: unknown
}

export type DdsKpiLineEntryMerged = {
  id: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown: DdsP2pKpiBreakdownItem[] | null
}

/** Line / Plant / Site DDS: P2P by-line rollups live on day/night rows; merge for meeting-day table. */
export function mergeMeetingDayKpiLineEntry(rows: DdsKpiLineEntryMergeRow[]): DdsKpiLineEntryMerged | null {
  if (rows.length === 0) return null
  const perShift = rows.filter((r) => r.shift_kind !== DDS_MEETING_SHIFT_KIND)
  const sources = perShift.length > 0 ? perShift : rows
  const breakdown = sources.flatMap((r) => parseDdsP2pKpiBreakdown(r.p2p_breakdown))
  const meetingRow = rows.find((r) => r.shift_kind === DDS_MEETING_SHIFT_KIND)
  const primary = meetingRow ?? sources[0]!

  if (breakdown.length > 0) {
    return {
      id: primary.id,
      value_numeric: breakdown.reduce((sum, part) => sum + part.value, 0),
      comment: primary.comment,
      p2p_breakdown: breakdown,
    }
  }

  if (!kpiHasDdsCommentDetail(primary.comment, primary.p2p_breakdown) && primary.value_numeric == null) {
    const withValue = sources.find((r) => r.value_numeric != null)
    if (withValue) {
      return {
        id: withValue.id,
        value_numeric: withValue.value_numeric,
        comment: withValue.comment,
        p2p_breakdown: null,
      }
    }
    return null
  }

  return {
    id: primary.id,
    value_numeric: primary.value_numeric,
    comment: primary.comment,
    p2p_breakdown: null,
  }
}

export function mergeMeetingDayLineEntries(
  rows: Array<{
    id: string
    master_cell_id: string
    line_id: string
    kpi_id: string
    shift_kind: string
    value_numeric: number | null
    comment: string | null
    p2p_breakdown: unknown
  }>,
): Array<{
  id: string
  master_cell_id: string
  line_id: string
  kpi_id: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown: DdsP2pKpiBreakdownItem[] | null
}> {
  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${row.master_cell_id}\0${row.line_id}\0${row.kpi_id}`
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  const out: Array<{
    id: string
    master_cell_id: string
    line_id: string
    kpi_id: string
    value_numeric: number | null
    comment: string | null
    p2p_breakdown: DdsP2pKpiBreakdownItem[] | null
  }> = []
  for (const [, groupRows] of groups) {
    const first = groupRows[0]!
    const merged = mergeMeetingDayKpiLineEntry(groupRows)
    if (
      !merged &&
      !groupRows.some((r) => r.value_numeric != null || kpiHasDdsCommentDetail(r.comment, r.p2p_breakdown))
    ) {
      continue
    }
    out.push({
      id: merged?.id ?? first.id,
      master_cell_id: first.master_cell_id,
      line_id: first.line_id,
      kpi_id: first.kpi_id,
      value_numeric: merged?.value_numeric ?? first.value_numeric,
      comment: merged?.comment ?? first.comment,
      p2p_breakdown: merged?.p2p_breakdown ?? null,
    })
  }
  return out
}

export type DdsKpiCellEntryMergeRow = {
  id: string
  shift_kind: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown: unknown
}

export type DdsKpiCellEntryMerged = {
  id: string
  value_numeric: number | null
  comment: string | null
  p2p_breakdown: DdsP2pKpiBreakdownItem[] | null
}

/** Line / Plant / Site DDS: P2P rollups live on day/night rows; merge for meeting-day tiles. */
export function mergeMeetingDayKpiCellEntry(rows: DdsKpiCellEntryMergeRow[]): DdsKpiCellEntryMerged | null {
  if (rows.length === 0) return null
  const perShift = rows.filter((r) => r.shift_kind !== DDS_MEETING_SHIFT_KIND)
  const sources = perShift.length > 0 ? perShift : rows
  const breakdown = sources.flatMap((r) => parseDdsP2pKpiBreakdown(r.p2p_breakdown))
  const meetingRow = rows.find((r) => r.shift_kind === DDS_MEETING_SHIFT_KIND)
  const primary = meetingRow ?? sources[0]!

  if (breakdown.length > 0) {
    return {
      id: primary.id,
      value_numeric: breakdown.reduce((sum, part) => sum + part.value, 0),
      comment: primary.comment,
      p2p_breakdown: breakdown,
    }
  }

  if (!kpiHasDdsCommentDetail(primary.comment, primary.p2p_breakdown) && primary.value_numeric == null) {
    const withValue = sources.find((r) => r.value_numeric != null)
    if (withValue) {
      return {
        id: withValue.id,
        value_numeric: withValue.value_numeric,
        comment: withValue.comment,
        p2p_breakdown: null,
      }
    }
    return null
  }

  return {
    id: primary.id,
    value_numeric: primary.value_numeric,
    comment: primary.comment,
    p2p_breakdown: null,
  }
}

export function p2pRollupEventMatchesMeetingDay(args: {
  eventShiftKind: string
  viewShiftKind: string
  meetingSurface: boolean
}): boolean {
  if (!args.meetingSurface) return args.eventShiftKind === args.viewShiftKind
  return args.eventShiftKind !== DDS_MEETING_SHIFT_KIND
}

type LinkedQ = { kind: 'standard' | 'soft'; id: string; prompt: string; kpiId: string }

type AuditRow = { id: string; roster_role_id: string; submitted_at: string }

type AnswerRow = {
  audit_id: string
  question_kind: string
  standard_question_id: string | null
  soft_question_id: string | null
  answer_yes_no: boolean | null
  kpi_link_value: number | string | null
  kpi_link_comment: string | null
  kpi_link_line_id: string | null
}

/** Recompute KPI cell entries for all KPIs linked from P2P questions for this cell/date/shift. */
export async function refreshKpiP2pRollups(
  supabase: SupabaseClient,
  args: { masterCellId: string; planDate: string; shiftKind: string; updatedBy: string | null },
): Promise<void> {
  const { masterCellId, planDate, shiftKind, updatedBy } = args

  const [{ data: stdRows, error: stdErr }, { data: softRows, error: softErr }] = await Promise.all([
    supabase
      .from('dds_p2p_standard_questions')
      .select('id, prompt, linked_kpi_id')
      .not('linked_kpi_id', 'is', null),
    supabase
      .from('dds_p2p_cell_soft_point_questions')
      .select('id, prompt, linked_kpi_id')
      .eq('master_cell_id', masterCellId)
      .not('linked_kpi_id', 'is', null),
  ])
  if (stdErr) throw new Error(stdErr.message)
  if (softErr) throw new Error(softErr.message)

  const linked: LinkedQ[] = []
  for (const r of (stdRows ?? []) as { id: string; prompt: string; linked_kpi_id: string | null }[]) {
    if (r.linked_kpi_id) linked.push({ kind: 'standard', id: r.id, prompt: r.prompt, kpiId: r.linked_kpi_id })
  }
  for (const r of (softRows ?? []) as { id: string; prompt: string; linked_kpi_id: string | null }[]) {
    if (r.linked_kpi_id) linked.push({ kind: 'soft', id: r.id, prompt: r.prompt, kpiId: r.linked_kpi_id })
  }

  const kpiIds = [...new Set(linked.map((l) => l.kpiId))]
  if (kpiIds.length === 0) return

  const { data: kpiMetaRows, error: kpiMetaErr } = await supabase
    .from('dds_kpis')
    .select('id, site_dds_presentation')
    .in('id', kpiIds)
  if (kpiMetaErr) throw new Error(kpiMetaErr.message)
  const kpiByLine = new Map<string, boolean>()
  for (const row of (kpiMetaRows ?? []) as { id: string; site_dds_presentation: string | null }[]) {
    kpiByLine.set(row.id, isDdsKpiSiteByLine(row.site_dds_presentation))
  }

  const { data: lineRows, error: lineErr } = await supabase
    .from('dds_cell_lines')
    .select('id, name')
    .eq('master_cell_id', masterCellId)
    .eq('active', true)
  if (lineErr) throw new Error(lineErr.message)
  const lineName = new Map<string, string>()
  for (const row of (lineRows ?? []) as { id: string; name: string }[]) {
    lineName.set(row.id, row.name)
  }

  const byKpi = new Map<string, LinkedQ[]>()
  for (const l of linked) {
    if (!byKpi.has(l.kpiId)) byKpi.set(l.kpiId, [])
    byKpi.get(l.kpiId)!.push(l)
  }

  const { data: auditData, error: aErr } = await supabase
    .from('dds_p2p_audits')
    .select('id, roster_role_id, submitted_at')
    .eq('master_cell_id', masterCellId)
    .eq('plan_date', planDate)
    .eq('shift_kind', shiftKind)
    .order('submitted_at', { ascending: false })
  if (aErr) throw new Error(aErr.message)

  const audits = (auditData ?? []) as AuditRow[]
  const latestAuditIdByRole = new Map<string, string>()
  for (const a of audits) {
    if (!latestAuditIdByRole.has(a.roster_role_id)) latestAuditIdByRole.set(a.roster_role_id, a.id)
  }
  const latestIds = [...new Set(latestAuditIdByRole.values())]
  if (latestIds.length === 0) {
    await clearRollupsForKpis(supabase, { masterCellId, planDate, shiftKind, kpiIds, kpiByLine, updatedBy })
    return
  }

  const roleIds = [...latestAuditIdByRole.keys()]
  const { data: rolesData, error: rErr } = await supabase
    .from('plan24_roster_roles')
    .select('id, name')
    .in('id', roleIds)
  if (rErr) throw new Error(rErr.message)
  const roleName = new Map<string, string>()
  for (const row of (rolesData ?? []) as { id: string; name: string }[]) {
    roleName.set(row.id, row.name)
  }

  const { data: ansData, error: ansErr } = await supabase
    .from('dds_p2p_audit_answers')
    .select(
      'audit_id, question_kind, standard_question_id, soft_question_id, answer_yes_no, kpi_link_value, kpi_link_comment, kpi_link_line_id',
    )
    .in('audit_id', latestIds)
  if (ansErr) throw new Error(ansErr.message)

  const answersByAudit = new Map<string, AnswerRow[]>()
  for (const row of (ansData ?? []) as AnswerRow[]) {
    const list = answersByAudit.get(row.audit_id) ?? []
    list.push(row)
    answersByAudit.set(row.audit_id, list)
  }

  for (const kpiId of kpiIds) {
    const qs = byKpi.get(kpiId) ?? []
    const stdSet = new Set(qs.filter((q) => q.kind === 'standard').map((q) => q.id))
    const softSet = new Set(qs.filter((q) => q.kind === 'soft').map((q) => q.id))
    const promptByKey = new Map(qs.map((q) => [ddsP2pQuestionKey(q.kind, q.id), q.prompt]))
    const byLine = kpiByLine.get(kpiId) === true

    const parts: DdsP2pKpiBreakdownItem[] = []
    for (const [rosterRoleId, auditId] of latestAuditIdByRole) {
      const rows = answersByAudit.get(auditId) ?? []
      for (const ans of rows) {
        if (ans.answer_yes_no !== true) continue
        const qKind = ans.question_kind as 'standard' | 'soft'
        const qid = qKind === 'standard' ? ans.standard_question_id : ans.soft_question_id
        if (!qid) continue
        const inSet = qKind === 'standard' ? stdSet.has(qid) : softSet.has(qid)
        if (!inSet) continue
        const val = numOrNull(ans.kpi_link_value)
        if (val === null) continue
        if (byLine && val <= 0) continue
        const cmt = (ans.kpi_link_comment ?? '').trim()
        if (!cmt) continue
        const lineId = ans.kpi_link_line_id ?? undefined
        if (byLine && !lineId) continue
        const key = ddsP2pQuestionKey(qKind, qid)
        parts.push({
          roster_role_id: rosterRoleId,
          role_name: roleName.get(rosterRoleId) ?? rosterRoleId,
          question_key: key,
          prompt: promptByKey.get(key) ?? '',
          value: val,
          comment: cmt,
          line_id: lineId,
          line_name: lineId ? lineName.get(lineId) : undefined,
        })
      }
    }

    if (byLine) {
      await upsertByLineRollup(supabase, {
        masterCellId,
        planDate,
        shiftKind,
        kpiId,
        parts,
        updatedBy,
      })
      continue
    }

    const sum = parts.reduce((a, p) => a + p.value, 0)
    const { data: existing, error: exErr } = await supabase
      .from('dds_kpi_cell_entries')
      .select('id, p2p_breakdown')
      .eq('master_cell_id', masterCellId)
      .eq('kpi_id', kpiId)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
      .maybeSingle()
    if (exErr) throw new Error(exErr.message)

    const hadP2p = Boolean(existing?.p2p_breakdown && Array.isArray(existing.p2p_breakdown) && existing.p2p_breakdown.length > 0)

    if (parts.length === 0) {
      if (hadP2p) {
        const { error: uErr } = await supabase
          .from('dds_kpi_cell_entries')
          .update({
            value_numeric: null,
            comment: null,
            p2p_breakdown: null,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
          })
          .eq('master_cell_id', masterCellId)
          .eq('kpi_id', kpiId)
          .eq('plan_date', planDate)
          .eq('shift_kind', shiftKind)
        if (uErr) throw new Error(uErr.message)
      }
      continue
    }

    const { error: upErr } = await supabase.from('dds_kpi_cell_entries').upsert(
      {
        master_cell_id: masterCellId,
        kpi_id: kpiId,
        plan_date: planDate,
        shift_kind: shiftKind,
        value_numeric: sum,
        comment: null,
        p2p_breakdown: parts,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'master_cell_id,kpi_id,plan_date,shift_kind' },
    )
    if (upErr) throw new Error(upErr.message)
  }
}

async function upsertByLineRollup(
  supabase: SupabaseClient,
  args: {
    masterCellId: string
    planDate: string
    shiftKind: string
    kpiId: string
    parts: DdsP2pKpiBreakdownItem[]
    updatedBy: string | null
  },
) {
  const { masterCellId, planDate, shiftKind, kpiId, parts, updatedBy } = args

  const { data: existingRows, error: exErr } = await supabase
    .from('dds_kpi_line_entries')
    .select('id, line_id, p2p_breakdown')
    .eq('master_cell_id', masterCellId)
    .eq('kpi_id', kpiId)
    .eq('plan_date', planDate)
    .eq('shift_kind', shiftKind)
  if (exErr) throw new Error(exErr.message)

  const partsByLine = new Map<string, DdsP2pKpiBreakdownItem[]>()
  for (const part of parts) {
    if (!part.line_id) continue
    const list = partsByLine.get(part.line_id) ?? []
    list.push(part)
    partsByLine.set(part.line_id, list)
  }

  const touchedLineIds = new Set(partsByLine.keys())
  for (const row of (existingRows ?? []) as { id: string; line_id: string; p2p_breakdown: unknown }[]) {
    const hadP2p = Boolean(row.p2p_breakdown && Array.isArray(row.p2p_breakdown) && row.p2p_breakdown.length > 0)
    if (!hadP2p) continue
    if (touchedLineIds.has(row.line_id)) continue
    const { error: uErr } = await supabase
      .from('dds_kpi_line_entries')
      .update({
        value_numeric: null,
        comment: null,
        p2p_breakdown: null,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (uErr) throw new Error(uErr.message)
  }

  for (const [lineId, lineParts] of partsByLine) {
    const sum = lineParts.reduce((a, p) => a + p.value, 0)
    const { error: upErr } = await supabase.from('dds_kpi_line_entries').upsert(
      {
        master_cell_id: masterCellId,
        line_id: lineId,
        kpi_id: kpiId,
        plan_date: planDate,
        shift_kind: shiftKind,
        value_numeric: sum,
        comment: null,
        p2p_breakdown: lineParts,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'line_id,kpi_id,plan_date,shift_kind' },
    )
    if (upErr) throw new Error(upErr.message)
  }
}

async function clearRollupsForKpis(
  supabase: SupabaseClient,
  args: {
    masterCellId: string
    planDate: string
    shiftKind: string
    kpiIds: string[]
    kpiByLine: Map<string, boolean>
    updatedBy: string | null
  },
) {
  const { masterCellId, planDate, shiftKind, kpiIds, kpiByLine, updatedBy } = args
  for (const kpiId of kpiIds) {
    if (kpiByLine.get(kpiId)) {
      const { data: lineRows, error: lineExErr } = await supabase
        .from('dds_kpi_line_entries')
        .select('id, p2p_breakdown')
        .eq('master_cell_id', masterCellId)
        .eq('kpi_id', kpiId)
        .eq('plan_date', planDate)
        .eq('shift_kind', shiftKind)
      if (lineExErr) throw new Error(lineExErr.message)
      for (const row of (lineRows ?? []) as { id: string; p2p_breakdown: unknown }[]) {
        const hadP2p = Boolean(row.p2p_breakdown && Array.isArray(row.p2p_breakdown) && row.p2p_breakdown.length > 0)
        if (!hadP2p) continue
        const { error: uErr } = await supabase
          .from('dds_kpi_line_entries')
          .update({
            value_numeric: null,
            comment: null,
            p2p_breakdown: null,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        if (uErr) throw new Error(uErr.message)
      }
      continue
    }

    const { data: existing, error: exErr } = await supabase
      .from('dds_kpi_cell_entries')
      .select('id, p2p_breakdown')
      .eq('master_cell_id', masterCellId)
      .eq('kpi_id', kpiId)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
      .maybeSingle()
    if (exErr) throw new Error(exErr.message)
    const hadP2p = Boolean(existing?.p2p_breakdown && Array.isArray(existing.p2p_breakdown) && existing.p2p_breakdown.length > 0)
    if (!hadP2p) continue
    const { error: uErr } = await supabase
      .from('dds_kpi_cell_entries')
      .update({
        value_numeric: null,
        comment: null,
        p2p_breakdown: null,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('master_cell_id', masterCellId)
      .eq('kpi_id', kpiId)
      .eq('plan_date', planDate)
      .eq('shift_kind', shiftKind)
    if (uErr) throw new Error(uErr.message)
  }
}
