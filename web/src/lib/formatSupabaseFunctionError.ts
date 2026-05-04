import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'

/**
 * Turns supabase.functions.invoke errors into actionable UI text.
 */
export async function formatSupabaseFunctionError(err: unknown): Promise<string> {
  if (!err || typeof err !== 'object') return String(err)

  if (err instanceof FunctionsFetchError) {
    const c = err.context
    if (c instanceof TypeError && c.message.includes('fetch')) {
      return `${err.message} (${c.message}). Check that this app’s Supabase URL matches the project where \`matrix-report-advisor\` is deployed, that you are online, and that a browser extension or network policy is not blocking requests to \`/functions/v1/\`.`
    }
    if (c instanceof Error) {
      return `${err.message}: ${c.message}`
    }
    if (typeof c === 'string' && c.trim()) {
      return `${err.message}: ${c}`
    }
    return `${err.message} The request did not reach Supabase (no HTTP response). Deploy the Edge Function \`matrix-report-advisor\` to this project or run \`supabase functions serve\` locally.`
  }

  if (err instanceof FunctionsHttpError) {
    const res = err.context as Response | undefined
    if (res && typeof res.text === 'function') {
      const body = (await res.text().catch(() => '')).trim().slice(0, 500)
      const line = body ? ` ${body}` : ''
      return `Edge Function HTTP ${res.status}:${line}`
    }
    return err.message
  }

  const e = err as { message?: string }
  return e.message ?? String(err)
}
