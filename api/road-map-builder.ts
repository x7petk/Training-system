import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Same-origin proxy to Supabase Edge Function `road-map-builder`.
 * Dev uses Vite proxy; production uses this Vercel route.
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

  const base = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!base || !anon) {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    return res.status(500).json({
      error:
        'Road Map Builder proxy misconfigured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on Vercel.',
    })
  }

  const auth = req.headers.authorization
  if (!auth) {
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    return res.status(401).json({ error: 'Missing authorization' })
  }

  const target = `${base}/functions/v1/road-map-builder`
  const body = typeof req.body === 'string' ? req.body : req.body != null ? JSON.stringify(req.body) : '{}'

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
      error: `Road Map Builder proxy could not reach Supabase Edge Function at ${target}. Details: ${msg}`,
    })
  }

  const text = await upstream.text()
  const ct = upstream.headers.get('content-type') || 'application/json'
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
  res.setHeader('Content-Type', ct)
  return res.status(upstream.status).send(text)
}
