/**
 * Production sites call the advisor through a same-origin Vercel route (`/api/report-advisor`)
 * so the browser never blocks cross-origin requests to `*.supabase.co/functions/v1`.
 */

export function shouldUseReportAdvisorProxy(): boolean {
  if (import.meta.env.VITE_ADVISOR_PROXY === 'false') return false
  if (import.meta.env.VITE_ADVISOR_PROXY === 'true') return true
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h !== 'localhost' && h !== '127.0.0.1'
}

export async function invokeReportAdvisorViaProxy(
  accessToken: string,
  body: { messages: unknown; context: unknown },
): Promise<{
  data: { content?: string; error?: string; detail?: string } | null
  errorMessage: string | null
}> {
  try {
    const res = await fetch('/api/report-advisor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed: { content?: string; error?: string; detail?: string }
    try {
      parsed = JSON.parse(text) as typeof parsed
    } catch {
      return {
        data: null,
        errorMessage: `Advisor proxy returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
      }
    }
    if (!res.ok) {
      const msg = parsed.detail ? `${parsed.error ?? 'Error'}: ${parsed.detail}` : (parsed.error ?? `HTTP ${res.status}`)
      return { data: parsed, errorMessage: msg }
    }
    return { data: parsed, errorMessage: null }
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}
