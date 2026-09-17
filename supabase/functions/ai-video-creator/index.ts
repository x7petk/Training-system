import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

const BUCKET = 'ai-video-creator'
const ALLOWED_SECONDS = new Set(['4', '8', '12'])
const MAX_IMAGES = 5
/** Sora renders only the two standard shapes; the wide/tall shapes need Sora Pro. */
const MODEL_SIZES: Record<string, Set<string>> = {
  'sora-2': new Set(['1280x720', '720x1280']),
  'sora-2-pro': new Set(['1280x720', '720x1280', '1792x1024', '1024x1792']),
}
/** Each request stays short so the Vercel proxy (60s) never times out mid-flight. */
const WORK_BUDGET_MS = 22_000
const JOB_COLUMNS =
  'id, user_id, title, prompt, seconds, size, model, status, progress, openai_video_id, image_path, video_path, image_paths, openai_video_ids, segment_paths, error_message, created_at, updated_at'

const MODERATION_HELP =
  'Sora’s safety system blocked this one. It rejects pictures showing a person’s face, real or famous people, ' +
  'copyrighted characters, brand logos, and anything not suitable for under 18. Try a picture with no visible ' +
  'face — a product, place, animal, or drawing — and keep the description free of real names and brands.'

type JobRow = {
  id: string
  user_id: string
  title: string
  prompt: string
  seconds: string
  size: string
  model?: string
  status: string
  progress: number
  openai_video_id: string | null
  image_path: string | null
  video_path: string | null
  image_paths?: unknown
  openai_video_ids?: unknown
  segment_paths?: unknown
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

type SupabaseClient = ReturnType<typeof createClient>

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

function asPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => sanitize(item, 240)).filter(Boolean)
}

function titleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, ' ').trim()
  if (compact.length <= 72) return compact || 'Untitled video'
  return `${compact.slice(0, 69).trim()}…`
}

/** Turn Sora/OpenAI failures into something a non-technical user can act on. */
function friendlyError(message: string, code?: string): string {
  const raw = message.trim()
  const text = `${code ?? ''} ${raw}`.toLowerCase()
  if (
    text.includes('moderation') ||
    text.includes('safety system') ||
    text.includes('content policy') ||
    text.includes('usage policies')
  ) {
    return MODERATION_HELP
  }
  if (text.includes('must match') || text.includes('width and height')) {
    return 'Sora needs the picture to match the chosen shape exactly. Pick the shape again and create the video once more so the picture is re-cropped.'
  }
  if (text.includes('rate limit') || text.includes('too many requests')) {
    return 'Sora is busy right now. Wait about a minute, then run it again.'
  }
  if (text.includes('quota') || text.includes('billing') || text.includes('insufficient_quota')) {
    return 'The OpenAI account has no video credit left. Top up billing, then run it again.'
  }
  if (text.includes('not supported') && text.includes('size')) {
    return 'That shape needs Sora Pro. Switch the model to Sora Pro, or pick landscape or portrait.'
  }
  return raw || 'Sora could not generate this video.'
}

function openAiErrorFrom(payload: OpenAiVideo, fallback: string): string {
  const err = payload.error
  if (typeof err === 'string' && err.trim()) return friendlyError(err)
  if (err && typeof err === 'object') {
    const message = typeof err.message === 'string' ? err.message : ''
    const code = typeof err.code === 'string' ? err.code : undefined
    if (message.trim() || code) return friendlyError(message || fallback, code)
  }
  return friendlyError(fallback)
}

async function readOpenAiError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } | string }
    if (typeof parsed.error === 'string' && parsed.error.trim()) return friendlyError(parsed.error)
    if (parsed.error && typeof parsed.error === 'object') {
      return friendlyError(parsed.error.message ?? `OpenAI HTTP ${res.status}`, parsed.error.code)
    }
  } catch {
    /* fall through to raw text */
  }
  return friendlyError(text.trim().slice(0, 400) || `OpenAI HTTP ${res.status}`)
}

