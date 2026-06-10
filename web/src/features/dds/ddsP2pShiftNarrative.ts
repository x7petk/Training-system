import { type DdsP2pResponseKind } from './ddsP2pResponseKind'

export type P2pNarrativeQuestionContext = {
  key: string
  groupName: string
  prompt: string
  responseKind: DdsP2pResponseKind
  targetNumber: number | null
  linkedKpiLabel: string | null
}

export type P2pNarrativeAnswerSnapshot = {
  yesNo: boolean | null
  num: number | null
  comment: string
}

export type P2pNarrativeInsight = {
  priority: number
  topicLabel: string
  finding: string
  suggestion: string
  highPriority: boolean
}

export type P2pRoleNarrativeInput = {
  roleId: string
  roleName: string
  submitted: boolean
  sheetComment: string
  gaps: string[]
  planIssueTotal: number
  planDeviations: number
  planCilDefects: number
  planQualityFails: number
  completionMinPct: number | null
  questions: P2pNarrativeQuestionContext[]
  answers: Record<string, P2pNarrativeAnswerSnapshot | undefined>
}

export type P2pRoleNarrative = {
  roleId: string
  roleName: string
  tone: 'good' | 'watch' | 'urgent'
  submitted: boolean
  headline: string
  gaps: string[]
  insights: P2pNarrativeInsight[]
  action: string
}

export type P2pShiftNarrative = {
  summary: string
  roles: P2pRoleNarrative[]
  attentionCount: number
  insightCount: number
}

type TopicKind = 'safety' | 'hazard' | 'incident' | 'quality' | 'metric' | 'comment'

type TopicMeta = {
  kind: TopicKind
  priority: number
  label: string
  highPriority: boolean
}

function compactText(text: string, max = 110): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

/** Classify P2P topic from group, prompt, and linked KPI label — not Plan-24 CIL defects. */
function classifyTopic(q: P2pNarrativeQuestionContext): TopicMeta {
  const label = (q.linkedKpiLabel ?? '').trim()
  const hay = `${q.groupName} ${q.prompt} ${label}`.toLowerCase()

  if (/\bhazard/.test(hay)) {
    return { kind: 'hazard', priority: 1, label: 'Hazard', highPriority: true }
  }
  if (/\bincident/.test(hay) && !/\bdefect/.test(hay)) {
    return { kind: 'incident', priority: 2, label: 'Incident', highPriority: true }
  }
  if (/\bsafety/.test(hay)) {
    return { kind: 'safety', priority: 0, label: 'Safety', highPriority: true }
  }
  if (/\bquality/.test(hay) || /\bconcern/.test(hay)) {
    return { kind: 'quality', priority: 3, label: 'Quality', highPriority: true }
  }
  if (label) {
    return { kind: 'metric', priority: 4, label: label, highPriority: false }
  }
  return { kind: 'comment', priority: 5, label: 'Comment', highPriority: false }
}

function metricCount(snap: P2pNarrativeAnswerSnapshot): number | null {
  if (snap.num == null || !Number.isFinite(snap.num) || snap.num < 0) return null
  return snap.num
}

function shouldAnalyzeAnswer(
  q: P2pNarrativeQuestionContext,
  snap: P2pNarrativeAnswerSnapshot | undefined,
): snap is P2pNarrativeAnswerSnapshot {
  if (!snap) return false
  const comment = snap.comment.trim()
  if (q.responseKind === 'yes_no') {
    if (snap.yesNo === true) return true
    return Boolean(comment)
  }
  if (q.responseKind === 'number_with_target') {
    if (comment) return true
    if (snap.num == null) return false
    if (q.targetNumber != null && snap.num !== q.targetNumber) return true
    return false
  }
  return Boolean(comment)
}

function buildFinding(q: P2pNarrativeQuestionContext, snap: P2pNarrativeAnswerSnapshot, topic: TopicMeta): string {
  const comment = snap.comment.trim()
  const count = metricCount(snap)
  const prompt = compactText(q.prompt, 72)
  const parts: string[] = []

  if (q.responseKind === 'yes_no') {
    if (snap.yesNo === true) {
      if (count != null && count > 0) {
        parts.push(`Yes — ${count} logged to ${topic.label.toLowerCase()} metric`)
      } else if (q.linkedKpiLabel) {
        parts.push(`Yes — linked to ${q.linkedKpiLabel}`)
      } else {
        parts.push('Yes')
      }
    } else if (snap.yesNo === false) {
      parts.push('No')
    }
  } else if (snap.num != null) {
    const value = formatNum(snap.num)
    if (q.targetNumber != null) {
      parts.push(`Reported ${value} (target ${formatNum(q.targetNumber)})`)
    } else {
      parts.push(`Reported ${value}`)
    }
  }

  if (comment) parts.push(comment)
  else if (snap.yesNo === true && q.linkedKpiLabel) parts.push('No comment recorded')

  return `${q.groupName}: ${prompt} — ${parts.join(' · ')}`
}

