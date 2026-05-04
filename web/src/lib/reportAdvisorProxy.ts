/**
 * Calls the report advisor through same-origin `POST /api/report-advisor`:
 * - **Vite dev / preview**: proxied in vite.config.ts → Supabase `functions/v1/matrix-report-advisor`
 * - **Vercel production**: `api/report-advisor.ts` forwards to that URL with `apikey` + user JWT
 *
 * This avoids browser cross-origin `Failed to fetch` to `*.supabase.co/functions`.
 */

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
        errorMessage: `Advisor returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
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