async function openaiJson(
  path: string,
  apiKey: string,
): Promise<{ ok: boolean; status: number; payload: OpenAiVideo; raw: string }> {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
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

function isOwnedImagePath(path: string, userId: string, jobId: string): boolean {
  const prefix = `${userId}/${jobId}/`
  if (!path.startsWith(prefix) || !path.endsWith('.jpg')) return false
  const name = path.slice(prefix.length)
  return name === 'source.jpg' || /^source-\d+\.jpg$/.test(name)
}

function shotPrompt(prompt: string, index: number, total: number): string {
  if (total <= 1) return prompt
  return (
    `${prompt}\n\nThis is shot ${index + 1} of ${total} in a continuous sequence. ` +
    `Animate this still as scene ${index + 1}. Keep subject, lighting, and style consistent. ` +
    `Do not add titles, captions, or watermarks.`
  )
}

function jobPaths(job: JobRow): string[] {
  const paths = asPathList(job.image_paths)
  if (paths.length === 0 && job.image_path) paths.push(job.image_path)
  return paths
}

function jobOpenAiIds(job: JobRow): string[] {
  const ids = asPathList(job.openai_video_ids)
  if (ids.length === 0 && job.openai_video_id) ids.push(job.openai_video_id)
  return ids
}

async function patchJob(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ job: JobRow } | { error: string }> {
  const { data, error } = await supabase
    .from('ai_video_jobs')
    .update(patch)
    .eq('id', id)
    .select(JOB_COLUMNS)
    .single()
  if (error) return { error: error.message }
  return { job: data as unknown as JobRow }
}

async function startSoraJob(
  openaiKey: string,
  imageBlob: Blob,
  prompt: string,
  seconds: string,
  size: string,
  model: string,
): Promise<{ id: string } | { error: string }> {
  const imageBytes = new Uint8Array(await imageBlob.arrayBuffer())
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('seconds', seconds)
  form.append('size', size)
  form.append('input_reference', new Blob([imageBytes], { type: 'image/jpeg' }), 'frame.jpg')
  const created = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  })
  if (!created.ok) return { error: await readOpenAiError(created) }
  const video = (await created.json()) as OpenAiVideo
  const openaiId = sanitize(video.id, 120)
  if (!openaiId) return { error: 'Sora did not return a video job id.' }
  return { id: openaiId }
}

/**
 * Start the scenes that have no Sora render yet, one at a time, until the time budget runs out.
 * Remaining scenes start on the next `sync` call, so no single request can time out.
 */
