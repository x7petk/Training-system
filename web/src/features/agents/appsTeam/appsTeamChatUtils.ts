import type { AppsTeamMessage } from './types'

export function isCustomerChatMessage(m: AppsTeamMessage): boolean {
  if (m.from_role === 'customer') return true
  if (m.from_role === 'pm' && (m.to_role === 'customer' || m.to_role == null)) {
    const kind = typeof m.meta?.kind === 'string' ? m.meta.kind : ''
    return kind === 'chat' || kind === 'customer_question' || kind === 'milestone' || kind === 'done' || !kind
  }
  return false
}

export function messageBelongsToTicket(m: AppsTeamMessage, ticketId: string): boolean {
  if (!isCustomerChatMessage(m)) return false
  if (m.ticket_id === ticketId) return true
  const metaTicketId = typeof m.meta?.ticket_id === 'string' ? m.meta.ticket_id : null
  return metaTicketId === ticketId
}

export function filterTicketChatMessages(messages: AppsTeamMessage[], ticketId: string): AppsTeamMessage[] {
  return messages.filter((m) => messageBelongsToTicket(m, ticketId))
}
