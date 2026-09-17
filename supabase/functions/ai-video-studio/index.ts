const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

type CreatePayload = {
  action?: 'create' | 'poll'
  imageDataUrl?: string
  motionPrompt?: string
  motionBucket?: number
  predictionId?: string
}

const MAX_DATA_URL_CHARS = 6_500_000

function sanitizePrompt(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function clampMotionBucket(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 127
  return Math.max(1, Math.min(255, Math.round(n)))
}

function isLikelyImageDataUrl(value: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(value)
}

async function replicateFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

async function waitForPrediction(token: string, predictionId: string, maxWaitMs = 120_000) {
  const started = Date.now()
  while (Date.now() - started < maxWaitMs) {
    const res = await replicateFetch(token, `/predictions/${predictionId}`)
    const text = await res.text()
    let body: {
      status?: string
      output?: unknown
      error?: string
      logs?: string
    }
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      throw new Error(`Replicate returned non-JSON (HTTP ${res.status})`)
    }
    if (!res.ok) {
      throw new Error(body.error ?? `Replicate error (HTTP ${res.status})`)
    }
    if (body.status === 'succeeded') {
      return body
    }
    if (body.status === 'failed' || body.status === 'canceled') {
      throw new Error(body.error ?? `Replicate prediction ${body.status}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('Video generation timed out. Try again with a smaller image or poll later.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const replicateToken = Deno.env.get('REPLICATE_API_TOKEN')
    if (!replicateToken) {
      return new Response(
        JSON.stringify({
          error:
            'AI motion video is not configured. Set REPLICATE_API_TOKEN on the ai-video-studio Edge Function.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payload = (await req.json()) as CreatePayload
    const action = payload.action === 'poll' ? 'poll' : 'create'

    if (action === 'poll') {
      const predictionId = sanitizePrompt(payload.predictionId, 120)
      if (!predictionId) {
        return new Response(JSON.stringify({ error: 'Provide predictionId to poll status.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const res = await replicateFetch(replicateToken, `/predictions/${predictionId}`)
      const text = await res.text()
      let body: { status?: string; output?: unknown; error?: string; id?: string }
      try {
        body = JSON.parse(text) as typeof body
      } catch {
        return new Response(JSON.stringify({ error: 'Replicate returned non-JSON.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!res.ok) {
        return new Response(JSON.stringify({ error: body.error ?? `Replicate HTTP ${res.status}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const output = body.output
      const videoUrl =
        typeof output === 'string'
          ? output
          : Array.isArray(output) && typeof output[0] === 'string'
            ? output[0]
            : undefined
      return new Response(
        JSON.stringify({
          predictionId: body.id ?? predictionId,
          status: body.status ?? 'unknown',
          videoUrl,
          error: body.error,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const imageDataUrl = typeof payload.imageDataUrl === 'string' ? payload.imageDataUrl.trim() : ''
    if (!imageDataUrl || !isLikelyImageDataUrl(imageDataUrl)) {
      return new Response(JSON.stringify({ error: 'Provide one image as a JPEG/PNG/WebP data URL.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (imageDataUrl.length > MAX_DATA_URL_CHARS) {
      return new Response(JSON.stringify({ error: 'Image is too large. Resize below ~4 MB and try again.' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const motionPrompt = sanitizePrompt(payload.motionPrompt)
    const motionBucket = clampMotionBucket(payload.motionBucket)
    const model =
      Deno.env.get('REPLICATE_VIDEO_MODEL')?.trim() || 'stability-ai/stable-video-diffusion-img2vid-xt'

    const input: Record<string, unknown> = {
      input_image: imageDataUrl,
      video_length: '25_frames_with_svd_xt',
      sizing_strategy: 'maintain_aspect_ratio',
      motion_bucket_id: motionBucket,
      cond_aug: 0.02,
      decoding_t: 7,
    }
    // Optional text guidance for models that support it (not Stable Video Diffusion).
    if (motionPrompt && Deno.env.get('REPLICATE_VIDEO_USE_MOTION_PROMPT') === 'true') {
      input.motion_prompt = motionPrompt
    }

    const createRes = await replicateFetch(replicateToken, `/models/${model}/predictions`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    })
    const createText = await createRes.text()
    let created: { id?: string; status?: string; error?: string; output?: unknown }
    try {
      created = JSON.parse(createText) as typeof created
    } catch {
      return new Response(JSON.stringify({ error: 'Replicate create returned non-JSON.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!createRes.ok) {
      return new Response(JSON.stringify({ error: created.error ?? `Replicate HTTP ${createRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const predictionId = created.id
    if (!predictionId) {
      return new Response(JSON.stringify({ error: 'Replicate did not return a prediction id.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (created.status === 'succeeded') {
      const output = created.output
      const videoUrl =
        typeof output === 'string'
          ? output
          : Array.isArray(output) && typeof output[0] === 'string'
            ? output[0]
            : undefined
      return new Response(
        JSON.stringify({ predictionId, status: 'succeeded', videoUrl, model }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const finished = await waitForPrediction(replicateToken, predictionId)
    const output = finished.output
    const videoUrl =
      typeof output === 'string'
        ? output
        : Array.isArray(output) && typeof output[0] === 'string'
          ? output[0]
          : undefined

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: 'Video generation finished without a video URL.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ predictionId, status: 'succeeded', videoUrl, model }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: 'AI video generation failed', detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
