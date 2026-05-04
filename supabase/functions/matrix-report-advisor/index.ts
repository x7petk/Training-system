import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are the Skill Matrix Report advisor. You are read-only: you explain and plan using ONLY the JSON snapshot provided in the user message block labeled CURRENT_REPORT_SNAPSHOT. Never claim to change data, run updates, or access other systems.

Your expertise is limited to: skill matrix gaps, role requirements, teams, L1→2 training completions (passed attempts in range), L2→3 progression events, who likely needs training next, who may be ready for assessment, prioritisation ideas, and simple trends/charts derived from the snapshot.

If the user asks about anything outside skills, training, assessments, qualification, teams, roles, or this report data (for example weather, coding, politics, unrelated apps), respond with exactly this single paragraph and nothing else:
"That topic is outside this Skill Matrix training advisor. Please ask a different question about skills, trainings, assessments, gaps, or trends from your report."

When a chart would help, add at most one fenced block using exactly this format (valid JSON inside):
\`\`\`advisor-chart
{"kind":"bar","title":"Short title","data":[{"name":"Label","value":12}]}
\`\`\`

Use concise Markdown elsewhere (short headings, bullet lists). Do not invent names, counts, or dates that are not in the snapshot. If the snapshot is empty for a slice, say so clearly.`

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as { messages?: ChatMsg[]; context?: unknown }
    const messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sanitized: ChatMsg[] = []
    for (const m of messages.slice(-20)) {
      if (m.role !== 'user' && m.role !== 'assistant') continue
      const c = typeof m.content === 'string' ? m.content : ''
      sanitized.push({ role: m.role, content: c.slice(0, 14_000) })
    }
    if (sanitized.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const snapshotJson = JSON.stringify(body.context ?? {})
    const snapshotBlock =
      snapshotJson.length > 100_000 ? snapshotJson.slice(0, 100_000) + '\n…(truncated)' : snapshotJson

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Report advisor is not configured. Set the OPENAI_API_KEY secret on the matrix-report-advisor Edge Function and deploy it.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const openaiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `CURRENT_REPORT_SNAPSHOT (JSON):\n${snapshotBlock}`,
      },
      ...sanitized.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.35,
        max_tokens: 2000,
        messages: openaiMessages,
      }),
    })

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 800)
      return new Response(JSON.stringify({ error: `OpenAI request failed (${res.status})`, detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const completion = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = completion.choices?.[0]?.message?.content?.trim() ?? ''

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
