import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Problem Solve AI — Loss Elimination Navigator coach.
 * Uses OPENAI_API_KEY from env (repo-root `.env` / Vercel project env).
 * Falls back to structured heuristic responses when the key is missing or the call fails.
 */

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

const NAVIGATE_SYSTEM = `You are the Loss Elimination Navigator AI for a manufacturing plant.
Solve at the lowest capable level. Use facts, not guesses. Never replace human judgment.

Your job in mode=navigate:
1. Understand the operator's problem from chat.
2. Ask only for missing critical facts: asset, when, loss nature, impact.
3. Classify into ONE loss type:
   - equipment_material → IPS → UPS
   - process_system → IPS → WPI
   - quality_internal → IPS → UPS
   - quality_complaint → IPS → UPS
   - breakdown → BDE_BREAKDOWN → IDA
   - process_failure → BDE_PROCESS → IDA
   - organisational → OPM → OPM_ADVANCED
4. When enough info exists, set readyForForm=true and draft 6W-2H fields.

Respond ONLY with JSON matching:
{
  "reply": "markdown-friendly string",
  "questions": ["optional follow-ups"],
  "suggestedActions": [{"id":"string","label":"string","kind":"answer|open_form|skip_ai|run_checks|continue","payload":"optional"}],
  "extracted": {
    "problemStatement":"",
    "assetName":"",
    "area":"",
    "lossTypeId":"equipment_material|process_system|quality_internal|quality_complaint|breakdown|process_failure|organisational",
    "initialMethod":"IPS|BDE_BREAKDOWN|BDE_PROCESS|OPM",
    "sixW2H":{"what":"","where":"","when":"","who":"","which":"","why":"","how":"","howMuch":""}
  },
  "readyForForm": false,
  "runEvidenceChecks": false
}`

const REFOCUS_SYSTEM = `You are the AI Refocus Coach + Expert panel for Loss Elimination Navigator.
Use 6W-2H to build a clear evidence-based problem statement.
Return JSON only:
{
  "refocusStatement":"",
  "known":["..."],
  "missing":["..."],
  "narrowedScope":"",
  "expertFeedback":[{
    "expertId":"reliability|process|quality|work_process|opm|safety",
    "name":"",
    "role":"",
    "summary":"",
    "challenges":["..."],
    "suggestedTests":["..."],
    "involve":["..."]
  }],
  "recommendInHouse": true,
  "rationale":"",
  "suggestedActions":[{"id":"","title":"","owner":"","due":"","status":"open","type":"immediate|sustainable|train|standard"}]
}`

type HeuristicModule = typeof import('../web/src/features/problemSolve/problemSolveAi')

async function loadHeuristics(): Promise<Pick<HeuristicModule, 'heuristicNavigate' | 'heuristicRefocus'> | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../web/src/features/problemSolve/problemSolveAi.js') as HeuristicModule
    return mod
  } catch {
    return null
  }
}

/** Inline fallbacks so the API works even if TS module path differs on Vercel. */
function inlineNavigate(payload: Record<string, unknown>) {
  const message = String(payload.message || '')
  const known = (payload.known || {}) as Record<string, unknown>
  const lower = message.toLowerCase()
  let lossTypeId = (known.lossTypeId as string) || null
  if (!lossTypeId) {
    if (/broke|breakdown|seized|bearing|motor/.test(lower)) lossTypeId = 'breakdown'
    else if (/complaint|customer/.test(lower)) lossTypeId = 'quality_complaint'
    else if (/handover|training|skill/.test(lower)) lossTypeId = 'organisational'
    else if (/rework|scrap|seal|quality|defect/.test(lower)) lossTypeId = 'quality_internal'
    else if (/changeover|delay|waiting/.test(lower)) lossTypeId = 'process_system'
    else lossTypeId = 'equipment_material'
  }
  const methodMap: Record<string, string> = {
    equipment_material: 'IPS',
    process_system: 'IPS',
    quality_internal: 'IPS',
    quality_complaint: 'IPS',
    breakdown: 'BDE_BREAKDOWN',
    process_failure: 'BDE_PROCESS',
    organisational: 'OPM',
  }
  const initialMethod = methodMap[lossTypeId] || 'IPS'
  const assetName = String(known.assetName || 'Filler Line 1 — Head 3')
  return {
    reply: `Classified as **${lossTypeId.replaceAll('_', ' ')}**. Opening **${initialMethod}** with a 6W-2H draft.`,
    suggestedActions: [
      { id: 'open-form', label: `Open ${initialMethod} form`, kind: 'open_form', payload: initialMethod },
      { id: 'skip', label: 'Skip AI — pick method manually', kind: 'skip_ai' },
    ],
    extracted: {
      problemStatement: String(known.problemStatement || message),
      assetName,
      area: 'Filling',
      lossTypeId,
      initialMethod,
      sixW2H: {
        what: String(known.problemStatement || message),
        where: assetName,
        when: 'Current shift',
        who: 'Operator',
        which: lossTypeId,
        why: 'To confirm',
        how: 'Observed on line',
        howMuch: 'To quantify',
      },
    },
    readyForForm: true,
    runEvidenceChecks: true,
  }
}

