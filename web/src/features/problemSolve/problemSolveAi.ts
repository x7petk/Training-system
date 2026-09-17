import type { AiNavigateResponse, AiRefocusResponse, InitialMethod, LossTypeId, SixW2H } from './types'
import { LOSS_TYPES, METHOD_LABELS, mockExpertsForMethod } from './mockData'

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

/** Keyword heuristic when OpenAI is unavailable — keeps the demo runnable. */
export function heuristicNavigate(input: {
  message: string
  history: { role: string; content: string }[]
  known: {
    problemStatement?: string
    assetName?: string
    area?: string
    lossTypeId?: LossTypeId | null
  }
}): AiNavigateResponse {
  const text = input.message.toLowerCase()
  const prior = [...input.history.map((h) => h.content), input.message].join(' ').toLowerCase()

  let lossTypeId: LossTypeId | null = input.known.lossTypeId ?? null
  if (!lossTypeId) {
    if (/complaint|customer|retail|market/.test(text)) lossTypeId = 'quality_complaint'
    else if (/broke|breakdown|seized|bearing|shaft|motor failed|equipment failure/.test(text))
      lossTypeId = 'breakdown'
    else if (/cip|sterile|process fail|control loop|interlock/.test(text)) lossTypeId = 'process_failure'
    else if (/handover|training|skill|leadership|role gap|behaviour|behavior/.test(text))
      lossTypeId = 'organisational'
    else if (/rework|downgrade|scrap|out of spec|defect|seal|label|quality/.test(text))
      lossTypeId = 'quality_internal'
    else if (/changeover|delay|waiting|imbalance|waste|sequence/.test(text)) lossTypeId = 'process_system'
    else if (/jam|stop|chronic|centerline|material|equipment/.test(text)) lossTypeId = 'equipment_material'
  }

  const needsAsset = !input.known.assetName && !/filler|packer|conveyor|mixer|labeler|head|line|asset/i.test(prior)
  const needsWhen = !/today|yesterday|shift|hour|am|pm|\d{1,2}:\d{2}/i.test(prior)
  const problemStatement = input.known.problemStatement || input.message.trim()

  if (needsAsset) {
    return {
      reply:
        'Thanks — I need a bit more context before routing you.\n\nWhich **asset / equipment** is affected? (e.g. Filler Line 1 — Head 3, Case Packer CP-2)',
      questions: ['Which asset is affected?'],
      suggestedActions: [
        { id: 'a-filler', label: 'Filler Line 1 — Head 3', kind: 'answer', payload: 'Asset: Filler Line 1 — Head 3' },
        { id: 'a-packer', label: 'Case Packer CP-2', kind: 'answer', payload: 'Asset: Case Packer CP-2' },
        { id: 'a-conv', label: 'Transfer Conveyor TC-4', kind: 'answer', payload: 'Asset: Transfer Conveyor TC-4' },
        { id: 'skip', label: 'Skip AI — pick method manually', kind: 'skip_ai' },
      ],
      extracted: { problemStatement },
      readyForForm: false,
    }
  }

  if (!lossTypeId) {
    return {
      reply:
        'I can see the issue. Help me classify the **loss type** so we open the right initial method.',
      questions: ['What kind of loss is this?'],
      suggestedActions: LOSS_TYPES.slice(0, 5).map((t) => ({
        id: `lt-${t.id}`,
        label: t.shortLabel,
        kind: 'answer' as const,
        payload: `Loss type: ${t.label}`,
      })),
      extracted: { problemStatement },
      readyForForm: false,
    }
  }

  const lt = LOSS_TYPES.find((t) => t.id === lossTypeId)!
  const assetMatch =
    input.known.assetName ||
    (prior.match(/filler line 1[^\n,]*/i)?.[0] ??
      prior.match(/case packer cp-2/i)?.[0] ??
      prior.match(/transfer conveyor tc-4/i)?.[0] ??
      prior.match(/batch mixer mx-1/i)?.[0] ??
      prior.match(/labeler lb-1/i)?.[0] ??
      'Filler Line 1 — Head 3')

  const sixW2H: Partial<SixW2H> = {
    what: problemStatement,
    where: String(assetMatch),
    when: needsWhen ? 'Current shift — time to confirm' : 'As described by operator',
    who: 'Operator / team on shift',
    which: lt.shortLabel,
    why: 'Unknown — to be confirmed via checklist vs standard',
    how: 'Observed during normal production',
    howMuch: /%|\d+/.test(prior) ? 'See operator description' : 'Impact to quantify (minutes / units / scrap)',
  }

  return {
    reply: `Based on what you shared, this looks like **${lt.label}**.\n\nRecommended initial method: **${METHOD_LABELS[lt.initialMethod]}**.\nAdvanced route if needed later: **${METHOD_LABELS[lt.advancedMethod]}**.\n\nI'll open the ${lt.initialMethod.replace('_', ' ')} form with a 6W-2H draft and run basic evidence checks against connected systems (mock data for this demo).`,
    suggestedActions: [
      {
        id: 'open-form',
        label: `Open ${lt.initialMethod.replaceAll('_', ' ')} form`,
        kind: 'open_form',
        payload: lt.initialMethod,
      },
      { id: 'run-checks', label: 'Run evidence checks first', kind: 'run_checks' },
      { id: 'skip', label: 'Pick a different method', kind: 'skip_ai' },
    ],
    extracted: {
      problemStatement,
      assetName: String(assetMatch),
      area: /pack/i.test(String(assetMatch)) ? 'Packaging' : /mix|process/i.test(String(assetMatch)) ? 'Process' : 'Filling',
      lossTypeId,
      initialMethod: lt.initialMethod,
      sixW2H,
    },
    readyForForm: true,
    runEvidenceChecks: true,
  }
}

