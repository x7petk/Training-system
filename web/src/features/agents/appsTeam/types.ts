export type AppsTeamAgentRole = 'pm' | 'designer' | 'developer' | 'tester' | 'devops'
export type AppsTeamMessageRole = AppsTeamAgentRole | 'customer' | 'system'

export type AppsTeamTicketStatus =
  | 'intake'
  | 'design'
  | 'pm_review_design'
  | 'build'
  | 'clarify'
  | 'test'
  | 'deploy'
  | 'done'
  | 'blocked'

export type AppsTeamTicketDraft = {
  title: string
  description: string
  valueProposition: string
  requirements: string[]
  acceptanceCriteria: string[]
}

export type AppsTeamDesignBrief = {
  summary?: string
  layout?: string
  components?: string[]
  interactionFlow?: string[]
  clickBudget?: string
  alignmentNotes?: string
  openQuestions?: string[]
}

export type AppsTeamArtifacts = {
  prUrl?: string
  branch?: string
  buildSummary?: string
  deploySummary?: string
  productionUrl?: string
  developerAgentId?: string
  developerRunId?: string
  deployAgentId?: string
  deployRunId?: string
  deployUrl?: string
  [key: string]: unknown
}

export type AppsTeamTicket = {
  id: string
  user_id: string
  title: string
  status: AppsTeamTicketStatus
  description: string
  value_proposition: string
  requirements: string[]
  acceptance_criteria: string[]
  design_brief: AppsTeamDesignBrief | null
  artifacts: AppsTeamArtifacts
  active_agent: AppsTeamAgentRole | null
  cursor_agent_id: string | null
  cursor_run_id: string | null
  cursor_url: string | null
  created_at: string
  updated_at: string
}

export type AppsTeamMessage = {
  id: string
  user_id: string
  ticket_id: string | null
  from_role: AppsTeamMessageRole
  to_role: AppsTeamMessageRole | null
  body: string
  meta: Record<string, unknown>
  created_at: string
}

export type AppsTeamEvent = {
  id: string
  user_id: string
  ticket_id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  actor_role: string | null
  summary: string
  detail: Record<string, unknown>
  created_at: string
}

export type AppsTeamChatTurn = { role: 'user' | 'assistant'; content: string }

export type AppsTeamOrchestrationMessage = {
  fromRole: AppsTeamMessageRole
  toRole?: AppsTeamMessageRole | null
  body: string
  meta?: Record<string, unknown>
}

export type AppsTeamOrchestrationEvent = {
  eventType: string
  actorRole?: string | null
  summary: string
  detail?: Record<string, unknown>
}

export type AppsTeamChatResponse = {
  action: 'chat'
  model?: string
  reply: string
  readyForTicket: boolean
  needsCustomerInput?: boolean
  openQuestions: string[]
  ticket: AppsTeamTicketDraft | null
}

export type AppsTeamAdvanceResponse = {
  action: 'advance' | 'sync'
  fromStatus: AppsTeamTicketStatus
  toStatus: AppsTeamTicketStatus
  activeAgent?: AppsTeamAgentRole | null
  designBrief?: AppsTeamDesignBrief
  testReport?: Record<string, unknown>
  cursor?: { agentId: string; runId: string; url: string }
  artifactsPatch?: AppsTeamArtifacts
  clearCursor?: boolean
  deferToSync?: boolean
  runStatus?: string
  needsCustomerInput?: boolean
  notifyCustomer?: boolean
  customerNote?: string
  messages: AppsTeamOrchestrationMessage[]
  events: AppsTeamOrchestrationEvent[]
}

export const KANBAN_COLUMNS: Array<{
  id: AppsTeamTicketStatus
  label: string
}> = [
  { id: 'intake', label: 'Intake' },
  { id: 'design', label: 'Design' },
  { id: 'pm_review_design', label: 'PM review' },
  { id: 'build', label: 'Build' },
  { id: 'clarify', label: 'Clarify' },
  { id: 'test', label: 'Test' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'done', label: 'Done' },
  { id: 'blocked', label: 'Blocked' },
]

export const AGENT_LABELS: Record<AppsTeamAgentRole, string> = {
  pm: 'Product Manager',
  designer: 'Designer',
  developer: 'Developer',
  tester: 'Tester',
  devops: 'DevOps',
}

export function ticketToSnapshot(t: AppsTeamTicket) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    description: t.description,
    valueProposition: t.value_proposition,
    requirements: t.requirements,
    acceptanceCriteria: t.acceptance_criteria,
    designBrief: t.design_brief,
    artifacts: t.artifacts,
    activeAgent: t.active_agent,
    cursorAgentId: t.cursor_agent_id,
    cursorRunId: t.cursor_run_id,
    cursorUrl: t.cursor_url,
  }
}
