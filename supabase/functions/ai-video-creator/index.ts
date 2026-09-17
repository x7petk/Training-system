import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

const BUCKET = 'ai-video-creator'
const MODEL = Deno.env.get('SORA_MODEL') || 'sora-2'
const ALLOWED_SECONDS = new Set(['4', '8', '12'])
const ALLOWED_SIZES = new Set(['1280x720', '720x1280', '1792x1024', '1024x1792'])

type JobRow = {
  id: string
  user_id: string
  title: string
  prompt: string
  seconds: string
  size: string
  status: string
  progress: number
  openai_video_id: string | null
  image_path: string | null
  video_path: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

type OpenAiVideo = {
  id?: string
  status?: string
  progress?: number
  error?: { message?: string; code?: string } | string | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sanitize(v: unknown, max = 4_000): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function titleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  if (compact.length <= 72) return compact || 'Untitled video'
  return `${compact.slice(0, 69).trim()}…`
}

function openaiErrorMessage(payload: OpenAiVideo, fallback: string): string {
  const err = payload.error
  if (typeof err === 'string' && err.trim()) return err.trim()
  if (err && typeof err === 'object' && typeof err.message === 'string' && err.message.trim()) {
    return err.message.trim()
  }
  return fallback
}

async function readOpenAiError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string }
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim()
    if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
      return parsed.error.message
    }
  } catch {
    /* ignore */
  }
  return text.trim().slice(0, 400) || `OpenAI HTTP ${res.status}`
}

