export type AiVideoStudioCreateRequest = {
  action?: 'create' | 'poll'
  imageDataUrl?: string
  motionPrompt?: string
  motionBucket?: number
  predictionId?: string
}

export type AiVideoStudioResult = {
  predictionId?: string
  status?: string
  videoUrl?: string
  model?: string
  error?: string
  detail?: string
}

export async function invokeAiVideoStudioViaProxy(
  accessToken: string,
  body: AiVideoStudioCreateRequest,
): Promise<{ data: AiVideoStudioResult | null; errorMessage: string | null }> {
  try {
    const res = await fetch('/api/ai-video-studio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed: AiVideoStudioResult
    try {
      parsed = JSON.parse(text) as AiVideoStudioResult
    } catch {
      return {
        data: null,
        errorMessage: `AI video API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
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
