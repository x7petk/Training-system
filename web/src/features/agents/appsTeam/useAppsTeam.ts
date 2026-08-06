import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import type {
  AppsTeamAdvanceResponse,
  AppsTeamArtifacts,
  AppsTeamDesignBrief,
  AppsTeamEvent,
  AppsTeamMessage,
  AppsTeamMessageRole,
  AppsTeamTicket,
  AppsTeamTicketDraft,
  AppsTeamTicketStatus,
} from './types'

type DbTicket = {
  id: string
  user_id: string
  title: string
  status: AppsTeamTicketStatus
  description: string
  value_proposition: string
  requirements: unknown
  acceptance_criteria: unknown
  design_brief: unknown
  artifacts: unknown
  active_agent: AppsTeamTicket['active_agent']
  cursor_agent_id: string | null
  cursor_run_id: string | null
  cursor_url: string | null
  created_at: string
  updated_at: string
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
}

function normalizeTicket(row: DbTicket): AppsTeamTicket {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    status: row.status,
    description: row.description ?? '',
    value_proposition: row.value_proposition ?? '',
    requirements: asStringArray(row.requirements),
    acceptance_criteria: asStringArray(row.acceptance_criteria),
    design_brief: (row.design_brief as AppsTeamDesignBrief | null) ?? null,
    artifacts: (row.artifacts as AppsTeamArtifacts) ?? {},
    active_agent: row.active_agent,
    cursor_agent_id: row.cursor_agent_id,
    cursor_run_id: row.cursor_run_id,
    cursor_url: row.cursor_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function useAppsTeam() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<AppsTeamTicket[]>([])
  const [messages, setMessages] = useState<AppsTeamMessage[]>([])
  const [events, setEvents] = useState<AppsTeamEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setTickets([])
      setMessages([])
      setEvents([])
      return
    }
    setLoading(true)
    setError(null)
    const [tRes, mRes, eRes] = await Promise.all([
      supabase
        .from('apps_team_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('apps_team_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(800),
      supabase
        .from('apps_team_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    setLoading(false)
    if (tRes.error || mRes.error || eRes.error) {
      setError(tRes.error?.message || mRes.error?.message || eRes.error?.message || 'Load failed')
      return
    }
    setTickets(((tRes.data as DbTicket[]) ?? []).map(normalizeTicket))
    setMessages((mRes.data as AppsTeamMessage[]) ?? [])
    setEvents((eRes.data as AppsTeamEvent[]) ?? [])
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const addMessage = useCallback(
    async (input: {
      ticket_id?: string | null
      from_role: AppsTeamMessageRole
      to_role?: AppsTeamMessageRole | null
      body: string
      meta?: Record<string, unknown>
    }): Promise<AppsTeamMessage | null> => {
      if (!user) return null
      const { data, error: err } = await supabase
        .from('apps_team_messages')
        .insert({
          user_id: user.id,
          ticket_id: input.ticket_id ?? null,
          from_role: input.from_role,
          to_role: input.to_role ?? null,
          body: input.body,
          meta: input.meta ?? {},
        })
        .select('*')
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      const row = data as AppsTeamMessage
      setMessages((prev) => [...prev, row])
      return row
    },
    [user],
  )

  const createTicketFromDraft = useCallback(
    async (draft: AppsTeamTicketDraft): Promise<AppsTeamTicket | null> => {
      if (!user) return null
      const { data, error: err } = await supabase
        .from('apps_team_tickets')
        .insert({
          user_id: user.id,
          title: draft.title,
          status: 'design',
          description: draft.description,
          value_proposition: draft.valueProposition,
          requirements: draft.requirements,
          acceptance_criteria: draft.acceptanceCriteria,
          active_agent: 'designer',
          artifacts: {},
        })
        .select('*')
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      const ticket = normalizeTicket(data as DbTicket)
      setTickets((prev) => [ticket, ...prev])
      await supabase.from('apps_team_events').insert({
        user_id: user.id,
        ticket_id: ticket.id,
        event_type: 'created',
        from_status: 'intake',
        to_status: 'design',
        actor_role: 'pm',
        summary: 'PM created ticket and handed to Designer',
        detail: { title: ticket.title },
      })
      await addMessage({
        ticket_id: ticket.id,
        from_role: 'pm',
        to_role: 'designer',
        body: `New ticket ready for design:\n${ticket.title}\n\n${ticket.description}`,
      })
      await load()
      return ticket
    },
    [user, addMessage, load],
  )

  const applyOrchestration = useCallback(
    async (ticket: AppsTeamTicket, result: AppsTeamAdvanceResponse): Promise<AppsTeamTicket | null> => {
      if (!user) return null

      const artifacts: AppsTeamArtifacts = {
        ...ticket.artifacts,
        ...(result.artifactsPatch ?? {}),
      }

      const patch: Record<string, unknown> = {
        status: result.toStatus,
        active_agent: result.activeAgent ?? null,
        artifacts,
      }
      if (result.designBrief) patch.design_brief = result.designBrief
      if (result.clearCursor) {
        patch.cursor_agent_id = null
        patch.cursor_run_id = null
        patch.cursor_url = null
      }
      if (result.cursor) {
        patch.cursor_agent_id = result.cursor.agentId
        patch.cursor_run_id = result.cursor.runId
        patch.cursor_url = result.cursor.url
      }
      if (result.testReport) {
        artifacts.testReport = result.testReport
        patch.artifacts = artifacts
      }

      const { data, error: err } = await supabase
        .from('apps_team_tickets')
        .update(patch)
        .eq('id', ticket.id)
        .eq('user_id', user.id)
        .select('*')
        .single()
      if (err) {
        setError(err.message)
        return null
      }

      for (const msg of result.messages ?? []) {
        const isCustomerFacing = msg.toRole === 'customer'
        if (isCustomerFacing && !(result.notifyCustomer || result.needsCustomerInput)) {
          // Internal only — do not surface in customer chat.
          continue
        }
        await supabase.from('apps_team_messages').insert({
          user_id: user.id,
          ticket_id: isCustomerFacing ? null : ticket.id,
          from_role: msg.fromRole,
          to_role: msg.toRole ?? null,
          body: msg.body,
          meta: {
            ...(msg.meta ?? {}),
            ...(isCustomerFacing
              ? {
                  kind: result.needsCustomerInput ? 'customer_question' : 'milestone',
                  ticket_id: ticket.id,
                }
              : {}),
          },
        })
      }

      for (const ev of result.events ?? []) {
        await supabase.from('apps_team_events').insert({
          user_id: user.id,
          ticket_id: ticket.id,
          event_type: ev.eventType,
          from_status: result.fromStatus,
          to_status: result.toStatus,
          actor_role: ev.actorRole ?? null,
          summary: ev.summary,
          detail: ev.detail ?? {},
        })
      }

      if (
        (result.notifyCustomer || result.needsCustomerInput) &&
        result.customerNote &&
        !(result.messages ?? []).some((m) => m.toRole === 'customer')
      ) {
        await supabase.from('apps_team_messages').insert({
          user_id: user.id,
          ticket_id: null,
          from_role: 'pm',
          to_role: 'customer',
          body: result.customerNote,
          meta: {
            kind: result.needsCustomerInput ? 'customer_question' : 'milestone',
            ticket_id: ticket.id,
          },
        })
      }

      await load()
      return normalizeTicket(data as DbTicket)
    },
    [user, load],
  )

  const deleteTicket = useCallback(
    async (id: string) => {
      if (!user) return
      const { error: err } = await supabase
        .from('apps_team_tickets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (err) {
        setError(err.message)
        return
      }
      setTickets((prev) => prev.filter((t) => t.id !== id))
      setMessages((prev) => prev.filter((m) => m.ticket_id !== id))
      setEvents((prev) => prev.filter((e) => e.ticket_id !== id))
    },
    [user],
  )

  return {
    tickets,
    messages,
    events,
    loading,
    error,
    load,
    addMessage,
    createTicketFromDraft,
    applyOrchestration,
    deleteTicket,
  }
}
