import type {
  AppsTeamAdvanceResponse,
  AppsTeamChatResponse,
  AppsTeamChatTurn,
  AppsTeamTicket,
} from '../features/agents/appsTeam/types'
import { ticketToSnapshot } from '../features/agents/appsTeam/types'

async function postAppsTeam(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ data: unknown | null; errorMessage: string | null }> {
  try {
    const res = await fetch('/api/apps-team', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      return {
        data: null,
        errorMessage: `Apps Team returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
      }
    }
    if (!res.ok) {
      const errObj = parsed as { error?: string; detail?: string }
      const msg = errObj.detail
        ? `${errObj.error ?? 'Error'}: ${errObj.detail}`
        : (errObj.error ?? `HTTP ${res.status}`)
      return { data: null, errorMessage: msg }
    }
    return { data: parsed, errorMessage: null }
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function invokeAppsTeamChat(
  accessToken: string,
  messages: AppsTeamChatTurn[],
  ticket?: AppsTeamTicket | null,
): Promise<{ data: AppsTeamChatResponse | null; errorMessage: string | null }> {
  const { data, errorMessage } = await postAppsTeam(accessToken, {
    action: 'chat',
    messages,
    ...(ticket ? { ticket: ticketToSnapshot(ticket) } : {}),
  })
  if (errorMessage) return { data: null, errorMessage }
  return { data: data as AppsTeamChatResponse, errorMessage: null }
}

export async function invokeAppsTeamAdvance(
  accessToken: string,
  ticket: AppsTeamTicket,
  customerNote?: string,
): Promise<{ data: AppsTeamAdvanceResponse | null; errorMessage: string | null }> {
  const { data, errorMessage } = await postAppsTeam(accessToken, {
    action: 'advance',
    ticket: ticketToSnapshot(ticket),
    ...(customerNote ? { customerNote } : {}),
  })
  if (errorMessage) return { data: null, errorMessage }
  return { data: data as AppsTeamAdvanceResponse, errorMessage: null }
}

export async function invokeAppsTeamSync(
  accessToken: string,
  ticket: AppsTeamTicket,
): Promise<{ data: AppsTeamAdvanceResponse | null; errorMessage: string | null }> {
  const { data, errorMessage } = await postAppsTeam(accessToken, {
    action: 'sync',
    ticket: ticketToSnapshot(ticket),
  })
  if (errorMessage) return { data: null, errorMessage }
  return { data: data as AppsTeamAdvanceResponse, errorMessage: null }
}
