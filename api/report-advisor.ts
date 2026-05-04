import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Same-origin proxy to Supabase Edge Function `matrix-report-advisor`.
 * Avoids browser cross-origin / CORS / mixed-network issues when calling
 * `https://<project>.supabase.co/functions/v1/...` directly from the SPA.
 *
 * Requires Vercel env (same as the web app): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  }

  if (req.method === 'OPTIONS') {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const base =
    (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!base || !anon) {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    return res.status(500).json({
      error:
        'Advisor proxy misconfigured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on Vercel (Project Settings → Environment Variables).',
    })
  }

  const auth = req.headers.authorization
  if (!auth) {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    return res.status(401).json({ error: 'Missing authorization' })
  }

  const target = `${base}/functions/v1/matrix-report-advisor`
  const body =
    typeof req.body === 'string' ? req.body : req.body != null ? JSON.stringify(req.body) : '{}'

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: auth,
      },
      body,
    })
  } catch (e) {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(502).json({
      error: `Advisor proxy could not reach Supabase Edge Function at ${target}. Deploy function matrix-report-advisor and check project URL. Details: ${msg}`,
    })
  }

  const text = await upstream.text()
  const ct = upstream.headers.get('content-type') || 'application/json'
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
  res.setHeader('Content-Type', ct)
  return res.status(upstream.status).send(text)
}
