import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5.4'
const CURSOR_API = 'https://api.cursor.com/v1'
const DEFAULT_REPO =
  Deno.env.get('APPS_TEAM_REPO_URL') || 'https://github.com/x7petk/Training-system'
const DEFAULT_REF = Deno.env.get('APPS_TEAM_REPO_REF') || 'main'

type AgentRole = 'pm' | 'designer' | 'developer' | 'tester' | 'devops'
type TicketStatus =
  | 'intake'
  | 'design'
  | 'pm_review_design'
  | 'build'
  | 'clarify'
  | 'test'
  | 'deploy'
  | 'done'
  | 'blocked'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

type TicketDraft = {
  title: string
  description: string
  valueProposition: string
  requirements: string[]
  acceptanceCriteria: string[]
}

type TicketSnapshot = {
  id: string
  title: string
  status: TicketStatus
  description: string
  valueProposition: string
  requirements: string[]
  acceptanceCriteria: string[]
  designBrief: Record<string, unknown> | null
  artifacts: Record<string, unknown>
  activeAgent: AgentRole | null
  cursorAgentId: string | null
  cursorRunId: string | null
  cursorUrl: string | null
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sanitize(v: unknown, max = 12_000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, 40)
}

function stripJsonFence(v: string): string {
  const t = v.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  return t
}

async function openaiJson(system: string, user: string): Promise<Record<string, unknown>> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) throw new Error('OPENAI_API_KEY is not configured on the apps-team Edge Function.')

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_completion_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 1200)
    throw new Error(`OpenAI failed (${upstream.status}): ${detail}`)
  }

  const completion = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = completion.choices?.[0]?.message?.content ?? ''
  if (!raw.trim()) throw new Error('Model returned empty content.')
  return JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
}

function cursorAuthHeader(): string {
  const key = Deno.env.get('CURSOR_API_KEY')?.trim()
  if (!key) throw new Error('CURSOR_API_KEY is not configured on the apps-team Edge Function.')
  // Basic auth with API key as username, empty password
  return `Basic ${btoa(`${key}:`)}`
}

