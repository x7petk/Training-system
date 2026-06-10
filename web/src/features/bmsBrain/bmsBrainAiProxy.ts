import { formatSupabaseFunctionError } from '../../lib/formatSupabaseFunctionError'
import { supabase } from '../../lib/supabase'

export type BmsAiMode = 'role' | 'system' | 'knowledge' | 'matrix' | 'matrixAi' | 'roleSummaries'

export type BmsAiRequest = {
  mode: BmsAiMode
  question?: string
  roleId?: string | null
  systemId?: string | null
  filters?: {
    systemIds?: string[]
    roleIds?: string[]
    forumIds?: string[]
  }
}

export type BmsAiResponse = {
  answer?: string
  matrix?: import('./roleForumMatrixTypes').RoleForumMatrixResponse
  roleSummaries?: import('./roleSummaryMatrixTypes').RoleSummaryMatrixResponse
  sources?: string[]
}

export async function callBmsBrainAi(body: BmsAiRequest): Promise<BmsAiResponse> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sign in required')

  const res = await fetch('/api/bms-brain-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as BmsAiResponse & { error?: string }
  if (!res.ok) throw new Error(await formatSupabaseFunctionError(json.error ?? res.statusText))
  return json
}
