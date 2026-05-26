import type { SupabaseClient } from '@supabase/supabase-js'
import { ddsP2pQuestionKey } from './ddsP2pQuestionKey'

export type DdsP2pKpiBreakdownItem = {
  roster_role_id: string
  role_name: string
  question_key: string
  prompt: string
  value: number
  comment: string
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
    const v = numOrNull(o.value as number | string | null)
    if (!roster_role_id || v === null) continue
    out.push({ roster_role_id, role_name, question_key, prompt, value: v, comment })
  }
  return out
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
    await clearRollupsForKpis(supabase, { masterCellId, planDate, shiftKind, kpiIds, updatedBy })
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
      'audit_id, question_kind, standard_question_id, soft_question_id, answer_yes_no, kpi_link_value, kpi_link_comment',
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
        const cmt = (ans.kpi_link_comment ?? '').trim()
        if (!cmt) continue
        const key = ddsP2pQuestionKey(qKind, qid)
        parts.push({
          roster_role_id: rosterRoleId,
          role_name: roleName.get(rosterRoleId) ?? rosterRoleId,
          question_key: key,
          prompt: promptByKey.get(key) ?? '',
          value: val,
          comment: cmt,
        })
      }
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

async function clearRollupsForKpis(
  supabase: SupabaseClient,
  args: { masterCellId: string; planDate: string; shiftKind: string; kpiIds: string[]; updatedBy: string | null },
) {
  const { masterCellId, planDate, shiftKind, kpiIds, updatedBy } = args
  for (const kpiId of kpiIds) {
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