async function cursorFetch(path: string, init?: RequestInit): Promise<Response> {
  return await fetch(`${CURSOR_API}${path}`, {
    ...init,
    headers: {
      Authorization: cursorAuthHeader(),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

async function launchCursorAgent(opts: {
  name: string
  prompt: string
  autoCreatePR?: boolean
}): Promise<{ agentId: string; runId: string; url: string }> {
  const res = await cursorFetch('/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name.slice(0, 100),
      prompt: { text: opts.prompt },
      repos: [{ url: DEFAULT_REPO, startingRef: DEFAULT_REF }],
      autoCreatePR: opts.autoCreatePR ?? true,
      skipReviewerRequest: true,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Cursor create agent failed (${res.status}): ${text.slice(0, 800)}`)
  }
  const parsed = JSON.parse(text) as {
    agent?: { id?: string; url?: string }
    run?: { id?: string }
  }
  const agentId = parsed.agent?.id
  const runId = parsed.run?.id
  if (!agentId || !runId) throw new Error('Cursor create agent response missing ids.')
  return {
    agentId,
    runId,
    url: parsed.agent?.url || `https://cursor.com/agents/${agentId}`,
  }
}

async function followUpCursorAgent(
  agentId: string,
  prompt: string,
): Promise<{ runId: string }> {
  const res = await cursorFetch(`/agents/${encodeURIComponent(agentId)}/runs`, {
    method: 'POST',
    body: JSON.stringify({ prompt: { text: prompt } }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Cursor follow-up failed (${res.status}): ${text.slice(0, 800)}`)
  }
  const parsed = JSON.parse(text) as { id?: string; run?: { id?: string } }
  const runId = parsed.id || parsed.run?.id
  if (!runId) throw new Error('Cursor follow-up response missing run id.')
  return { runId }
}

async function getCursorRun(
  agentId: string,
  runId: string,
): Promise<{
  status: string
  summary?: string
  git?: { branches?: Array<{ repoUrl?: string; branch?: string; prUrl?: string }> }
}> {
  const res = await cursorFetch(
    `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Cursor get run failed (${res.status}): ${text.slice(0, 800)}`)
  }
  return JSON.parse(text) as {
    status: string
    summary?: string
    git?: { branches?: Array<{ repoUrl?: string; branch?: string; prUrl?: string }> }
  }
}

const PM_CHAT_SYSTEM = `You are the Product Manager for the Apps Team (Vite React + Supabase app, Vercel training-system-seven).

Customer involvement policy (CRITICAL):
- Minimize questions. Make confident product decisions yourself.
- Ask the customer ONLY when you truly cannot decide (business preference, conflicting goals, missing secret/credential, destructive irreversible choice).
- Prefer 0–1 questions total. Never quiz them through the whole ticket.
- After the ticket is created, do NOT narrate internal pipeline steps. The board shows progress. Only message the customer for a real question or final done summary.

Your job:
1. From the customer's request, infer a solid ticket with sensible defaults.
2. When ready, structure a complete ticket and start the team (Designer → Developer → Tester → DevOps).
3. You own delivery until done. You answer Designer/Developer/Tester questions yourself whenever possible.

Design principles to bake into every ticket:
- One-pager principle; fewer clicks; reuse existing Tailwind/Lucide/layout patterns.

Output STRICT JSON only:
{
  "reply": "short message to the customer",
  "needsCustomerInput": false,
  "readyForTicket": false,
  "openQuestions": [],
  "ticket": null | {
    "title": "short title",
    "description": "problem + context + desired outcome",
    "valueProposition": "why this matters",
    "requirements": ["atomic requirement"],
    "acceptanceCriteria": ["testable criterion"]
  }
}

Rules:
- If needsCustomerInput=true, openQuestions has the one question and readyForTicket=false.
- If readyForTicket=true, openQuestions must be empty, needsCustomerInput=false, ticket complete.
- When making assumptions, briefly state them in reply (one short paragraph), then create the ticket.`

const DESIGNER_SYSTEM = `You are the Apps Team Designer. Produce a complete design brief. Do NOT leave open questions for the customer.
If anything is ambiguous, choose the best option that matches one-pager / fewer-clicks / existing app patterns and note the decision in alignmentNotes.

Output STRICT JSON:
{
  "summary": "1-2 sentence design intent",
  "layout": "page structure and regions",
  "components": ["component choices"],
  "interactionFlow": ["step"],
  "clickBudget": "how many clicks for the core job",
  "alignmentNotes": "decisions + how this matches principles",
  "openQuestions": [],
  "readyForPmReview": true
}`

const PM_REVIEW_SYSTEM = `You are the Apps Team Product Manager reviewing Designer output.
Decide yourself. Prefer approving a good-enough design that matches requirements and one-pager / fewer-clicks principles.
Only reject for concrete rework instructions to the Designer (not to the customer).

Output STRICT JSON:
{
  "approved": true,
  "feedback": "message to designer or confirmation"
}`

const PM_RESOLVE_SYSTEM = `You are the Apps Team Product Manager. Another agent asked questions or the pipeline is blocked.
Decide answers yourself from the ticket + product judgment. Prefer shipping.
Ask the customer ONLY if you truly cannot decide.

Output STRICT JSON:
{
  "needsCustomerInput": false,
  "customerQuestion": null,
  "decisionSummary": "what you decided",
  "resumeInstructions": "concrete instructions for the next agent",
  "retry": true
}`

const TESTER_SYSTEM = `You are the Apps Team Tester. Produce a test report from ticket + artifacts.
Decide pass/fail yourself. Do not ask the customer. Put residual risks in summary.
Prefer readyForDeploy=true when a PR/build summary exists and no critical acceptance criterion is clearly broken.

Output STRICT JSON:
{
  "passed": true,
  "summary": "overall result",
  "cases": [{"name":"...", "result":"pass|fail|blocked", "notes":"..."}],
  "bugs": [],
  "questionsForPm": [],
  "readyForDeploy": true
}`

const DEVOPS_PROMPT_PREFIX = `You are the Apps Team DevOps agent working in Cursor Cloud on this repository.
Deploy/production target for this product is Vercel project training-system-seven (scope mikhails-projects-de0149d2), production URL https://training-system-seven.vercel.app.

Your job: prepare and execute production deploy for the completed feature (merge guidance if PR exists, verify build, note production alias). Do not force-push. Prefer documenting exact commands and applying safe deploy steps available in the environment.
`

function ticketContextBlock(t: TicketSnapshot): string {
  return JSON.stringify(
    {
      id: t.id,
      title: t.title,
      status: t.status,
      description: t.description,
      valueProposition: t.valueProposition,
      requirements: t.requirements,
      acceptanceCriteria: t.acceptanceCriteria,
      designBrief: t.designBrief,
      artifacts: t.artifacts,
      cursor: {
        agentId: t.cursorAgentId,
        runId: t.cursorRunId,
        url: t.cursorUrl,
      },
    },
    null,
    2,
  )
}

function parseTicketDraft(raw: unknown): TicketDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const title = sanitize(o.title, 160)
  const description = sanitize(o.description, 8000)
  if (!title || !description) return null
  return {
    title,
    description,
    valueProposition: sanitize(o.valueProposition, 2000),
    requirements: asStringArray(o.requirements),
    acceptanceCriteria: asStringArray(o.acceptanceCriteria),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)

    const body = (await req.json()) as {
      action?: string
      messages?: ChatTurn[]
      ticket?: TicketSnapshot
      customerNote?: string
    }

    const action = body.action || 'chat'

    if (action === 'chat') {
      const messages = Array.isArray(body.messages) ? body.messages : []
      const sanitized: ChatTurn[] = []
      for (const m of messages.slice(-24)) {
        if (m.role !== 'user' && m.role !== 'assistant') continue
        sanitized.push({ role: m.role, content: sanitize(m.content, 10_000) })
      }
      if (sanitized.length === 0) return json({ error: 'messages required' }, 400)

      const transcript = sanitized
        .map((m) => `${m.role === 'user' ? 'CUSTOMER' : 'PM'}: ${m.content}`)
        .join('\n\n')

      const ticketHint = body.ticket
        ? `\n\nExisting active ticket context (may update verbally; do not duplicate unless customer asks for a new ticket):\n${ticketContextBlock(body.ticket)}`
        : ''

      const result = await openaiJson(
        PM_CHAT_SYSTEM,
        `Conversation so far:\n${transcript}${ticketHint}\n\nRespond as PM JSON. Prefer creating the ticket with assumptions over asking more questions.`,
      )

      const needsCustomerInput = Boolean(result.needsCustomerInput)
      const openQuestions = asStringArray(result.openQuestions)
      const readyForTicket = Boolean(result.readyForTicket) && !needsCustomerInput && openQuestions.length === 0
      const ticket = readyForTicket ? parseTicketDraft(result.ticket) : null
      const reply =
        sanitize(result.reply, 10_000) ||
        (needsCustomerInput
          ? openQuestions[0] || 'I need one decision from you to continue.'
          : ticket
            ? `Got it — I'll run with these assumptions and start the team on “${ticket.title}”.`
            : 'Working on it.')

      return json({
        action: 'chat',
        model: MODEL,
        reply,
        needsCustomerInput,
        readyForTicket: Boolean(ticket),
        openQuestions,
        ticket,
      })
    }

    if (action === 'advance') {
      const ticket = body.ticket
      if (!ticket?.id || !ticket.status) return json({ error: 'ticket snapshot required' }, 400)

      if (ticket.status === 'design') {
        const result = await openaiJson(
          DESIGNER_SYSTEM,
          `Design this ticket for the Apps Team product. Decide any ambiguities yourself.\n${ticketContextBlock(ticket)}`,
        )
        const designBrief = {
          summary: sanitize(result.summary, 1000),
          layout: sanitize(result.layout, 3000),
          components: asStringArray(result.components),
          interactionFlow: asStringArray(result.interactionFlow),
          clickBudget: sanitize(result.clickBudget, 400),
          alignmentNotes: sanitize(result.alignmentNotes, 2000),
          openQuestions: [] as string[],
        }
        return json({
          action: 'advance',
          fromStatus: 'design',
          toStatus: 'pm_review_design',
          activeAgent: 'pm',
          notifyCustomer: false,
          designBrief,
          messages: [
            {
              fromRole: 'designer',
              toRole: 'pm',
              body: `${designBrief.summary}\n\nDesign brief ready for PM review.`,
              meta: { designBrief },
            },
          ],
          events: [
            {
              eventType: 'handoff',
              actorRole: 'designer',
              summary: 'Designer completed brief; sent to PM review',
              detail: { designBrief },
            },
          ],
        })
      }

      if (ticket.status === 'pm_review_design') {
        const result = await openaiJson(
          PM_REVIEW_SYSTEM,
          `Review this design against the ticket. Decide yourself.\n${ticketContextBlock(ticket)}`,
        )
        const approved = result.approved !== false
        return json({
          action: 'advance',
          fromStatus: 'pm_review_design',
          toStatus: approved ? 'build' : 'design',
          activeAgent: approved ? 'developer' : 'designer',
          notifyCustomer: false,
          messages: [
            {
              fromRole: 'pm',
              toRole: approved ? 'developer' : 'designer',
              body: sanitize(result.feedback, 6000) || (approved ? 'Design approved.' : 'Rework required.'),
              meta: { approved },
            },
          ],
          events: [
            {
              eventType: approved ? 'handoff' : 'rework',
              actorRole: 'pm',
              summary: approved ? 'PM approved design; handed to Developer' : 'PM requested design rework',
              detail: { approved, feedback: result.feedback },
            },
          ],
        })
      }

      if (ticket.status === 'clarify' || ticket.status === 'blocked') {
        const pendingDevQuestions = sanitize(
          String(ticket.artifacts?.buildSummary ?? ticket.artifacts?.lastAgentQuestion ?? ''),
          6000,
        )
        const resolve = await openaiJson(
          PM_RESOLVE_SYSTEM,
          `Ticket status: ${ticket.status}\nPending agent notes:\n${pendingDevQuestions || '(none)'}\n\nTicket:\n${ticketContextBlock(ticket)}\n\nDecide and continue the pipeline without the customer if possible.`,
        )
        const needsCustomerInput = Boolean(resolve.needsCustomerInput)
        if (needsCustomerInput) {
          const q =
            sanitize(resolve.customerQuestion, 2000) ||
            'I need one decision from you before the team can continue.'
          return json({
            action: 'advance',
            fromStatus: ticket.status,
            toStatus: 'clarify',
            activeAgent: 'pm',
            needsCustomerInput: true,
            notifyCustomer: true,
            customerNote: q,
            messages: [
              {
                fromRole: 'pm',
                toRole: 'customer',
                body: q,
                meta: { kind: 'customer_question' },
              },
            ],
            events: [
              {
                eventType: 'awaiting_customer',
                actorRole: 'pm',
                summary: 'PM needs one customer decision',
                detail: { question: q },
              },
            ],
          })
        }

        const resumeInstructions =
          sanitize(resolve.resumeInstructions, 6000) ||
          sanitize(resolve.decisionSummary, 4000) ||
          'Proceed with the best product judgment from the ticket.'

        // Resume developer if we have a cloud agent; otherwise send back to build/design.
        if (ticket.cursorAgentId && (ticket.status === 'clarify' || ticket.artifacts?.buildSummary)) {
          const follow = await followUpCursorAgent(
            ticket.cursorAgentId,
            `PM decision (customer not involved):\n${resumeInstructions}\n\nUpdated ticket:\n${ticketContextBlock(ticket)}\n\nContinue implementation. Prefer finishing over asking more questions. Only use QUESTIONS FOR PM if truly blocked.`,
          )
          return json({
            action: 'advance',
            fromStatus: ticket.status,
            toStatus: 'build',
            activeAgent: 'developer',
            notifyCustomer: false,
            cursor: {
              agentId: ticket.cursorAgentId,
              runId: follow.runId,
              url: ticket.cursorUrl,
            },
            artifactsPatch: { lastPmDecision: resumeInstructions },
            messages: [
              {
                fromRole: 'pm',
                toRole: 'developer',
                body: resumeInstructions,
                meta: { autonomous: true },
              },
            ],
            events: [
              {
                eventType: 'pm_decision',
                actorRole: 'pm',
                summary: 'PM resolved questions autonomously; Developer resumed',
                detail: { runId: follow.runId, decision: resumeInstructions },
              },
            ],
          })
        }

        // Blocked with no usable agent → retry from build (or design if no brief).
        const retryStatus: TicketStatus = ticket.designBrief ? 'build' : 'design'
        return json({
          action: 'advance',
          fromStatus: ticket.status,
          toStatus: retryStatus,
          activeAgent: retryStatus === 'build' ? 'developer' : 'designer',
          notifyCustomer: false,
          artifactsPatch: {
            lastPmDecision: resumeInstructions,
            cursorRetry: true,
          },
          clearCursor: true,
          messages: [
            {
              fromRole: 'pm',
              toRole: 'system',
              body: `Restarting at ${retryStatus}. ${resumeInstructions}`,
              meta: { autonomous: true },
            },
          ],
          events: [
            {
              eventType: 'pm_decision',
              actorRole: 'pm',
              summary: `PM unblocked ticket; retrying from ${retryStatus}`,
              detail: { decision: resumeInstructions },
            },
          ],
        })
      }

      if (ticket.status === 'build') {
        // If already has an active Cursor run, tell client to sync instead of launching again.
        if (ticket.cursorAgentId && ticket.cursorRunId && !ticket.artifacts?.cursorRetry) {
          return json({
            action: 'advance',
            fromStatus: ticket.status,
            toStatus: ticket.status,
            activeAgent: 'developer',
            deferToSync: true,
            notifyCustomer: false,
            messages: [],
            events: [],
          })
        }

        const prompt =
          `You are the Apps Team Developer working in Cursor Cloud.\n` +
          `Implement this ticket fully in the Training-system repo. Follow the design brief and acceptance criteria.\n` +
          `Make reasonable product/engineering decisions yourself. Do NOT ask the customer.\n` +
          `If truly blocked by missing info only the PM can decide, end with a clear QUESTIONS FOR PM section.\n` +
          `Prefer matching existing app patterns (Agents section, Tailwind, React Router).\n\n` +
          `TICKET:\n${ticketContextBlock(ticket)}\n`

        const launched = await launchCursorAgent({
          name: `Apps Team Dev: ${ticket.title}`.slice(0, 100),
          prompt,
          autoCreatePR: true,
        })

        return json({
          action: 'advance',
          fromStatus: ticket.status,
          toStatus: 'build',
          activeAgent: 'developer',
          notifyCustomer: false,
          cursor: launched,
          artifactsPatch: { cursorRetry: false },
          messages: [
            {
              fromRole: 'pm',
              toRole: 'developer',
              body: 'Build kicked off in Cursor Cloud. Decide details yourself; ask PM only if blocked.',
              meta: launched,
            },
            {
              fromRole: 'system',
              toRole: 'developer',
              body: `Cursor agent ${launched.agentId} started (run ${launched.runId}). ${launched.url}`,
              meta: launched,
            },
          ],
          events: [
            {
              eventType: 'cursor_launch',
              actorRole: 'developer',
              summary: 'Developer cloud agent launched',
              detail: launched,
            },
          ],
        })
      }

      if (ticket.status === 'test') {
        const result = await openaiJson(
          TESTER_SYSTEM,
          `Test this delivery. Decide yourself; do not involve the customer.\n${ticketContextBlock(ticket)}`,
        )
        const passed = result.passed !== false && result.readyForDeploy !== false
        const bugs = asStringArray(result.bugs)
        // Failures go to PM clarify for autonomous fix — not customer.
        return json({
          action: 'advance',
          fromStatus: 'test',
          toStatus: passed ? 'deploy' : 'clarify',
          activeAgent: passed ? 'devops' : 'pm',
          notifyCustomer: false,
          testReport: result,
          artifactsPatch: passed
            ? {}
            : {
                lastAgentQuestion:
                  sanitize(result.summary, 4000) +
                  (bugs.length ? `\nBugs:\n- ${bugs.join('\n- ')}` : ''),
              },
          messages: [
            {
              fromRole: 'tester',
              toRole: 'pm',
              body:
                sanitize(result.summary, 4000) +
                (bugs.length ? `\n\nBugs:\n- ${bugs.join('\n- ')}` : ''),
              meta: { testReport: result },
            },
          ],
          events: [
            {
              eventType: passed ? 'handoff' : 'rework',
              actorRole: 'tester',
              summary: passed ? 'Tests passed; handing to DevOps' : 'Tester found issues; PM will decide fixes',
              detail: { testReport: result },
            },
          ],
        })
      }

      if (ticket.status === 'deploy') {
        if (ticket.artifacts?.deployRunId) {
          return json({
            action: 'advance',
            fromStatus: 'deploy',
            toStatus: 'deploy',
            activeAgent: 'devops',
            deferToSync: true,
            notifyCustomer: false,
            messages: [],
            events: [],
          })
        }

        const prompt =
          DEVOPS_PROMPT_PREFIX +
          `\nFeature ticket to ship:\n${ticketContextBlock(ticket)}\n` +
          `If a PR URL exists in artifacts, work from that. Otherwise prepare deploy notes and any needed release steps.\n` +
          `Decide details yourself. End with DEPLOY RESULT including production URL and whether alias training-system-seven.vercel.app points at the new deployment.`

        const launched = await launchCursorAgent({
          name: `Apps Team DevOps: ${ticket.title}`.slice(0, 100),
          prompt,
          autoCreatePR: false,
        })

        return json({
          action: 'advance',
          fromStatus: 'deploy',
          toStatus: 'deploy',
          activeAgent: 'devops',
          notifyCustomer: false,
          cursor: launched,
          artifactsPatch: { deployAgentId: launched.agentId, deployRunId: launched.runId, deployUrl: launched.url },
          messages: [
            {
              fromRole: 'pm',
              toRole: 'devops',
              body: 'Deploy to production when ready. Confirm alias points to latest.',
              meta: launched,
            },
          ],
          events: [
            {
              eventType: 'cursor_launch',
              actorRole: 'devops',
              summary: 'DevOps cloud agent launched',
              detail: launched,
            },
          ],
        })
      }

      if (ticket.status === 'done') {
        return json({
          action: 'advance',
          fromStatus: 'done',
          toStatus: 'done',
          activeAgent: null,
          notifyCustomer: false,
          messages: [],
          events: [],
        })
      }

      if (ticket.status === 'intake') {
        return json({
          action: 'advance',
          fromStatus: 'intake',
          toStatus: 'design',
          activeAgent: 'designer',
          notifyCustomer: false,
          messages: [],
          events: [
            {
              eventType: 'handoff',
              actorRole: 'pm',
              summary: 'Moving intake ticket into design',
              detail: {},
            },
          ],
        })
      }

      return json({ error: `Cannot advance from status ${ticket.status}` }, 400)
    }

    if (action === 'sync') {
      const ticket = body.ticket
      if (!ticket?.id) return json({ error: 'ticket snapshot required' }, 400)

      const agentId =
        ticket.status === 'deploy'
          ? sanitize(String(ticket.artifacts?.deployAgentId ?? ''), 200) || ticket.cursorAgentId
          : ticket.cursorAgentId
      const runId =
        ticket.status === 'deploy'
          ? sanitize(String(ticket.artifacts?.deployRunId ?? ''), 200) || ticket.cursorRunId
          : ticket.cursorRunId

      if (!agentId || !runId) {
        return json({
          action: 'sync',
          fromStatus: ticket.status,
          toStatus: ticket.status,
          runStatus: 'missing',
          notifyCustomer: false,
          messages: [],
          events: [],
        })
      }

      const run = await getCursorRun(agentId, runId)
      const status = String(run.status || '').toUpperCase()
      const prUrl = run.git?.branches?.find((b) => b.prUrl)?.prUrl
      const branch = run.git?.branches?.find((b) => b.branch)?.branch
      const summary = sanitize(run.summary, 6000)

      const terminalOk = ['FINISHED', 'COMPLETED', 'SUCCESS'].includes(status)
      const terminalFail = ['ERROR', 'FAILED', 'CANCELLED', 'CANCELED'].includes(status)
      const running = !terminalOk && !terminalFail

      if (running) {
        return json({
          action: 'sync',
          fromStatus: ticket.status,
          toStatus: ticket.status,
          runStatus: status,
          activeAgent: ticket.status === 'deploy' ? 'devops' : 'developer',
          notifyCustomer: false,
          messages: [],
          events: [],
        })
      }

      if (terminalFail) {
        return json({
          action: 'sync',
          fromStatus: ticket.status,
          toStatus: 'blocked',
          runStatus: status,
          activeAgent: 'pm',
          notifyCustomer: false,
          artifactsPatch: { lastAgentQuestion: summary || `Cursor run ${status}` },
          messages: [
            {
              fromRole: 'system',
              toRole: 'pm',
              body: `Cursor run failed (${status}). ${summary || 'No summary.'}`,
              meta: { status, agentId, runId },
            },
          ],
          events: [
            {
              eventType: 'cursor_error',
              actorRole: 'system',
              summary: `Cloud run ${status}`,
              detail: { status, summary, agentId, runId },
            },
          ],
        })
      }

      // Finished
      if (ticket.status === 'build' || ticket.status === 'clarify') {
        const looksLikeQuestions = /QUESTIONS FOR PM/i.test(summary)
        const artifactsPatch: Record<string, unknown> = {
          ...(prUrl ? { prUrl } : {}),
          ...(branch ? { branch } : {}),
          ...(summary ? { buildSummary: summary } : {}),
          developerAgentId: agentId,
          developerRunId: runId,
          ...(looksLikeQuestions ? { lastAgentQuestion: summary } : {}),
        }

        if (looksLikeQuestions) {
          return json({
            action: 'sync',
            fromStatus: ticket.status,
            toStatus: 'clarify',
            runStatus: status,
            activeAgent: 'pm',
            notifyCustomer: false,
            artifactsPatch,
            messages: [
              {
                fromRole: 'developer',
                toRole: 'pm',
                body: summary || 'Developer has questions before continuing.',
                meta: artifactsPatch,
              },
            ],
            events: [
              {
                eventType: 'cursor_done',
                actorRole: 'developer',
                summary: 'Developer paused with questions for PM (PM will decide)',
                detail: artifactsPatch,
              },
            ],
          })
        }

        return json({
          action: 'sync',
          fromStatus: ticket.status,
          toStatus: 'test',
          runStatus: status,
          activeAgent: 'tester',
          notifyCustomer: false,
          artifactsPatch,
          messages: [
            {
              fromRole: 'developer',
              toRole: 'pm',
              body: summary || 'Build run finished.',
              meta: artifactsPatch,
            },
            {
              fromRole: 'pm',
              toRole: 'tester',
              body: 'Build complete — please test against acceptance criteria.',
              meta: {},
            },
          ],
          events: [
            {
              eventType: 'cursor_done',
              actorRole: 'developer',
              summary: 'Developer cloud run finished; handed to Tester',
              detail: artifactsPatch,
            },
          ],
        })
      }

      if (ticket.status === 'deploy') {
        const artifactsPatch: Record<string, unknown> = {
          ...(summary ? { deploySummary: summary } : {}),
          productionUrl: 'https://training-system-seven.vercel.app',
          deployAgentId: agentId,
          deployRunId: runId,
        }
        return json({
          action: 'sync',
          fromStatus: 'deploy',
          toStatus: 'done',
          runStatus: status,
          activeAgent: null,
          needsCustomerInput: false,
          notifyCustomer: true,
          customerNote: `Done. Shipped to https://training-system-seven.vercel.app${
            summary ? `\n\n${summary.slice(0, 800)}` : ''
          }`,
          artifactsPatch,
          messages: [
            {
              fromRole: 'devops',
              toRole: 'pm',
              body: summary || 'Deploy run finished.',
              meta: artifactsPatch,
            },
            {
              fromRole: 'pm',
              toRole: 'customer',
              body: `Done — live at https://training-system-seven.vercel.app`,
              meta: { kind: 'done' },
            },
          ],
          events: [
            {
              eventType: 'cursor_done',
              actorRole: 'devops',
              summary: 'DevOps cloud run finished; ticket done',
              detail: artifactsPatch,
            },
          ],
        })
      }

      return json({
        action: 'sync',
        fromStatus: ticket.status,
        toStatus: ticket.status,
        runStatus: status,
        notifyCustomer: false,
        messages: [],
        events: [],
      })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