function buildSuggestion(
  q: P2pNarrativeQuestionContext,
  snap: P2pNarrativeAnswerSnapshot,
  topic: TopicMeta,
): string {
  const comment = snap.comment.trim()
  const count = metricCount(snap)
  const yes = snap.yesNo === true
  const linked = Boolean(q.linkedKpiLabel)

  if (topic.kind === 'safety') {
    if (yes && count != null && count > 0) {
      return `Treat as safety priority: confirm ${count} item(s) controlled, brief the shift, and verify close-out before handover.`
    }
    if (yes || comment) {
      return `Safety topic raised — confirm immediate control with the operator, escalate if risk remains, and log actions in DDS/e-plan.`
    }
  }

  if (topic.kind === 'hazard') {
    if (yes && count != null && count > 0) {
      return `Hazard count ${count}: verify elimination or control on plant, assign owner, and re-check before restart.`
    }
    if (yes || comment) {
      return `Hazard reported — walk the point with the operator, confirm control is effective, and track in observation system if still open.`
    }
  }

  if (topic.kind === 'incident') {
    if (yes && count != null && count > 0) {
      return `Incident count ${count} (not a CIL defect): confirm containment, start cause review, and align Shift DDS KPI rollup.`
    }
    if (yes || comment) {
      return `Incident/concern raised — clarify scope with operator, confirm product/process impact is contained, and assign follow-up.`
    }
  }

  if (topic.kind === 'quality') {
    if (yes && count != null && count > 0) {
      return `Quality count ${count}: review batches/lots affected, confirm hold or rework, and agree fix owner in forum.`
    }
    if (yes || comment) {
      return `Quality note — validate standard adherence, agree containment if needed, and create action if not closed this shift.`
    }
  }

  if (linked && yes) {
    if (count != null && count > 0) {
      return `Linked metric (${q.linkedKpiLabel}) shows ${count} — confirm Shift DDS entry matches P2P and agree any corrective action.`
    }
    if (!comment) {
      return `Linked metric flagged Yes without detail — ask operator for facts, comment, and confirm KPI rollup is correct.`
    }
    return `Linked metric (${q.linkedKpiLabel}) flagged — review comment with operator and confirm metric + action plan in DDS.`
  }

  if (q.responseKind === 'number_with_target' && snap.num != null && q.targetNumber != null && snap.num !== q.targetNumber) {
    return `Result off target — discuss cause with operator, agree correction or escalation, and track in e-plan if not recovered today.`
  }

  if (comment) {
    return `Operator comment only — discuss in forum, decide coaching vs standard update vs e-plan action, and confirm close-out.`
  }

  if (yes) {
    return `Yes answer without comment — obtain detail from operator and agree whether action or acknowledgement is needed.`
  }

  return `Review with operator and agree next step or close-out in the shift forum.`
}

function buildSheetInsight(sheetComment: string): P2pNarrativeInsight {
  return {
    priority: 6,
    topicLabel: 'Overall',
    finding: `Overall shift comment — ${compactText(sheetComment, 180)}`,
    suggestion:
      'Use the overall comment to open the forum: confirm top priority, owners, and what must close before handover.',
    highPriority: false,
  }
}

function buildPlanGapInsights(input: P2pRoleNarrativeInput): P2pNarrativeInsight[] {
  const out: P2pNarrativeInsight[] = []
  if (input.planDeviations > 0) {
    out.push({
      priority: 2,
      topicLabel: 'Plan deviation',
      finding: `${input.planDeviations} Plan-24 deviation${input.planDeviations === 1 ? '' : 's'} raised (separate from P2P incidents).`,
      suggestion: 'Review open deviations with the operator; confirm owner, due date, and containment.',
      highPriority: true,
    })
  }
  if (input.planCilDefects > 0) {
    out.push({
      priority: 3,
      topicLabel: 'CIL defect',
      finding: `${input.planCilDefects} CIL defect${input.planCilDefects === 1 ? '' : 's'} on plan (not the same as hazard/incident metrics in P2P).`,
      suggestion: 'Confirm defect containment and repair path; link to CIL route owner and close in Plan-24.',
      highPriority: true,
    })
  }
  if (input.planQualityFails > 0) {
    out.push({
      priority: 2,
      topicLabel: 'Quality fail',
      finding: `${input.planQualityFails} quality check fail${input.planQualityFails === 1 ? '' : 's'} on plan.`,
      suggestion: 'Review fail details, confirm hold/containment, and assign corrective action before release.',
      highPriority: true,
    })
  }
  return out
}

function roleHeadline(input: P2pRoleNarrativeInput, insights: P2pNarrativeInsight[], tone: P2pRoleNarrative['tone']): string {
  if (tone === 'good') return 'No visible gap'
  if (!input.submitted) return 'P2P required'
  if (insights.some((i) => i.topicLabel === 'Safety' || i.topicLabel === 'Hazard')) return 'Safety/hazard needs review'
  if (insights.some((i) => i.topicLabel === 'Incident' || i.topicLabel === 'Quality')) return 'Incident/quality needs review'
  if (input.planIssueTotal > 0) return 'Plan items need follow-up'
  if (insights.length > 0) return 'P2P signals need review'
  return 'Completion gap'
}

