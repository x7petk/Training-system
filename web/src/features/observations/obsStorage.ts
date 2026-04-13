import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'observation_assets'

/** Returns a time-limited URL for a stored object path, or null if empty / error. */
export async function obsSignedImageUrl(supabase: SupabaseClient, path: string | null | undefined) {
  const p = path?.trim()
  if (!p) return null
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(p, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export function obsStorageBucket() {
  return BUCKET
}