export function heuristicRefocus(input: {
  problemStatement: string
  method: InitialMethod | string
  sixW2H: SixW2H
  checklistNotes: string
}): AiRefocusResponse {
  const experts = mockExpertsForMethod(input.method, input.problemStatement)
  const known = [
    input.sixW2H.what && `What: ${input.sixW2H.what}`,
    input.sixW2H.where && `Where: ${input.sixW2H.where}`,
    input.sixW2H.when && `When: ${input.sixW2H.when}`,
    input.checklistNotes && `Checklist notes: ${input.checklistNotes}`,
  ].filter(Boolean) as string[]

  const missing = [
    !input.sixW2H.howMuch ? 'Quantified impact (minutes / units / $)' : '',
    !input.sixW2H.why || /unknown/i.test(input.sixW2H.why) ? 'Verified why / contributing factor' : '',
    'Photo of deviation vs standard',
  ].filter(Boolean)

  const inHouse = !/safety|injury|customer complaint|major fire/i.test(input.problemStatement)

  return {
    refocusStatement: `${input.sixW2H.what || input.problemStatement} at ${input.sixW2H.where || 'the asset'}, observed ${input.sixW2H.when || 'this shift'}. Deviation vs standard is being confirmed; impact ${input.sixW2H.howMuch || 'to be quantified'}.`,
    known,
    missing,
    narrowedScope: `Focus on ${input.sixW2H.where || 'single asset'} for the current SKU/shift window only.`,
    expertFeedback: experts,
    recommendInHouse: inHouse,
    rationale: inHouse
      ? 'Basic conditions and standards checks look actionable at team level. Try containment + restore base condition before escalating.'
      : 'Signals suggest escalation risk — involve specialists / advanced method.',
    suggestedActions: [
      {
        id: uid('act'),
        title: 'Contain suspect product / restore safe running',
        owner: 'Operator',
        due: 'Today',
        status: 'open',
        type: 'immediate',
      },
      {
        id: uid('act'),
        title: 'Compare current condition to centerline and record gap',
        owner: 'Team Leader',
        due: 'Today',
        status: 'open',
        type: 'immediate',
      },
      {
        id: uid('act'),
        title: 'Update CIL / standard if cause is verified',
        owner: 'Reliability',
        due: 'This week',
        status: 'open',
        type: 'standard',
      },
      {
        id: uid('act'),
        title: 'Share learning in next DDS',
        owner: 'Team Leader',
        due: 'Next DDS',
        status: 'open',
        type: 'train',
      },
    ],
  }
}

export async function callProblemSolveAi(body: {
  mode: 'navigate' | 'refocus' | 'expert'
  payload: Record<string, unknown>
}): Promise<AiNavigateResponse | AiRefocusResponse | { reply: string }> {
  const res = await fetch('/api/problem-solve-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`AI returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const err = parsed as { error?: string; detail?: string }
    throw new Error(err.detail ? `${err.error}: ${err.detail}` : err.error || `HTTP ${res.status}`)
  }
  return parsed as AiNavigateResponse | AiRefocusResponse | { reply: string }
}
