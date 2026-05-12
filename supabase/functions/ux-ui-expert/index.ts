const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

type AssetInput = {
  label?: string
  mimeType?: string
  dataUrl?: string
}

type ExpertPayload = {
  assetA?: AssetInput
  assetB?: AssetInput | null
  companyStandardText?: string
  companyStandardImage?: AssetInput | null
  contextNotes?: string
}

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5.4'

function isImageDataUrl(v: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(v)
}

function sanitizeText(v: unknown, maxLen = 12_000): string {
  return typeof v === 'string' ? v.trim().slice(0, maxLen) : ''
}

function sanitizeAsset(value: unknown, required: boolean): AssetInput | null {
  if (value == null) {
    if (required) throw new Error('Missing required image.')
    return null
  }
  const obj = value as AssetInput
  const dataUrl = sanitizeText(obj.dataUrl, 6_000_000)
  if (!dataUrl || !isImageDataUrl(dataUrl)) {
    if (required) throw new Error('Asset must be an image data URL.')
    return null
  }
  const mimeType = sanitizeText(obj.mimeType, 120) || 'image/png'
  const label = sanitizeText(obj.label, 280) || 'image'
  return { label, mimeType, dataUrl }
}

function stripJsonFence(v: string): string {
  const trimmed = v.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  return trimmed
}

const SYSTEM_PROMPT = `You are a world-class UX/UI expert for modern digital products (web apps, mobile apps, analytics dashboards, operational reports).
You must output STRICT JSON only (no markdown).

Scoring requirements:
- overallScore: integer 0..100
- verdict: "good" | "mixed" | "poor"
- categories: each has category, score (0..100), feedback, strengths[], risks[]
- recommendations: prioritized, practical, and specific
- comparison is required ONLY when two assets were provided

Evaluation rubric categories (at minimum):
1) Visual hierarchy & clarity
2) Layout & spacing
3) Readability & typography
4) Interaction affordance & flow
5) Accessibility & inclusiveness
6) Consistency & design-system alignment
7) Information architecture / report comprehension

If company standards are provided, evaluate BOTH:
- adherence to company standards
- adherence to current best-practice UX/UI principles

Be honest and critical. Avoid generic advice. Keep each bullet concise and actionable.`

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
          error: 'UX/UI expert is not configured. Set OPENAI_API_KEY secret on ux-ui-expert Edge Function.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payload = (await req.json()) as ExpertPayload
    const assetA = sanitizeAsset(payload.assetA, true) as AssetInput
    const assetB = sanitizeAsset(payload.assetB, false)
    const standardImage = sanitizeAsset(payload.companyStandardImage, false)
    const companyStandardText = sanitizeText(payload.companyStandardText, 20_000)
    const contextNotes = sanitizeText(payload.contextNotes, 4_000)

    const userPrompt =
      `Analyze Asset A as the primary design.\n` +
      `${assetB ? `Also compare against Asset B and include comparison insights.\n` : ''}` +
      `${companyStandardText ? `Company standards text:\n${companyStandardText}\n` : ''}` +
      `${contextNotes ? `Context notes:\n${contextNotes}\n` : ''}` +
      `Return JSON only with this shape:
{
  "overallScore": 0,
  "verdict": "good|mixed|poor",
  "executiveSummary": "string",
  "categories": [
    { "category": "string", "score": 0, "feedback": "string", "strengths": ["string"], "risks": ["string"] }
  ],
  "comparison": { "betterAsset": "A|B|Tie", "summary": "string", "biggestDifferences": ["string"] } | null,
  "recommendations": [
    { "priority": "high|medium|low", "title": "string", "action": "string", "expectedImpact": "string" }
  ],
  "standardsApplied": "string"
}

Rules:
- overallScore and each category score must be integer 0..100
- include 5-8 categories
- include 6-12 recommendations
- if only one asset is provided, set comparison to null`

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' | 'auto' } }
    > = [{ type: 'text', text: userPrompt }]

    userContent.push({ type: 'image_url', image_url: { url: assetA.dataUrl as string, detail: 'high' } })
    if (assetB?.dataUrl) userContent.push({ type: 'image_url', image_url: { url: assetB.dataUrl, detail: 'high' } })
    if (standardImage?.dataUrl) {
      userContent.push({ type: 'text', text: 'Company standard design map image:' })
      userContent.push({ type: 'image_url', image_url: { url: standardImage.dataUrl, detail: 'high' } })
    }

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_completion_tokens: 2400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 1200)
      return new Response(JSON.stringify({ error: `OpenAI request failed (${upstream.status})`, detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
      return new Response(JSON.stringify({ error: 'Model returned invalid JSON.', detail: raw.slice(0, 1200) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const obj = parsed as {
      overallScore?: number
      verdict?: 'good' | 'mixed' | 'poor'
      executiveSummary?: string
      categories?: unknown[]
      comparison?: unknown
      recommendations?: unknown[]
      standardsApplied?: string
    }

    return new Response(
      JSON.stringify({
        model: MODEL,
        overallScore: Math.max(0, Math.min(100, Math.round(Number(obj.overallScore ?? 0)))),
        verdict: obj.verdict === 'good' || obj.verdict === 'mixed' || obj.verdict === 'poor' ? obj.verdict : 'mixed',
        executiveSummary: sanitizeText(obj.executiveSummary, 2400),
        categories: Array.isArray(obj.categories) ? obj.categories.slice(0, 10) : [],
        comparison: obj.comparison && typeof obj.comparison === 'object' ? obj.comparison : null,
        recommendations: Array.isArray(obj.recommendations) ? obj.recommendations.slice(0, 14) : [],
        standardsApplied: sanitizeText(obj.standardsApplied, 600),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
