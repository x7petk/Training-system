import type { UxUiExpertRequest, UxUiExpertResult } from '../features/agents/uxUiExpertTypes'

export async function invokeUxUiExpertViaProxy(
  accessToken: string,
  body: UxUiExpertRequest,
): Promise<{ data: UxUiExpertResult | null; errorMessage: string | null }> {
  try {
    const res = await fetch('/api/ux-ui-expert', {
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
        errorMessage: `UX/UI expert returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
      }
    }
    if (!res.ok) {
      const errObj = parsed as { error?: string; detail?: string }
      const msg = errObj.detail ? `${errObj.error ?? 'Error'}: ${errObj.detail}` : (errObj.error ?? `HTTP ${res.status}`)
      return { data: null, errorMessage: msg }
    }
    return { data: parsed as UxUiExpertResult, errorMessage: null }
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}
