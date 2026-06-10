import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1'
const FAST_MODEL = Deno.env.get('OPENAI_MODEL_FAST') || 'gpt-4.1-mini'

const RESPONSE_RULES = `Output rules (strict):
- Answer ONLY from provided context. No outside knowledge.
- Use ONLY the ## sections defined in the mode template below.
- Bullets: max 12 words each unless noted otherwise.
- Sentences: short and direct. No preamble, no closing summary, no repetition.
- Markdown only: ## headings, - bullets, **bold** for role/forum/system/process names.
- If context is insufficient, add ## Gaps with 1-3 bullets stating what is missing.`

const ROLE_TEMPLATE = `Use exactly these sections:

## Role snapshot
1-2 sentences on what this role does across BMS Brain.

## Forums
- You MUST include one bullet for EVERY forum in FORUMS_INPUT, in the same order.
- Format: **Forum name** — how this role uses it (from documented steps, or forum description if no steps).
- Never skip a forum. Never stop after the first forum.

## Systems
- **System** — typical touchpoint for this role

## Process steps
- **Step** (*Process*, Forum) — one-line action (cover all forums that have steps)

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

const MATRIX_CELL_NO_DATA = 'No data'

const MATRIX_RULES = `Output rules for matrix AI mode (strict):
- Return ONLY valid JSON matching the schema below. No markdown, no commentary.
- Use ONLY the CELLS_INPUT data. No outside knowledge.
- Include one object in "cells" for EVERY item in CELLS_INPUT (exact roleId and forumId pairs).
- Never omit a cell. Never stop after the first role or forum.
- If steps array is empty: headline "", groups [], systems [], gap "${MATRIX_CELL_NO_DATA}". Do not invent content.
- Goal: simplify overloaded process blocks into a readable one-page matrix. Merge overlapping or duplicate steps.
- headline: 1 short sentence — this role's core job in this forum (max 18 words).
- groups: consolidate key steps into 1-4 themed groups. Do not drop important actions — merge wording instead.
  - title: group name (max 6 words).
  - items: max 3 bullets per group, max 12 words each.
  - systems: optional tool tags for that group only (max 3 strings).
- systems: primary tools for the whole cell (max 4 unique names).
- gap: null when complete, else brief note on missing context.`

const MATRIX_JSON_SCHEMA = `{
  "cells": [
    {
      "roleId": "uuid",
      "forumId": "uuid",
      "headline": "string",
      "groups": [
        {
          "title": "string",
          "items": ["string"],
          "systems": ["string"]
        }
      ],
      "systems": ["string"],
      "gap": "string | null"
    }
  ]
}`

const ROLE_SUMMARY_MATRIX_RULES = `Output rules for role summary matrix mode (strict):
- Return ONLY valid JSON matching the schema below. No markdown, no commentary.
- Use ONLY the CELLS_INPUT data. No outside knowledge.
- Include one object in "cells" for EVERY item in CELLS_INPUT (exact roleId and forumId pairs).
- Never omit a cell. Never stop after the first role or forum.
- If steps array is empty: purpose "", mustDo [], decisions [], systems [], handoffs [], gap "${MATRIX_CELL_NO_DATA}". Do not invent content.
- purpose: 1 sentence on this role's accountability in this forum (max 22 words).
- mustDo: ALL distinct non-decision actions from steps — do not omit. Max 12 bullets, max 14 words each.
- decisions: decision-step obligations only. Max 6 bullets.
- systems: unique system/tool names from steps. Max 6 strings.
- handoffs: escalations, reviews, subprocess links, cross-role handoffs. Max 5 bullets.
- gap: null when complete, else brief note on missing context.`

const ROLE_SUMMARY_JSON_SCHEMA = `{
  "cells": [
    {
      "roleId": "uuid",
      "forumId": "uuid",
      "purpose": "string",
      "mustDo": ["string"],
      "decisions": ["string"],
      "systems": ["string"],
      "handoffs": ["string"],
      "gap": "string | null"
    }
  ]
}`

const SYSTEM = `You are the BMS Brain assistant for operational process documentation.

