import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabaseConfigured = Boolean(url && anonKey)

/** Host ref from `https://<ref>.supabase.co` (for dev hints). */
export function supabaseProjectRefFromUrl(s: string): string | null {
  if (!s.trim()) return null
  try {
    const u = new URL(s)
    const m = u.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

export const supabaseProjectRef = supabaseProjectRefFromUrl(url)

/** Browser client; auth and queries no-op safely only if misconfigured (UI shows setup hint). */
export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
