import type { AiVideoJob, AiVideoModel, AiVideoSeconds, AiVideoSize } from '../features/agents/aiVideoCreator/types'

async function postAiVideoCreator(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ data: { job: AiVideoJob } | null; errorMessage: string | null }> {
  try {
    const res = await fetch('/api/ai-video-creator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      if (res.status === 504 || res.status === 502 || res.status === 503) {
        return {
          data: null,
          errorMessage:
            'Sora took too long to answer. Your video is saved and keeps going in the background — this page will pick it up again in a moment.',
        }
      }
      return {
        data: null,
        errorMessage: `AI Video Creator returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
      }
    }
    const errObj = parsed as { error?: string; detail?: string; job?: AiVideoJob }
    if (!res.ok) {
      const msg = errObj.detail
        ? `${errObj.error ?? 'Error'}: ${errObj.detail}`
        : (errObj.error ?? `HTTP ${res.status}`)
      return { data: errObj.job ? { job: errObj.job } : null, errorMessage: msg }
    }
    if (!errObj.job) {
      return { data: null, errorMessage: 'AI Video Creator did not return a job.' }
    }
    return { data: { job: errObj.job }, errorMessage: null }
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function invokeAiVideoCreate(
  accessToken: string,
  input: {
    id: string
    prompt: string
    seconds: AiVideoSeconds
    size: AiVideoSize
    model: AiVideoModel
    imagePath?: string
    imagePaths: string[]
  },
) {
  return postAiVideoCreator(accessToken, { action: 'create', ...input })
}

export async function invokeAiVideoSync(accessToken: string, id: string) {
  return postAiVideoCreator(accessToken, { action: 'sync', id })
}