${RESPONSE_RULES}`

type Body = {
  mode?: 'role' | 'system' | 'knowledge' | 'matrix' | 'matrixAi' | 'roleSummaries'
  roleId?: string | null
  systemId?: string | null
  question?: string
  filters?: {
    systemIds?: string[]
    roleIds?: string[]
    forumIds?: string[]
  }
}

type StepRef = {
  label: string
  kind: string
  processName: string
  systems: string[]
  description?: string
}

type CellInput = {
  roleId: string
  roleName: string
  forumId: string
  forumName: string
  forumDescription?: string
  steps: StepRef[]
}

type MatrixCell = {
  roleId: string
  forumId: string
  headline: string
  groups: { title: string; items: string[]; systems?: string[] }[]
  systems: string[]
  gap: string | null
}

type RoleSummaryMatrixCell = {
  roleId: string
  forumId: string
  purpose: string
  mustDo: string[]
  decisions: string[]
  systems: string[]
  handoffs: string[]
  gap: string | null
}

type ForumSection = {
  forumId: string
  forumName: string
  forumDescription: string
  steps: StepRef[]
}

function nodeMatchesFilters(
  node: { systemIds?: string[] },
  systemIds: string[],
): boolean {
  if (!systemIds.length) return true
  const ids = node.systemIds ?? []
  return ids.some((id) => systemIds.includes(id))
}

function collectStepsForCell(
  processes: Array<{ name: string; flow?: { nodes?: Array<Record<string, unknown>> } }>,
  roleId: string,
  forumId: string,
  systemIds: string[],
  sysName: Map<string, string>,
): StepRef[] {
  const steps: StepRef[] = []
  for (const process of processes) {
    for (const raw of process.flow?.nodes ?? []) {
      const node = raw as {
        roleId?: string | null
        forumId?: string | null
        label?: string
        kind?: string
        description?: string
        systemIds?: string[]
      }
      if (node.roleId !== roleId || node.forumId !== forumId) continue
      if (!nodeMatchesFilters(node, systemIds)) continue
      steps.push({
        label: node.label ?? '',
        kind: node.kind ?? 'process',
        processName: process.name,
        systems: (node.systemIds ?? []).map((id) => sysName.get(id) ?? id).filter(Boolean),
        description: node.description,
      })
    }
  }
  return steps
}

function buildMatrixInputs(
  processes: Array<{ name: string; flow?: { nodes?: Array<Record<string, unknown>> } }>,
  roles: Array<{ id: string; name: string }>,
  forums: Array<{ id: string; name: string; description?: string }>,
  systems: Array<{ id: string; name: string }>,
  filters: Body['filters'],
): CellInput[] {
  const systemIds = filters?.systemIds ?? []
  const roleIds = filters?.roleIds ?? []
  const forumIds = filters?.forumIds ?? []
  const sysName = new Map(systems.map((s) => [s.id, s.name]))
  const visibleRoles = roleIds.length ? roles.filter((r) => roleIds.includes(r.id)) : roles
  const visibleForums = forumIds.length ? forums.filter((f) => forumIds.includes(f.id)) : forums
  const cells: CellInput[] = []

  for (const forum of visibleForums) {
    for (const role of visibleRoles) {
      cells.push({
        roleId: role.id,
        roleName: role.name,
        forumId: forum.id,
        forumName: forum.name,
        forumDescription: forum.description ?? '',
        steps: collectStepsForCell(processes, role.id, forum.id, systemIds, sysName),
      })
    }
  }
  return cells
}

function buildRoleSummaryInput(
  roleId: string,
  processes: Array<{ name: string; flow?: { nodes?: Array<Record<string, unknown>> } }>,
  roles: Array<{ id: string; name: string; description?: string }>,
  forums: Array<{ id: string; name: string; description?: string }>,
  systems: Array<{ id: string; name: string }>,
): { role: Record<string, unknown> | null; forums: ForumSection[] } {
  const role = roles.find((r) => r.id === roleId) ?? null
  const sysName = new Map(systems.map((s) => [s.id, s.name]))
  const forumSections = forums.map((forum) => ({
    forumId: forum.id,
    forumName: forum.name,
    forumDescription: forum.description ?? '',
    steps: collectStepsForCell(processes, roleId, forum.id, [], sysName),
  }))
  return { role: role as Record<string, unknown> | null, forums: forumSections }
}

function cellKey(roleId: string, forumId: string) {
  return `${roleId}::${forumId}`
}

function emptyMatrixCell(input: CellInput): MatrixCell {
  return {
    roleId: input.roleId,
    forumId: input.forumId,
    headline: '',
    groups: [],
    systems: [],
    gap: MATRIX_CELL_NO_DATA,
  }
}

function emptyRoleSummaryCell(input: CellInput): RoleSummaryMatrixCell {
  return {
    roleId: input.roleId,
    forumId: input.forumId,
    purpose: '',
    mustDo: [],
    decisions: [],
    systems: [],
    handoffs: [],
    gap: MATRIX_CELL_NO_DATA,
  }
}

function fallbackMatrixCell(input: CellInput): MatrixCell {
  if (!input.steps.length) {
    return emptyMatrixCell(input)
  }

  const byProcess = new Map<string, StepRef[]>()
  for (const step of input.steps) {
    const list = byProcess.get(step.processName) ?? []
    list.push(step)
    byProcess.set(step.processName, list)
  }

  const groups = [...byProcess.entries()].slice(0, 4).map(([processName, steps]) => ({
    title: processName.length > 28 ? `${processName.slice(0, 28)}…` : processName,
    items: steps.slice(0, 3).map((s) => s.label).filter(Boolean),
    systems: [...new Set(steps.flatMap((s) => s.systems))].slice(0, 3),
  }))

  const allSystems = [...new Set(input.steps.flatMap((s) => s.systems))].slice(0, 4)
  const firstLabel = input.steps[0]?.label ?? 'process steps'

  return {
    roleId: input.roleId,
    forumId: input.forumId,
    headline: `${input.roleName} runs ${input.forumName} — ${firstLabel}`,
    groups,
    systems: allSystems,
    gap: null,
  }
}

function normalizeAiCell(raw: unknown, input: CellInput): MatrixCell | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (c.roleId !== input.roleId || c.forumId !== input.forumId) return null

  const headline = typeof c.headline === 'string' ? c.headline.trim() : ''
  const groupsRaw = Array.isArray(c.groups) ? c.groups : []
  const groups = groupsRaw
    .map((g) => {
      if (!g || typeof g !== 'object') return null
      const gr = g as Record<string, unknown>
      const title = typeof gr.title === 'string' ? gr.title.trim() : ''
      const items = Array.isArray(gr.items)
        ? gr.items.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
        : []
      const systems = Array.isArray(gr.systems)
        ? gr.systems.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        : []
      if (!title && !items.length) return null
      return { title: title || 'Actions', items: items.slice(0, 3), systems: systems.slice(0, 3) }
    })
    .filter((g): g is NonNullable<typeof g> => g != null)

  const systems = Array.isArray(c.systems)
    ? c.systems.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 4)
    : []
  const gap = typeof c.gap === 'string' ? c.gap : c.gap === null ? null : null

  if (!headline && !groups.length && !input.steps.length) {
    return emptyMatrixCell(input)
  }
  if (!headline && !groups.length && input.steps.length) {
    return null
  }

  return {
    roleId: input.roleId,
    forumId: input.forumId,
    headline: headline || `${input.roleName} — ${input.forumName}`,
    groups,
    systems,
    gap,
  }
}

function mergeMatrixCells(expected: CellInput[], aiCells: unknown[]): MatrixCell[] {
  const aiByKey = new Map<string, unknown>()
  for (const raw of aiCells) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as { roleId?: string; forumId?: string }
    if (c.roleId && c.forumId) aiByKey.set(cellKey(c.roleId, c.forumId), raw)
  }

  return expected.map((input) => {
    if (!input.steps.length) return emptyMatrixCell(input)
    const normalized = normalizeAiCell(aiByKey.get(cellKey(input.roleId, input.forumId)), input)
    return normalized ?? fallbackMatrixCell(input)
  })
}

function fallbackRoleSummaryCell(input: CellInput): RoleSummaryMatrixCell {
  if (!input.steps.length) {
    return emptyRoleSummaryCell(input)
  }

  const mustDo = input.steps.filter((s) => s.kind !== 'decision').map((s) => s.label).filter(Boolean)
  const decisions = input.steps.filter((s) => s.kind === 'decision').map((s) => s.label).filter(Boolean)
  const systems = [...new Set(input.steps.flatMap((s) => s.systems))].slice(0, 6)

  return {
    roleId: input.roleId,
    forumId: input.forumId,
    purpose: `${input.roleName} accountable for ${input.forumName} — ${mustDo[0] ?? decisions[0] ?? 'process steps'}`,
    mustDo: mustDo.slice(0, 12),
    decisions: decisions.slice(0, 6),
    systems,
    handoffs: [],
    gap: null,
  }
}

function normalizeRoleSummaryCell(raw: unknown, input: CellInput): RoleSummaryMatrixCell | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (c.roleId !== input.roleId || c.forumId !== input.forumId) return null

  const purpose = typeof c.purpose === 'string' ? c.purpose.trim() : ''
  const mustDo = Array.isArray(c.mustDo)
    ? c.mustDo.filter((i): i is string => typeof i === 'string' && i.trim().length > 0).slice(0, 12)
    : []
  const decisions = Array.isArray(c.decisions)
    ? c.decisions.filter((i): i is string => typeof i === 'string' && i.trim().length > 0).slice(0, 6)
    : []
  const systems = Array.isArray(c.systems)
    ? c.systems.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 6)
    : []
  const handoffs = Array.isArray(c.handoffs)
    ? c.handoffs.filter((i): i is string => typeof i === 'string' && i.trim().length > 0).slice(0, 5)
    : []
  const gap = typeof c.gap === 'string' ? c.gap : c.gap === null ? null : null

  if (!purpose && !mustDo.length && !input.steps.length) {
    return emptyRoleSummaryCell(input)
  }
  if (!purpose && !mustDo.length && input.steps.length) {
    return null
  }

  return {
    roleId: input.roleId,
    forumId: input.forumId,
    purpose: purpose || `${input.roleName} — ${input.forumName}`,
    mustDo,
    decisions,
    systems,
    handoffs,
    gap,
  }
}

function mergeRoleSummaryCells(expected: CellInput[], aiCells: unknown[]): RoleSummaryMatrixCell[] {
  const aiByKey = new Map<string, unknown>()
  for (const raw of aiCells) {
    if (!raw || typeof raw !== 'object') continue
    const c = raw as { roleId?: string; forumId?: string }
    if (c.roleId && c.forumId) aiByKey.set(cellKey(c.roleId, c.forumId), raw)
  }

  return expected.map((input) => {
    if (!input.steps.length) return emptyRoleSummaryCell(input)
    const normalized = normalizeRoleSummaryCell(aiByKey.get(cellKey(input.roleId, input.forumId)), input)
    return normalized ?? fallbackRoleSummaryCell(input)
  })
}

function parseMatrixJson(raw: string): { cells: unknown[] } | null {
  try {
    const parsed = JSON.parse(raw) as { cells?: unknown[] }
    if (!parsed || !Array.isArray(parsed.cells)) return null
    return parsed
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { cells?: unknown[] }
      if (!parsed || !Array.isArray(parsed.cells)) return null
      return parsed
    } catch {
      return null
    }
  }
}

async function callOpenAi(
  openaiKey: string,
  model: string,
  systemContent: string,
  userContent: string,
  maxTokens: number,
  useJson: boolean,
): Promise<string> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
      ...(useJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  const json = await resp.json()
  if (!resp.ok) {
    throw new Error(json?.error?.message ?? 'OpenAI error')
  }
  return json.choices?.[0]?.message?.content ?? ''
}

async function generateMatrixBatch(
  openaiKey: string,
  batch: CellInput[],
  forumName: string,
): Promise<unknown[]> {
  const userPrompt = `${MATRIX_RULES}

