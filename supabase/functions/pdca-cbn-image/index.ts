const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, accept, accept-profile, prefer',
  'Access-Control-Max-Age': '86400',
}

type CbnImagePayload = {
  slogan?: string
  vision?: string
  associations?: string
  metrics?: string
  logoText?: string
}

function sanitize(v: unknown, max = 800): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
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
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          error: 'CBN image generation is not configured. Set OPENAI_API_KEY on the pdca-cbn-image Edge Function.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payload = (await req.json()) as CbnImagePayload
    const slogan = sanitize(payload.slogan, 80)
    const vision = sanitize(payload.vision, 400)
    const associations = sanitize(payload.associations, 200)
    const metrics = sanitize(payload.metrics, 200)
    const logoText = sanitize(payload.logoText, 40)

    if (!slogan && !vision) {
      return new Response(JSON.stringify({ error: 'Provide a slogan or vision before generating an image.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt =
      `Motivational industrial operations poster for a manufacturing site leadership board. ` +
      `Bold, energising, simple to remember. Minimal text on the image. ` +
      `Large visual metaphor for teamwork, flow, and performance excellence. ` +
      `Modern flat illustration style with strong contrast, no photorealistic faces. ` +
      `Slogan to evoke (do not cram small text): "${slogan || 'Win Together'}". ` +
      `Vision: ${vision || 'high performance culture'}. ` +
      `Associations: ${associations || 'pride, ownership'}. ` +
      `Metrics focus: ${metrics || 'safety, quality, output'}. ` +
      `Optional small badge letters: "${logoText || 'CBN'}". ` +
      `Leave generous negative space. No watermarks.`

    const model = Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-1'
    const useGptImage = model.startsWith('gpt-image')

    const body: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      size: '1024x1024',
    }
    if (!useGptImage) {
      body.response_format = 'b64_json'
    }

    const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const imgText = await imgRes.text()
    let parsed: { data?: { b64_json?: string }[]; error?: { message?: string } }
    try {
      parsed = JSON.parse(imgText) as typeof parsed
    } catch {
      return new Response(
        JSON.stringify({ error: `Image API returned non-JSON (HTTP ${imgRes.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!imgRes.ok) {
      return new Response(
        JSON.stringify({
          error: parsed.error?.message ?? `Image API error (HTTP ${imgRes.status})`,
        }),
        { status: imgRes.status >= 500 ? 502 : imgRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const b64 = parsed.data?.[0]?.b64_json
    if (!b64) {
      return new Response(JSON.stringify({ error: 'Image API returned no image data.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        imageDataUrl: `data:image/png;base64,${b64}`,
        model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: 'CBN image generation failed', detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
