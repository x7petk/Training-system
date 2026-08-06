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

const PM_CHAT_SYSTEM = `You are the Product Manager for the Apps Team building product features for this training/ops web app (Vite React + Supabase, deployed on Vercel as training-system-seven).

You talk to the customer (the human). Your job:
1. Ask crisp clarifying questions until you are confident you have enough detail.
2. Never invent requirements. Confirm ambiguous points.
3. When ready, structure a complete ticket.

You NEVER stop owning delivery. You coordinate Designer → Developer → Tester → DevOps. After a ticket is created, the customer can still message you for changes or clarifications.

Design principles you enforce for every ticket (Designer must follow these too):
- One-pager principle: primary flows fit one screen/composition; avoid dashboard clutter.
- Fewer clicks: minimize steps to value.
- Reuse modern patterns/components already used in this app (Tailwind, Lucide, existing layouts).

Output STRICT JSON only:
{
  "reply": "markdown message to the customer",
  "readyForTicket": false,
  "openQuestions": ["..."],
  "ticket": null | {
    "title": "short title",
    "description": "problem + context + desired outcome",
    "valueProposition": "why this matters / business value",
    "requirements": ["atomic requirement", "..."],
    "acceptanceCriteria": ["testable criterion", "..."]
  }
}

Set readyForTicket=true only when openQuestions is empty and ticket fields are complete and specific.`

const DESIGNER_SYSTEM = `You are the Apps Team Designer. Produce a design brief that aligns with:
- One-pager / single-composition primary views (not busy dashboards unless requested)
- Fewer clicks to complete the job
- Modern components consistent with an existing Vite/React/Tailwind app (sidebar layouts, drawers, boards, chat panes)
- No decorative clutter, no generic AI purple-glow aesthetic

Output STRICT JSON:
{
  "summary": "1-2 sentence design intent",
  "layout": "page structure and regions",
  "components": ["component choices"],
  "interactionFlow": ["step"],
  "clickBudget": "how many clicks for the core job",
  "alignmentNotes": "how this matches one-pager / less-clicks / existing patterns",
  "openQuestions": ["questions for PM if any"],
  "readyForPmReview": true
}`

const PM_REVIEW_SYSTEM = `You are the Apps Team Product Manager reviewing Designer output.
Approve only if the design matches ticket requirements AND one-pager / fewer-clicks / modern existing-component principles.
If not, request rework with concrete notes.

Output STRICT JSON:
{
  "approved": true,
  "feedback": "message to designer or confirmation",
  "customerNote": "short update for the customer"
}`

