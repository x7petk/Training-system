const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

type RoadMapInputs = {
  title?: string
  vision?: string
  objective?: string
  horizonMonths?: number
  bucket?: 'months' | 'quarters'
  audience?: string
  currentState?: string
  constraints?: string
  successMetrics?: string
  workstreams?: string
  contextNotes?: string
  preferredView?: 'auto' | 'quarterly' | 'now_next_later' | 'gantt'
}

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5.4'

function sanitize(v: unknown, max = 12_000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function stripJsonFence(v: string): string {
  const t = v.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  return t
}

const SYSTEM_PROMPT = `You are a world-class strategy and program director who designs best-in-class roadmaps for operational, manufacturing, transformation, and product programs. You output STRICT JSON only (no markdown, no commentary).

Your job: given the user's vision + objective + context + constraints + workstreams, produce a tight, executable, visually structured roadmap. Be opinionated and concrete. Prefer fewer, sharper items over generic filler.

Core principles:
- The polished vision must be aspirational AND specific: ~20-40 words, present tense, names what changes and for whom.
- Reorganize workstreams into 3-6 coherent lanes (combine, rename, or add lanes as needed).
- Phases (time buckets) must cover the full horizon evenly. For "months" bucket use M1..Mn; for "quarters" use Q1..Qn (n = ceil(horizon/3)).
- Each roadmap item must have a clear outcome — what the org can do once it's complete.
- Use plain operator-friendly language. Avoid corporate fluff (synergies, leverage, robust, holistic).
- Pick the best visual style for THIS roadmap:
  - "quarterly" — many workstreams running in parallel across phases (most operational/program work)
  - "now_next_later" — small set of bets, short horizon, exploratory
  - "gantt" — strong dependencies, scheduling, predictable durations
- Pick conservatively. Only choose "now_next_later" if the horizon is short (<= 9 months) and there are fewer than ~12 items.
- Quick wins should be 30-60 day high-leverage actions the user can start immediately.
- Risks must be specific to THIS plan (not generic).
- Success metrics must be measurable (number + unit + target by when).

Output validity rules:
- Every item.workstreamId must match a workstreams[].id.
- Every item.phaseIds[] entry must match a phases[].id.
- startMonth/endMonth are 1-indexed months from the start of the plan; endMonth >= startMonth; endMonth <= horizonMonths.
- Item titles <= 60 chars. Descriptions <= 240 chars.
- Workstream colors: pick from "amber", "emerald", "sky", "violet", "rose", "indigo", "teal", "fuchsia".`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Road Map Builder is not configured. Set the OPENAI_API_KEY secret on the road-map-builder Edge Function.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payload = (await req.json()) as { inputs?: RoadMapInputs }
    const inputs = payload.inputs ?? {}

    const horizon = Math.max(1, Math.min(36, Math.round(Number(inputs.horizonMonths ?? 12)) || 12))
    const bucket: 'months' | 'quarters' = inputs.bucket === 'months' ? 'months' : 'quarters'
    const preferredView = (() => {
      const v = inputs.preferredView
      return v === 'quarterly' || v === 'now_next_later' || v === 'gantt' || v === 'auto' ? v : 'auto'
    })()

    const safe = {
      title: sanitize(inputs.title, 160),
      vision: sanitize(inputs.vision, 2_000),
      objective: sanitize(inputs.objective, 1_500),
      audience: sanitize(inputs.audience, 800),
      currentState: sanitize(inputs.currentState, 2_400),
      constraints: sanitize(inputs.constraints, 1_500),
      successMetrics: sanitize(inputs.successMetrics, 1_500),
      workstreams: sanitize(inputs.workstreams, 1_500),
      contextNotes: sanitize(inputs.contextNotes, 6_000),
    }

    if (!safe.objective && !safe.vision) {
      return new Response(
        JSON.stringify({ error: 'Please provide at least a vision or objective.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const userPrompt =
      `Generate a roadmap as STRICT JSON. ` +
      `Horizon: ${horizon} months. Phase bucket: ${bucket}. Preferred visual style: ${preferredView} (use "auto" to pick best).\n\n` +
      `Title (optional working title):\n${safe.title || '(none — propose a strong one)'}\n\n` +
      `Vision (rough; you will polish it):\n${safe.vision || '(none)'}\n\n` +
      `Primary objective:\n${safe.objective || '(none)'}\n\n` +
      `Audience / stakeholders:\n${safe.audience || '(none)'}\n\n` +
      `Current state / pain points:\n${safe.currentState || '(none)'}\n\n` +
      `Constraints (budget, headcount, tech, regulatory):\n${safe.constraints || '(none)'}\n\n` +
      `Success metrics / KPIs:\n${safe.successMetrics || '(none)'}\n\n` +
      `Initial workstreams / themes:\n${safe.workstreams || '(none — propose 3-6)'}\n\n` +
      `Additional context:\n${safe.contextNotes || '(none)'}\n\n` +
      `Return JSON only with this exact shape:
{
  "title": "string",
  "polishedVision": "string",
  "chosenView": "quarterly" | "now_next_later" | "gantt",
  "viewRationale": "string",
  "horizonMonths": ${horizon},
  "bucket": "${bucket}",
  "phases": [
    { "id": "string", "label": "string", "startMonth": 1, "endMonth": 3 }
  ],
  "workstreams": [
    { "id": "string", "name": "string", "color": "amber|emerald|sky|violet|rose|indigo|teal|fuchsia", "description": "string" }
  ],
  "items": [
    {
      "id": "string",
      "title": "string",
      "workstreamId": "string",
      "phaseIds": ["string"],
      "startMonth": 1,
      "endMonth": 3,
      "priority": "high|medium|low",
      "milestone": false,
      "description": "string",
      "outcome": "string",
      "owner": "string"
    }
  ],
  "keyMilestones": [
    { "id": "string", "title": "string", "month": 6, "description": "string" }
  ],
  "successMetrics": [
    { "name": "string", "baseline": "string", "target": "string", "timeframe": "string", "owner": "string" }
  ],
  "risks": [
    { "description": "string", "severity": "high|medium|low", "mitigation": "string" }
  ],
  "quickWins": ["string"],
  "executiveSummary": "string"
}

Rules:
- 3-6 workstreams.
- 10-22 items total — distributed across workstreams and phases.
- 3-7 keyMilestones tied to specific months.
- 4-8 successMetrics, each with a measurable target.
- 4-8 risks with concrete mitigations.
- 3-6 quickWins (each <= 14 words).
- executiveSummary: 50-90 words, sharp, decision-grade.`

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 1200)
      return new Response(
        JSON.stringify({ error: `OpenAI request failed (${upstream.status})`, detail }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const completion = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = completion.choices?.[0]?.message?.content ?? ''
    if (!raw.trim()) {
      return new Response(JSON.stringify({ error: 'Model returned empty content.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(stripJsonFence(raw))
    } catch {
      return new Response(
        JSON.stringify({ error: 'Model returned invalid JSON.', detail: raw.slice(0, 1200) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ model: MODEL, result: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