async function openaiJson(path: string, apiKey: string, init?: RequestInit): Promise<{
  ok: boolean
  status: number
  payload: OpenAiVideo
  raw: string
}> {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  })
  const raw = await res.text()
  let payload: OpenAiVideo = {}
  try {
    payload = JSON.parse(raw) as OpenAiVideo
  } catch {
    payload = { error: raw.slice(0, 400) }
  }
  return { ok: res.ok, status: res.status, payload, raw }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return json(
        {
          error:
            'AI Video Creator is not configured. Set the OPENAI_API_KEY secret on the ai-video-creator Edge Function.',
        },
        503,
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userData.user.id

    const body = (await req.json()) as {
      action?: string
      id?: string
      prompt?: string
      seconds?: string
      size?: string
      imagePath?: string
    }
    const action = sanitize(body.action, 40) || 'create'

    if (action === 'create') {
      const id = sanitize(body.id, 80)
      const prompt = sanitize(body.prompt, 4_000)
      const seconds = sanitize(body.seconds, 8)
      const size = sanitize(body.size, 20)
      const imagePath = sanitize(body.imagePath, 240)

      if (!isUuid(id)) return json({ error: 'A valid job id is required.' }, 400)
      if (!prompt) return json({ error: 'Describe the video you want.' }, 400)
      if (!ALLOWED_SECONDS.has(seconds)) return json({ error: 'Duration must be 4, 8, or 12 seconds.' }, 400)
      if (!ALLOWED_SIZES.has(size)) return json({ error: 'Choose a supported video size.' }, 400)
      if (!imagePath.startsWith(`${userId}/`) || !imagePath.endsWith('/source.jpg')) {
        return json({ error: 'Image path is invalid for this user.' }, 400)
      }

      const { data: existing } = await supabase
        .from('ai_video_jobs')
        .select(
          'id, user_id, title, prompt, seconds, size, status, progress, openai_video_id, image_path, video_path, error_message, created_at, updated_at',
        )
        .eq('id', id)
        .maybeSingle()
      if (existing) return json({ job: existing as JobRow })

      const { data: imageBlob, error: dlErr } = await supabase.storage.from(BUCKET).download(imagePath)
      if (dlErr || !imageBlob) {
        return json({ error: dlErr?.message || 'Could not read the uploaded picture.' }, 400)
      }

      const imageBytes = new Uint8Array(await imageBlob.arrayBuffer())
      const form = new FormData()
      form.append('model', MODEL)
      form.append('prompt', prompt)
      form.append('seconds', seconds)
      form.append('size', size)
      form.append('input_reference', new Blob([imageBytes], { type: 'image/jpeg' }), 'frame.jpg')

      const created = await fetch('https://api.openai.com/v1/videos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      })
      if (!created.ok) {
        const detail = await readOpenAiError(created)
        const failedRow = {
          id,
          user_id: userId,
          title: titleFromPrompt(prompt),
          prompt,
          seconds,
          size,
          status: 'failed',
          progress: 0,
          openai_video_id: null,
          image_path: imagePath,
          video_path: null,
          error_message: detail,
        }
        const { data: inserted, error: insertErr } = await supabase
          .from('ai_video_jobs')
          .insert(failedRow)
          .select(
            'id, user_id, title, prompt, seconds, size, status, progress, openai_video_id, image_path, video_path, error_message, created_at, updated_at',
          )
          .single()
        if (insertErr) return json({ error: `${detail} (also could not save history: ${insertErr.message})` }, 502)
        return json({ job: inserted as JobRow, error: detail }, 502)
      }

      const video = (await created.json()) as OpenAiVideo
      const openaiId = sanitize(video.id, 120)
      if (!openaiId) return json({ error: 'Sora did not return a video job id.' }, 502)

      const status = video.status === 'in_progress' || video.status === 'completed' ? video.status : 'queued'
      const { data: inserted, error: insertErr } = await supabase
        .from('ai_video_jobs')
        .insert({
          id,
          user_id: userId,
          title: titleFromPrompt(prompt),
          prompt,
          seconds,
          size,
          status,
          progress: Math.max(0, Math.min(100, Math.round(Number(video.progress) || 0))),
          openai_video_id: openaiId,
          image_path: imagePath,
          video_path: null,
          error_message: null,
        })
        .select(
          'id, user_id, title, prompt, seconds, size, status, progress, openai_video_id, image_path, video_path, error_message, created_at, updated_at',
        )
        .single()
      if (insertErr) return json({ error: insertErr.message }, 500)
      return json({ job: inserted as JobRow })
    }

    if (action === 'sync') {
      const id = sanitize(body.id, 80)
      if (!isUuid(id)) return json({ error: 'A valid job id is required.' }, 400)

      const { data: row, error: loadErr } = await supabase
        .from('ai_video_jobs')
        .select(
          'id, user_id, title, prompt, seconds, size, status, progress, openai_video_id, image_path, video_path, error_message, created_at, updated_at',
        )
        .eq('id', id)
        .maybeSingle()
      if (loadErr) return json({ error: loadErr.message }, 500)
      if (!row) return json({ error: 'Video job not found.' }, 404)
      const job = row as JobRow

      if (job.status === 'completed' && job.video_path) return json({ job })
      if (job.status === 'failed') return json({ job })
      if (!job.openai_video_id) return json({ error: 'This job has no Sora render id yet.' }, 409)

      const latest = await openaiJson(`/videos/${job.openai_video_id}`, openaiKey)
      if (!latest.ok) {
        const detail = openaiErrorMessage(latest.payload, latest.raw.slice(0, 400) || `OpenAI HTTP ${latest.status}`)
        return json({ error: detail }, latest.status >= 400 && latest.status < 500 ? latest.status : 502)
      }

      const nextStatus = latest.payload.status || job.status
      const nextProgress = Math.max(0, Math.min(100, Math.round(Number(latest.payload.progress) || job.progress)))

      if (nextStatus === 'failed') {
        const detail = openaiErrorMessage(latest.payload, 'Sora failed to generate this video.')
        const { data: updated, error: updErr } = await supabase
          .from('ai_video_jobs')
          .update({ status: 'failed', progress: nextProgress, error_message: detail })
          .eq('id', id)
          .select(
            'id, user_id, title, prompt, seconds, size, status, progress, openai_video_id, image_path, video_path, error_message, created_at, updated_at',
          )
          .single()
        if (updErr) return json({ error: updErr.message }, 500)
        return json({ job: updated as JobRow })
      }

      if (nextStatus !== 'completed') {
        const { data: updated, error: updErr } = await supabase
          .from('ai_video_jobs')
          .update({
            status: nextStatus === 'in_progress' ? 'in_progress' : 'queued',
            progress: nextProgress,
            error_message: null,
          })
          .eq('id', id)
          .select(
            'id, user_id, title, prompt, seconds, size, status, progress, openai_video_id, image_path, video_path, error_message, created_at, updated_at',
          )
          .single()
        if (updErr) return json({ error: updErr.message }, 500)
        return json({ job: updated as JobRow })
      }

      const videoPath = `${userId}/${id}/video.mp4`
      if (!job.video_path) {
        const contentRes = await fetch(`https://api.openai.com/v1/videos/${job.openai_video_id}/content`, {
          headers: { Authorization: `Bearer ${openaiKey}` },
        })
        if (!contentRes.ok) {
          const detail = await readOpenAiError(contentRes)
          return json({ error: detail }, 502)
        }
        const bytes = new Uint8Array(await contentRes.arrayBuffer())
        const videoBlob = new Blob([bytes], { type: 'video/mp4' })
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(videoPath, videoBlob, {
          contentType: 'video/mp4',
          upsert: true,
        })
        if (upErr) return json({ error: upErr.message }, 500)
      }

      const { data: updated, error: updErr } = await supabase
        .from('ai_video_jobs')
        .update({
          status: 'completed',
          progress: 100,
          video_path: videoPath,
          error_message: null,
        })
        .eq('id', id)
        .select(
          'id, user_id, title, prompt, seconds, size, status, progress, openai_video_id, image_path, video_path, error_message, created_at, updated_at',
        )
        .single()
      if (updErr) return json({ error: updErr.message }, 500)
      return json({ job: updated as JobRow })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