JSON schema:
${MATRIX_JSON_SCHEMA}

Task: Simplify process blocks for each role in forum "${forumName}". Return ALL ${batch.length} cells.

CELLS_INPUT:
${JSON.stringify(batch)}`

  const answer = await callOpenAi(
    openaiKey,
    FAST_MODEL,
    `${SYSTEM}\n\n${MATRIX_RULES}`,
    userPrompt,
    Math.min(4096, 400 + batch.length * 280),
    true,
  )

  const parsed = parseMatrixJson(answer)
  if (parsed?.cells?.length) return parsed.cells

  const retryPrompt = `${MATRIX_RULES}

Return JSON with "cells" array of exactly ${batch.length} items. Keep each cell compact (1 headline, 1-2 groups, max 2 items each).

CELLS_INPUT:
${JSON.stringify(batch)}`

  const retryAnswer = await callOpenAi(
    openaiKey,
    FAST_MODEL,
    `${SYSTEM}\n\n${MATRIX_RULES}`,
    retryPrompt,
    Math.min(4096, 400 + batch.length * 280),
    true,
  )
  const retryParsed = parseMatrixJson(retryAnswer)
  return retryParsed?.cells ?? []
}

async function generateRoleSummaryBatch(
  openaiKey: string,
  batch: CellInput[],
  forumName: string,
): Promise<unknown[]> {
  const userPrompt = `${ROLE_SUMMARY_MATRIX_RULES}