async function startPendingScenes(
  supabase: SupabaseClient,
  openaiKey: string,
  startedJob: JobRow,
  deadline: number,
): Promise<{ job: JobRow } | { error: string }> {
  let job = startedJob
  const paths = jobPaths(job)
  const model = sanitize(job.model, 40) || 'sora-2'

  while (jobOpenAiIds(job).length < paths.length && Date.now() < deadline) {
    const ids = jobOpenAiIds(job)
    const index = ids.length
    const scenePrefix = paths.length > 1 ? `Scene ${index + 1}: ` : ''

    const { data: imageBlob, error: dlErr } = await supabase.storage.from(BUCKET).download(paths[index])
    if (dlErr || !imageBlob) {
      return patchJob(supabase, job.id, {
        status: 'failed',
        error_message: `${scenePrefix}${dlErr?.message || 'Could not read that picture.'}`,
      })
    }

    const started = await startSoraJob(
      openaiKey,
      imageBlob,
      shotPrompt(job.prompt, index, paths.length),
      job.seconds,
      job.size,
      model,
    )
    if ('error' in started) {
      return patchJob(supabase, job.id, {
        status: 'failed',
        error_message: `${scenePrefix}${started.error}`,
      })
    }

    const nextIds = [...ids, started.id]
    const patched = await patchJob(supabase, job.id, {
      openai_video_ids: nextIds,
      openai_video_id: nextIds[0],
      status: 'in_progress',
      progress: Math.min(10, Math.round((nextIds.length / paths.length) * 10)),
      error_message: null,
    })
    if ('error' in patched) return patched
    job = patched.job
  }

  return { job }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const deadline = Date.now() + WORK_BUDGET_MS

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
      model?: string
      imagePath?: string
      imagePaths?: unknown
    }
    const action = sanitize(body.action, 40) || 'create'

    if (action === 'create') {
      const id = sanitize(body.id, 80)
      const prompt = sanitize(body.prompt, 4_000)
      const seconds = sanitize(body.seconds, 8)
      const size = sanitize(body.size, 20)
      const model = sanitize(body.model, 40) || 'sora-2'
      const imagePaths = asPathList(body.imagePaths)
      const singlePath = sanitize(body.imagePath, 240)
      const paths = imagePaths.length > 0 ? imagePaths : singlePath ? [singlePath] : []

      if (!isUuid(id)) return json({ error: 'A valid job id is required.' }, 400)
      if (!prompt) return json({ error: 'Describe the video you want.' }, 400)
      if (!ALLOWED_SECONDS.has(seconds)) return json({ error: 'Duration must be 4, 8, or 12 seconds.' }, 400)
      if (!MODEL_SIZES[model]) return json({ error: 'Choose Sora or Sora Pro.' }, 400)
      if (!MODEL_SIZES[model].has(size)) {
        return json(
          {
            error:
              model === 'sora-2'
                ? 'Sora renders landscape 16:9 or portrait 9:16. Switch to Sora Pro for the wide and tall shapes.'
                : 'Choose a supported video size.',
          },
          400,
        )
      }
      if (paths.length === 0) return json({ error: 'Upload at least one picture.' }, 400)
      if (paths.length > MAX_IMAGES) return json({ error: `You can use up to ${MAX_IMAGES} pictures.` }, 400)
      if (paths.some((p) => !isOwnedImagePath(p, userId, id))) {
        return json({ error: 'Image path is invalid for this user.' }, 400)
      }

      const { data: existing } = await supabase.from('ai_video_jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle()
      if (existing) return json({ job: existing as unknown as JobRow })

      // Save history first: if anything later times out, the job is still recoverable by `sync`.
      const { data: inserted, error: insertErr } = await supabase
        .from('ai_video_jobs')
        .insert({
          id,
          user_id: userId,
          title: titleFromPrompt(prompt),
          prompt,
          seconds,
          size,
          model,
          status: 'queued',
          progress: 0,
          openai_video_id: null,
          image_path: paths[0],
          video_path: null,
          image_paths: paths,
          openai_video_ids: [],
          segment_paths: [],
          error_message: null,
        })
        .select(JOB_COLUMNS)
        .single()
      if (insertErr) return json({ error: insertErr.message }, 500)

      const advanced = await startPendingScenes(supabase, openaiKey, inserted as unknown as JobRow, deadline)
      if ('error' in advanced) return json({ error: advanced.error }, 500)
      return json({ job: advanced.job })
    }

    if (action === 'sync') {
      const id = sanitize(body.id, 80)
      if (!isUuid(id)) return json({ error: 'A valid job id is required.' }, 400)

      const { data: row, error: loadErr } = await supabase
        .from('ai_video_jobs')
        .select(JOB_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (loadErr) return json({ error: loadErr.message }, 500)
      if (!row) return json({ error: 'Video job not found.' }, 404)
      let job = row as unknown as JobRow

      if (job.status === 'completed' && job.video_path) return json({ job })
      if (job.status === 'failed') return json({ job })

      const paths = jobPaths(job)
      if (paths.length === 0) {
        const patched = await patchJob(supabase, id, {
          status: 'failed',
          error_message: 'This job has no source picture. Create it again.',
        })
        if ('error' in patched) return json({ error: patched.error }, 500)
        return json({ job: patched.job })
      }

      // Pick up scenes that never started (for example after a slow first request).
      if (jobOpenAiIds(job).length < paths.length) {
        const advanced = await startPendingScenes(supabase, openaiKey, job, deadline)
        if ('error' in advanced) return json({ error: advanced.error }, 500)
        return json({ job: advanced.job })
      }

      const openaiIds = jobOpenAiIds(job)
      const latestList: OpenAiVideo[] = []
      for (const videoId of openaiIds) {
        const latest = await openaiJson(`/videos/${videoId}`, openaiKey)
        if (latest.status === 404) {
          const patched = await patchJob(supabase, id, {
            status: 'failed',
            error_message: 'Sora no longer has this render (results expire after about a day). Run it again.',
          })
          if ('error' in patched) return json({ error: patched.error }, 500)
          return json({ job: patched.job })
        }
        if (!latest.ok) {
          const detail = openAiErrorFrom(latest.payload, latest.raw.slice(0, 400) || `OpenAI HTTP ${latest.status}`)
          return json({ error: detail }, latest.status >= 400 && latest.status < 500 ? latest.status : 502)
        }
        latestList.push(latest.payload)
      }

      const failedIndex = latestList.findIndex((item) => item.status === 'failed')
      if (failedIndex >= 0) {
        const scenePrefix = latestList.length > 1 ? `Scene ${failedIndex + 1}: ` : ''
        const detail = openAiErrorFrom(latestList[failedIndex], 'Sora failed to generate this video.')
        const patched = await patchJob(supabase, id, {
          status: 'failed',
          error_message: `${scenePrefix}${detail}`,
        })
        if ('error' in patched) return json({ error: patched.error }, 500)
        return json({ job: patched.job })
      }

      const progressAvg = Math.round(
        latestList.reduce((sum, item) => sum + Math.max(0, Math.min(100, Number(item.progress) || 0)), 0) /
          latestList.length,
      )
      if (!latestList.every((item) => item.status === 'completed')) {
        const patched = await patchJob(supabase, id, {
          status: 'in_progress',
          progress: Math.max(10, Math.min(90, Math.round(progressAvg * 0.9))),
          error_message: null,
        })
        if ('error' in patched) return json({ error: patched.error }, 500)
        return json({ job: patched.job })
      }

      // Renders are done: pull the finished files across, as many as the time budget allows.
      while (asPathList(job.segment_paths).length < openaiIds.length) {
        const segmentPaths = asPathList(job.segment_paths)
        const index = segmentPaths.length
        const segmentPath = `${userId}/${id}/segment-${index}.mp4`
        const contentRes = await fetch(`https://api.openai.com/v1/videos/${openaiIds[index]}/content`, {
          headers: { Authorization: `Bearer ${openaiKey}` },
        })
        if (!contentRes.ok) return json({ error: await readOpenAiError(contentRes) }, 502)
        const videoBlob = await contentRes.blob()
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(segmentPath, videoBlob, {
          contentType: 'video/mp4',
          upsert: true,
        })
        if (upErr) return json({ error: upErr.message }, 500)

        const nextSegments = [...segmentPaths, segmentPath]
        const patch: Record<string, unknown> = {
          segment_paths: nextSegments,
          progress: Math.min(95, 90 + Math.round((nextSegments.length / openaiIds.length) * 5)),
          status: 'in_progress',
          error_message: null,
        }
        if (openaiIds.length === 1) {
          patch.video_path = segmentPath
          patch.status = 'completed'
          patch.progress = 100
        }
        const patched = await patchJob(supabase, id, patch)
        if ('error' in patched) return json({ error: patched.error }, 500)
        job = patched.job
        if (Date.now() >= deadline) break
      }

      if (openaiIds.length === 1 && !job.video_path) {
        const patched = await patchJob(supabase, id, {
          status: 'completed',
          progress: 100,
          video_path: asPathList(job.segment_paths)[0] ?? null,
          error_message: null,
        })
        if ('error' in patched) return json({ error: patched.error }, 500)
        job = patched.job
      }

      return json({ job })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
