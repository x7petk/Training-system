import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Json = Record<string, unknown>

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function openaiJson(apiKey: string, model: string, system: string, user: string) {
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
  if (!upstream.ok) throw new Error(data.error?.message || `OpenAI HTTP ${upstream.status}`)
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')
  return JSON.parse(content) as Json
}

const NAVIGATE_SYSTEM = `You are the Loss Elimination Navigator AI for manufacturing.
Respond ONLY with JSON:
{"reply":"","questions":[],"suggestedActions":[{"id":"","label":"","kind":"answer|open_form|skip_ai|run_checks|continue","payload":""}],"extracted":{"problemStatement":"","assetName":"","area":"","lossTypeId":"equipment_material|process_system|quality_internal|quality_complaint|breakdown|process_failure|organisational","initialMethod":"IPS|BDE_BREAKDOWN|BDE_PROCESS|OPM","sixW2H":{"what":"","where":"","when":"","who":"","which":"","why":"","how":"","howMuch":""}},"readyForForm":false,"runEvidenceChecks":false}
Classify loss types and recommend IPS / BDE_BREAKDOWN / BDE_PROCESS / OPM. Ask only for missing asset/type facts.`

const REFOCUS_SYSTEM = `You are AI Refocus Coach + experts. JSON only:
{"refocusStatement":"","known":[],"missing":[],"narrowedScope":"","expertFeedback":[{"expertId":"reliability","name":"","role":"","summary":"","challenges":[],"suggestedTests":[],"involve":[]}],"recommendInHouse":true,"rationale":"","suggestedActions":[{"id":"","title":"","owner":"","due":"","status":"open","type":"immediate"}]}`

function heuristicNavigate(payload: Json): Json {
  const message = String(payload.message || '')
  const known = (payload.known || {}) as Json
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
  const assetName = String(known.assetName || (/filler|packer|conveyor|mixer|labeler/i.test(message) ? message : 'Filler Line 1 — Head 3'))
  if (!known.assetName && !/filler|packer|conveyor|mixer|labeler|asset:/i.test(message + JSON.stringify(payload.history || []))) {
    return {
      reply: 'Which **asset / equipment** is affected?',
      suggestedActions: [
        { id: 'a1', label: 'Filler Line 1 — Head 3', kind: 'answer', payload: 'Asset: Filler Line 1 — Head 3' },
        { id: 'a2', label: 'Case Packer CP-2', kind: 'answer', payload: 'Asset: Case Packer CP-2' },
        { id: 'skip', label: 'Skip AI — pick method manually', kind: 'skip_ai' },
      ],
      extracted: { problemStatement: String(known.problemStatement || message) },
      readyForForm: false,
    }
  }
  return {
    reply: `Classified as **${lossTypeId.replaceAll('_', ' ')}**. Recommended **${initialMethod}**.`,
    suggestedActions: [
      { id: 'open', label: `Open ${initialMethod} form`, kind: 'open_form', payload: initialMethod },
      { id: 'skip', label: 'Pick method manually', kind: 'skip_ai' },
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

function heuristicRefocus(payload: Json): Json {
  const six = (payload.sixW2H || {}) as Record<string, string>
  const problem = String(payload.problemStatement || six.what || 'Problem')
  return {
    refocusStatement: `${problem} at ${six.where || 'asset'} — ${six.when || 'this shift'}.`,
    known: Object.entries(six)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`),
    missing: ['Verified root cause', 'Photo of deviation'],
    narrowedScope: `Focus: ${six.where || 'selected asset'}`,
    expertFeedback: [
      {
        expertId: 'reliability',
        name: 'Alex Rivera',
        role: 'Reliability Engineer',
        summary: 'Confirm basic conditions vs centerline before escalating.',
        challenges: ['Chronic vs step-change?'],
        suggestedTests: ['Compare last good run'],
        involve: ['Operator', 'Maintenance'],
      },
      {
        expertId: 'quality',
        name: 'Priya Shah',
        role: 'Quality Coach',
        summary: 'Contain product risk; confirm last good check.',
        challenges: ['Shipped risk?'],
        suggestedTests: ['Seal integrity n=20'],
        involve: ['Quality'],
      },
    ],
    recommendInHouse: true,
    rationale: 'Operational team can try restore-to-standard first.',
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
        title: 'Share learning in DDS',
        owner: 'Team Leader',
        due: 'Next DDS',
        status: 'open',
        type: 'train',
      },
    ],
  }
}

/** Local `/api/problem-solve-ai` using OPENAI_API_KEY from merged env. */
export function problemSolveAiDevPlugin(env: Record<string, string>): Plugin {
  const apiKey = env.OPENAI_API_KEY || ''
  const model = env.OPENAI_MODEL || 'gpt-4.1-mini'

  return {
    name: 'problem-solve-ai-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/problem-solve-ai')) return next()
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

        try {
          const raw = await readBody(req)
          const body = JSON.parse(raw || '{}') as { mode?: string; payload?: Json }
          const mode = body.mode
          const payload = body.payload || {}

          if (mode === 'navigate') {
            if (apiKey) {
              try {
                const result = await openaiJson(apiKey, model, NAVIGATE_SYSTEM, JSON.stringify(payload))
                return sendJson(res, 200, result)
              } catch {
                /* fall through */
              }
            }
            return sendJson(res, 200, { ...heuristicNavigate(payload), _fallback: !apiKey })
          }

          if (mode === 'refocus' || mode === 'expert') {
            if (apiKey) {
              try {
                const result = await openaiJson(apiKey, model, REFOCUS_SYSTEM, JSON.stringify(payload))
                return sendJson(res, 200, result)
              } catch {
                /* fall through */
              }
            }
            return sendJson(res, 200, { ...heuristicRefocus(payload), _fallback: !apiKey })
          }

          return sendJson(res, 400, { error: `Unknown mode: ${mode}` })
        } catch (e) {
          return sendJson(res, 500, {
            error: 'Problem Solve AI failed',
            detail: e instanceof Error ? e.message : String(e),
          })
        }
      })
    },
  }
}