JSON schema:
${ROLE_SUMMARY_JSON_SCHEMA}

Task: Summarise what each role must do in forum "${forumName}". Return ALL ${batch.length} cells with full mustDo lists.

CELLS_INPUT:
${JSON.stringify(batch)}`

  const answer = await callOpenAi(
    openaiKey,
    FAST_MODEL,
    `${SYSTEM}\n\n${ROLE_SUMMARY_MATRIX_RULES}`,
    userPrompt,
    Math.min(4096, 500 + batch.length * 350),
    true,
  )

  const parsed = parseMatrixJson(answer)
  if (parsed?.cells?.length) return parsed.cells

  const retryPrompt = `${ROLE_SUMMARY_MATRIX_RULES}

Return JSON with "cells" array of exactly ${batch.length} items. Every cell needs purpose + mustDo (cover all steps).

CELLS_INPUT:
${JSON.stringify(batch)}`

  const retryAnswer = await callOpenAi(
    openaiKey,
    FAST_MODEL,
    `${SYSTEM}\n\n${ROLE_SUMMARY_MATRIX_RULES}`,
    retryPrompt,
    Math.min(4096, 500 + batch.length * 350),
    true,
  )
  const retryParsed = parseMatrixJson(retryAnswer)
  return retryParsed?.cells ?? []
}

async function generateMatrixCells(openaiKey: string, cellInputs: CellInput[]): Promise<MatrixCell[]> {
  if (!cellInputs.length) return []

  const byForum = new Map<string, CellInput[]>()
  for (const cell of cellInputs) {
    const list = byForum.get(cell.forumId) ?? []
    list.push(cell)
    byForum.set(cell.forumId, list)
  }

  const aiCells: unknown[] = []
  const results = await Promise.all(
    [...byForum.entries()].map(async ([forumId, batch]) => {
      const forumName = batch[0]?.forumName ?? forumId
      try {
        return await generateMatrixBatch(openaiKey, batch, forumName)
      } catch {
        return []
      }
    }),
  )

  for (const batchCells of results) {
    aiCells.push(...batchCells)
  }

  return mergeMatrixCells(cellInputs, aiCells)
}

async function generateRoleSummaryCells(
  openaiKey: string,
  cellInputs: CellInput[],
): Promise<RoleSummaryMatrixCell[]> {
  if (!cellInputs.length) return []

  const byForum = new Map<string, CellInput[]>()
  for (const cell of cellInputs) {
    const list = byForum.get(cell.forumId) ?? []
    list.push(cell)
    byForum.set(cell.forumId, list)
  }

  const aiCells: unknown[] = []
  const results = await Promise.all(
    [...byForum.entries()].map(async ([forumId, batch]) => {
      const forumName = batch[0]?.forumName ?? forumId
      try {
        return await generateRoleSummaryBatch(openaiKey, batch, forumName)
      } catch {
        return []
      }
    }),
  )

  for (const batchCells of results) {
    aiCells.push(...batchCells)
  }

  return mergeRoleSummaryCells(cellInputs, aiCells)
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

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured on bms-brain-ai function.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'matrix' || mode === 'matrixAi') {
      const cellInputs = buildMatrixInputs(
        processes ?? [],
        roles ?? [],
        forums ?? [],
        systems ?? [],
        body.filters,
      )
      const cells = await generateMatrixCells(openaiKey, cellInputs)
      return new Response(JSON.stringify({ matrix: { cells } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'roleSummaries') {
      const cellInputs = buildMatrixInputs(
        processes ?? [],
        roles ?? [],
        forums ?? [],
        systems ?? [],
        body.filters,
      )
      const cells = await generateRoleSummaryCells(openaiKey, cellInputs)
      return new Response(JSON.stringify({ roleSummaries: { cells } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let userPrompt = ''
    let maxTokens = 550
    let model = MODEL

    if (mode === 'role') {
      const { role, forums: forumSections } = buildRoleSummaryInput(
        body.roleId ?? '',
        processes ?? [],
        roles ?? [],
        forums ?? [],
        systems ?? [],
      )
      userPrompt = `${ROLE_TEMPLATE}

Task: Summarise this role. Cover EVERY forum in FORUMS_INPUT — do not stop after the first forum.

ROLE:
${JSON.stringify(role)}

FORUMS_INPUT (${forumSections.length} forums — all required):
${JSON.stringify(forumSections)}`
      maxTokens = 1600
      model = FAST_MODEL
    } else if (mode === 'system') {
      const system = (systems ?? []).find((s) => s.id === body.systemId)
      userPrompt = `${SYSTEM_TEMPLATE}\n\nTask: Summarise this system/tool using only matching steps from published processes.\n\nSystem focus: ${JSON.stringify(system ?? null)}`
      maxTokens = 900
      model = FAST_MODEL
    } else {
      userPrompt = `${KNOWLEDGE_TEMPLATE}\n\nTask: Answer the question using only published catalog and process data.\n\nQuestion: ${(body.question ?? '').slice(0, 4000)}`
    }

    const answer = await callOpenAi(
      openaiKey,
      model,
      SYSTEM,
      `BMS_BRAIN_CONTEXT:\n${JSON.stringify(context).slice(0, 90_000)}\n\n${userPrompt}`,
      maxTokens,
      false,
    )

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