function inlineRefocus(payload: Record<string, unknown>) {
  const six = (payload.sixW2H || {}) as Record<string, string>
  const problem = String(payload.problemStatement || six.what || 'Problem')
  return {
    refocusStatement: `${problem} at ${six.where || 'asset'} — ${six.when || 'this shift'}.`,
    known: Object.entries(six)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`),
    missing: ['Verified root cause', 'Photo of deviation'],
    narrowedScope: `Single asset focus: ${six.where || 'selected asset'}`,
    expertFeedback: [
      {
        expertId: 'reliability',
        name: 'Alex Rivera',
        role: 'Reliability Engineer',
        summary: 'Check basic conditions against centerline before escalating.',
        challenges: ['Is this chronic or a step-change?'],
        suggestedTests: ['Compare to last good run'],
        involve: ['Operator', 'Maintenance'],
      },
      {
        expertId: 'quality',
        name: 'Priya Shah',
        role: 'Quality Coach',
        summary: 'Contain product risk and confirm last good check.',
        challenges: ['Any shipped risk?'],
        suggestedTests: ['Integrity sample n=20'],
        involve: ['Quality'],
      },
    ],
    recommendInHouse: true,
    rationale: 'Team can attempt restore-to-standard before advanced methods.',
    suggestedActions: [
      {
        id: 'a1',
        title: 'Contain and restore base condition',
        owner: 'Operator',
        due: 'Today',
        status: 'open',
        type: 'immediate',
      },
      {
        id: 'a2',
        title: 'Update standard / CIL if verified',
        owner: 'Team Leader',
        due: 'This week',
        status: 'open',
        type: 'standard',
      },
    ],
  }
}

async function callOpenAi(system: string, user: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not configured')

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  const data = (await upstream.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string } }[]
  }
  if (!upstream.ok) {
    throw new Error(data.error?.message || `OpenAI HTTP ${upstream.status}`)
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')
  return content
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
  }
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const mode = body.mode as string
  const payload = (body.payload || {}) as Record<string, unknown>

  try {
    if (mode === 'navigate') {
      try {
        const content = await callOpenAi(NAVIGATE_SYSTEM, JSON.stringify(payload))
        return res.status(200).json(JSON.parse(content))
      } catch (e) {
        const heur = await loadHeuristics()
        if (heur) {
          return res.status(200).json(
            heur.heuristicNavigate({
              message: String(payload.message || ''),
              history: (payload.history as { role: string; content: string }[]) || [],
              known: (payload.known as Record<string, unknown>) || {},
            }),
          )
        }
        const fallback = inlineNavigate(payload)
        return res.status(200).json({
          ...fallback,
          _fallback: true,
          _fallbackReason: e instanceof Error ? e.message : String(e),
        })
      }
    }

    if (mode === 'refocus' || mode === 'expert') {
      try {
        const content = await callOpenAi(REFOCUS_SYSTEM, JSON.stringify(payload))
        return res.status(200).json(JSON.parse(content))
      } catch (e) {
        const heur = await loadHeuristics()
        if (heur) {
          return res.status(200).json(
            heur.heuristicRefocus({
              problemStatement: String(payload.problemStatement || ''),
              method: String(payload.method || 'IPS'),
              sixW2H: (payload.sixW2H as never) || {
                what: '',
                where: '',
                when: '',
                who: '',
                which: '',
                why: '',
                how: '',
                howMuch: '',
              },
              checklistNotes: String(payload.checklistNotes || ''),
            }),
          )
        }
        return res.status(200).json({
          ...inlineRefocus(payload),
          _fallback: true,
          _fallbackReason: e instanceof Error ? e.message : String(e),
        })
      }
    }

    return res.status(400).json({ error: `Unknown mode: ${mode}` })
  } catch (e) {
    return res.status(500).json({
      error: 'Problem Solve AI failed',
      detail: e instanceof Error ? e.message : String(e),
    })
  }
}