function roleAction(input: P2pRoleNarrativeInput, insights: P2pNarrativeInsight[]): string {
  if (!input.submitted) {
    return 'Discuss with operator: complete P2P today, move with reason, or mark not required.'
  }
  const top = insights.find((i) => i.highPriority) ?? insights[0]
  if (top) return top.suggestion
  if (input.gaps.some((g) => g.includes('%'))) {
    return 'Ask if remaining checks are required today; agree completion time or move decision.'
  }
  return 'Confirm standard held and recognise good shift follow-up.'
}

function roleTone(input: P2pRoleNarrativeInput, insights: P2pNarrativeInsight[]): P2pRoleNarrative['tone'] {
  if (!input.submitted) return 'urgent'
  if (insights.some((i) => i.highPriority && (i.topicLabel === 'Safety' || i.topicLabel === 'Hazard'))) return 'urgent'
  if (input.planIssueTotal > 0 || insights.some((i) => i.highPriority)) return 'urgent'
  if (input.completionMinPct != null && input.completionMinPct < 75) return 'urgent'
  if (input.gaps.length > 0 || insights.length > 0) return 'watch'
  return 'good'
}

export function buildP2pRoleNarrative(input: P2pRoleNarrativeInput): P2pRoleNarrative {
  const insights: P2pNarrativeInsight[] = []

  for (const q of input.questions) {
    const snap = input.answers[q.key]
    if (!shouldAnalyzeAnswer(q, snap)) continue
    const topic = classifyTopic(q)
    insights.push({
      priority: topic.priority,
      topicLabel: topic.label,
      finding: buildFinding(q, snap, topic),
      suggestion: buildSuggestion(q, snap, topic),
      highPriority: topic.highPriority,
    })
  }

  const sheet = input.sheetComment.trim()
  if (sheet) insights.push(buildSheetInsight(sheet))

  insights.push(...buildPlanGapInsights(input))

  insights.sort(
    (a, b) => a.priority - b.priority || Number(b.highPriority) - Number(a.highPriority) || a.finding.localeCompare(b.finding),
  )

  const tone = roleTone(input, insights)

  return {
    roleId: input.roleId,
    roleName: input.roleName,
    tone,
    submitted: input.submitted,
    headline: roleHeadline(input, insights, tone),
    gaps: input.gaps.slice(0, 4),
    insights,
    action: roleAction(input, insights),
  }
}

export function buildP2pShiftNarrative(roleInputs: P2pRoleNarrativeInput[]): P2pShiftNarrative {
  const roles = roleInputs
    .map(buildP2pRoleNarrative)
    .sort((a, b) => {
      const weight = { urgent: 0, watch: 1, good: 2 }
      const hp = (r: P2pRoleNarrative) => (r.insights.some((i) => i.highPriority) ? 0 : 1)
      return weight[a.tone] - weight[b.tone] || hp(a) - hp(b) || a.roleName.localeCompare(b.roleName)
    })

  const attentionCount = roles.filter((r) => r.tone !== 'good').length
  const insightCount = roles.reduce((sum, r) => sum + r.insights.length, 0)
  const safetyHazardRoles = roles.filter((r) =>
    r.insights.some((i) => i.topicLabel === 'Safety' || i.topicLabel === 'Hazard'),
  ).length
  const incidentQualityRoles = roles.filter((r) =>
    r.insights.some((i) => i.topicLabel === 'Incident' || i.topicLabel === 'Quality'),
  ).length

  let summary: string
  if (attentionCount === 0) {
    summary = 'Shift looks stable across visible roles. No immediate team-lead intervention is highlighted.'
  } else if (safetyHazardRoles > 0) {
    summary = `${safetyHazardRoles} role${safetyHazardRoles === 1 ? '' : 's'} with safety/hazard P2P signals — review those first, then incidents/quality and other comments (${attentionCount}/${roles.length} roles need attention).`
  } else if (incidentQualityRoles > 0) {
    summary = `${incidentQualityRoles} role${incidentQualityRoles === 1 ? '' : 's'} with incident/quality P2P signals — review linked counts and comments before plan defects (${attentionCount}/${roles.length} roles need attention).`
  } else {
    summary = `${attentionCount}/${roles.length} visible role${roles.length === 1 ? '' : 's'} need team-lead follow-up from P2P answers, comments, or plan gaps.`
  }

  return { summary, roles, attentionCount, insightCount }
}

export function formatPlanIssueGapParts(deviations: number, cilDefects: number, qualityFails: number): string | null {
  const parts = [
    deviations > 0 ? `${deviations} deviation${deviations === 1 ? '' : 's'}` : '',
    cilDefects > 0 ? `${cilDefects} CIL defect${cilDefects === 1 ? '' : 's'}` : '',
    qualityFails > 0 ? `${qualityFails} quality fail${qualityFails === 1 ? '' : 's'}` : '',
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}
