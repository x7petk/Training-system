import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1'

const RESPONSE_RULES = `Output rules (strict):
- Answer ONLY from BMS_BRAIN_CONTEXT. No outside knowledge.
- Keep the full reply under 220 words unless the user explicitly asks for more detail.
- Use ONLY the ## sections defined in the mode template below.
- Bullets: max 10 words each; max 5 bullets per section.
- Sentences: short and direct. No preamble, no closing summary, no repetition.
- Markdown only: ## headings, - bullets, **bold** for role/forum/system/process names.
- If context is insufficient, add ## Gaps with 1-3 bullets stating what is missing.`

const ROLE_TEMPLATE = `Use exactly these sections:

## Role snapshot
1-2 sentences on what this role does in BMS Brain.

## Forums
- **Forum** — how the role uses it

## Systems
- **System** — typical touchpoint

## Process steps
- **Step** (*Process*) — one-line action

## Gaps
Only if needed.`

const SYSTEM_TEMPLATE = `Use exactly these sections:

## System snapshot
1-2 sentences on purpose and scope.

## Integrations
- **Linked system/forum** — relationship

## Where it appears
- **Step** (*Process*, Role, Forum) — one line

## Escalations
- bullet or "None in context."

## Gaps
Only if needed.`

const KNOWLEDGE_TEMPLATE = `Use exactly these sections:

## Answer
1-3 sentences answering the question directly.

## Evidence
- **Fact** — from which process/step/role

## Related
- **Item** — brief link to related role/system/forum

## Gaps
Only if needed.`

const SYSTEM = `You are the BMS Brain assistant for operational process documentation.

${RESPONSE_RULES}`

type Body = {
  mode?: 'role' | 'system' | 'knowledge'
  roleId?: string | null
  systemId?: string | null
  question?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as Body
    const mode = body.mode ?? 'knowledge'

    const [{ data: roles }, { data: forums }, { data: systems }, { data: processes }] = await Promise.all([
      supabase.from('bms_brain_roles').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('bms_brain_forums').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('bms_brain_systems').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('bms_brain_processes').select('*').eq('status', 'published').order('updated_at', { ascending: false }),
    ])

    const context = {
      roles: roles ?? [],
      forums: forums ?? [],
      systems: systems ?? [],
      publishedProcesses: (processes ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        flow: p.flow,
      })),
    }

    let userPrompt = ''
    if (mode === 'role') {
      const role = (roles ?? []).find((r) => r.id === body.roleId)
      userPrompt = `${ROLE_TEMPLATE}\n\nTask: Summarise this role using only matching steps from published processes.\n\nRole focus: ${JSON.stringify(role ?? null)}`
    } else if (mode === 'system') {
      const system = (systems ?? []).find((s) => s.id === body.systemId)
      userPrompt = `${SYSTEM_TEMPLATE}\n\nTask: Summarise this system/tool using only matching steps from published processes.\n\nSystem focus: ${JSON.stringify(system ?? null)}`
    } else {
      userPrompt = `${KNOWLEDGE_TEMPLATE}\n\nTask: Answer the question using only published catalog and process data.\n\nQuestion: ${(body.question ?? '').slice(0, 4000)}`
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured on bms-brain-ai function.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `BMS_BRAIN_CONTEXT:\n${JSON.stringify(context).slice(0, 90_000)}\n\n${userPrompt}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 550,
      }),
    })

    const json = await resp.json()
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: json?.error?.message ?? 'OpenAI error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const answer = json.choices?.[0]?.message?.content ?? ''
    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