const TESTER_SYSTEM = `You are the Apps Team Tester. Given ticket requirements, acceptance criteria, design brief, and build artifacts (PR/branch/summary), produce a test report.
Be concrete. Mark fail if evidence is insufficient.

Output STRICT JSON:
{
  "passed": true,
  "summary": "overall result",
  "cases": [{"name":"...", "result":"pass|fail|blocked", "notes":"..."}],
  "bugs": ["..."],
  "questionsForPm": ["..."],
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
        `Conversation so far:\n${transcript}${ticketHint}\n\nRespond as PM JSON.`,
      )

      const reply = sanitize(result.reply, 10_000) || 'Could you share a bit more detail?'
      const readyForTicket = Boolean(result.readyForTicket)
      const openQuestions = asStringArray(result.openQuestions)
      const ticket = readyForTicket && openQuestions.length === 0 ? parseTicketDraft(result.ticket) : null

      return json({
        action: 'chat',
        model: MODEL,
        reply,
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
          `Design this ticket for the Apps Team product.\n${ticketContextBlock(ticket)}`,
        )
        const openQuestions = asStringArray(result.openQuestions)
        const designBrief = {
          summary: sanitize(result.summary, 1000),
          layout: sanitize(result.layout, 3000),
          components: asStringArray(result.components),
          interactionFlow: asStringArray(result.interactionFlow),
          clickBudget: sanitize(result.clickBudget, 400),
          alignmentNotes: sanitize(result.alignmentNotes, 2000),
          openQuestions,
        }
        const needsClarify = openQuestions.length > 0 || result.readyForPmReview === false
        return json({
          action: 'advance',
          fromStatus: 'design',
          toStatus: needsClarify ? 'clarify' : 'pm_review_design',
          activeAgent: needsClarify ? 'pm' : 'pm',
          designBrief,
          messages: [
            {
              fromRole: 'designer',
              toRole: 'pm',
              body:
                designBrief.summary +
                (openQuestions.length
                  ? `\n\nOpen questions:\n- ${openQuestions.join('\n- ')}`
                  : '\n\nDesign brief ready for PM review.'),
              meta: { designBrief },
            },
          ],
          events: [
            {
              eventType: 'handoff',
              actorRole: 'designer',
              summary: needsClarify
                ? 'Designer needs clarification before PM review'
                : 'Designer completed brief; sent to PM review',
              detail: { designBrief },
            },
          ],
          customerNote: needsClarify
            ? 'Designer has clarifying questions — I am working those with the team.'
            : 'Design draft is ready; I am reviewing it against requirements and one-pager principles.',
        })
      }

      if (ticket.status === 'pm_review_design') {
        const result = await openaiJson(
          PM_REVIEW_SYSTEM,
          `Review this design against the ticket.\n${ticketContextBlock(ticket)}`,
        )
        const approved = Boolean(result.approved)
        return json({
          action: 'advance',
          fromStatus: 'pm_review_design',
          toStatus: approved ? 'build' : 'design',
          activeAgent: approved ? 'developer' : 'designer',
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
          customerNote:
            sanitize(result.customerNote, 2000) ||
            (approved ? 'Design approved — Developer is starting the build in Cursor Cloud.' : 'Design needs another pass.'),
        })
      }

      if (ticket.status === 'build' || ticket.status === 'clarify') {
        // If already has an active Cursor run, tell client to sync instead of launching again.
        if (ticket.cursorAgentId && ticket.cursorRunId && ticket.status === 'build') {
          return json({
            action: 'advance',
            fromStatus: ticket.status,
            toStatus: ticket.status,
            activeAgent: 'developer',
            deferToSync: true,
            customerNote: 'Developer cloud agent is already running — syncing status.',
            messages: [],
            events: [],
          })
        }

        const clarifyNote = sanitize(body.customerNote, 4000)
        if (ticket.status === 'clarify' && ticket.cursorAgentId) {
          const follow = await followUpCursorAgent(
            ticket.cursorAgentId,
            `PM clarification / answers:\n${clarifyNote || '(see ticket updates)'}\n\nUpdated ticket:\n${ticketContextBlock(ticket)}\n\nContinue the implementation. Ask PM only if still blocked.`,
          )
          return json({
            action: 'advance',
            fromStatus: 'clarify',
            toStatus: 'build',
            activeAgent: 'developer',
            cursor: {
              agentId: ticket.cursorAgentId,
              runId: follow.runId,
              url: ticket.cursorUrl,
            },
            messages: [
              {
                fromRole: 'pm',
                toRole: 'developer',
                body: clarifyNote || 'Continuing with clarified requirements.',
                meta: {},
              },
              {
                fromRole: 'system',
                toRole: 'developer',
                body: `Cursor follow-up run started: ${follow.runId}`,
                meta: { runId: follow.runId },
              },
            ],
            events: [
              {
                eventType: 'cursor_followup',
                actorRole: 'pm',
                summary: 'PM answered clarifications; Developer cloud run resumed',
                detail: { runId: follow.runId },
              },
            ],
            customerNote: 'I sent clarifications to the Developer cloud agent.',
          })
        }

        const prompt =
          `You are the Apps Team Developer working in Cursor Cloud.\n` +
          `Implement this ticket fully in the Training-system repo. Follow the design brief and acceptance criteria.\n` +
          `If anything is blocking, end with a clear QUESTIONS FOR PM section.\n` +
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
          cursor: launched,
          messages: [
            {
              fromRole: 'pm',
              toRole: 'developer',
              body: 'Build kicked off in Cursor Cloud. Implement per requirements + design brief; ask me if blocked.',
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
          customerNote: `Developer is building in Cursor Cloud: ${launched.url}`,
        })
      }

      if (ticket.status === 'test') {
        const result = await openaiJson(
          TESTER_SYSTEM,
          `Test this delivery.\n${ticketContextBlock(ticket)}`,
        )
        const passed = Boolean(result.passed) && Boolean(result.readyForDeploy)
        const questions = asStringArray(result.questionsForPm)
        const bugs = asStringArray(result.bugs)
        return json({
          action: 'advance',
          fromStatus: 'test',
          toStatus: passed ? 'deploy' : questions.length || bugs.length ? 'clarify' : 'build',
          activeAgent: passed ? 'devops' : 'pm',
          testReport: result,
          messages: [
            {
              fromRole: 'tester',
              toRole: 'pm',
              body:
                sanitize(result.summary, 4000) +
                (bugs.length ? `\n\nBugs:\n- ${bugs.join('\n- ')}` : '') +
                (questions.length ? `\n\nQuestions:\n- ${questions.join('\n- ')}` : ''),
              meta: { testReport: result },
            },
          ],
          events: [
            {
              eventType: passed ? 'handoff' : 'rework',
              actorRole: 'tester',
              summary: passed ? 'Tests passed; handing to DevOps' : 'Tester found issues / needs clarification',
              detail: { testReport: result },
            },
          ],
          customerNote: passed
            ? 'Testing passed — DevOps is preparing production deploy.'
            : 'Testing found issues; I am coordinating a fix.',
        })
      }

      if (ticket.status === 'deploy') {
        if (ticket.cursorAgentId && ticket.artifacts?.deployRunId) {
          return json({
            action: 'advance',
            fromStatus: 'deploy',
            toStatus: 'deploy',
            activeAgent: 'devops',
            deferToSync: true,
            messages: [],
            events: [],
            customerNote: 'DevOps cloud agent already running — syncing.',
          })
        }

        const prompt =
          DEVOPS_PROMPT_PREFIX +
          `\nFeature ticket to ship:\n${ticketContextBlock(ticket)}\n` +
          `If a PR URL exists in artifacts, work from that. Otherwise prepare deploy notes and any needed release steps.\n` +
          `End with DEPLOY RESULT including production URL and whether alias training-system-seven.vercel.app points at the new deployment.`

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
          customerNote: `DevOps is deploying via Cursor Cloud: ${launched.url}`,
        })
      }

      if (ticket.status === 'done') {
        return json({
          action: 'advance',
          fromStatus: 'done',
          toStatus: 'done',
          activeAgent: null,
          messages: [],
          events: [],
          customerNote: 'This ticket is already complete.',
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
          messages: [],
          events: [],
          customerNote: 'No Cursor run to sync yet.',
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
          messages: [],
          events: [
            {
              eventType: 'cursor_status',
              actorRole: ticket.status === 'deploy' ? 'devops' : 'developer',
              summary: `Cloud run status: ${status}`,
              detail: { status, agentId, runId },
            },
          ],
          customerNote: `Cloud agent still working (${status}).`,
        })
      }

      if (terminalFail) {
        return json({
          action: 'sync',
          fromStatus: ticket.status,
          toStatus: 'blocked',
          runStatus: status,
          activeAgent: 'pm',
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
          customerNote: 'A cloud agent hit an error — I am investigating and will restart the step.',
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
        }

        if (looksLikeQuestions) {
          return json({
            action: 'sync',
            fromStatus: ticket.status,
            toStatus: 'clarify',
            runStatus: status,
            activeAgent: 'pm',
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
                summary: 'Developer paused with questions for PM',
                detail: artifactsPatch,
              },
            ],
            customerNote: 'Developer has clarifying questions — I am resolving them.',
          })
        }

        return json({
          action: 'sync',
          fromStatus: ticket.status,
          toStatus: 'test',
          runStatus: status,
          activeAgent: 'tester',
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
          customerNote: 'Build finished in the cloud — Tester is reviewing.',
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
              body: 'Work is complete and handed through DevOps. Production target: https://training-system-seven.vercel.app',
              meta: {},
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
          customerNote: 'Deploy finished — ticket is done.',
        })
      }

      return json({
        action: 'sync',
        fromStatus: ticket.status,
        toStatus: ticket.status,
        runStatus: status,
        messages: [],
        events: [],
        customerNote: `Synced Cursor status ${status}.`,
      })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
