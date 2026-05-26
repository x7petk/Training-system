export type PdcaCbnImageRequest = {
  slogan?: string
  vision?: string
  associations?: string
  metrics?: string
  logoText?: string
}

export type PdcaCbnImageResult = {
  imageDataUrl?: string
  model?: string
  error?: string
  detail?: string
}

export async function invokePdcaCbnImageViaProxy(
  accessToken: string,
  body: PdcaCbnImageRequest,
): Promise<{ data: PdcaCbnImageResult | null; errorMessage: string | null }> {
  try {
    const res = await fetch('/api/pdca-cbn-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let parsed: PdcaCbnImageResult
    try {
      parsed = JSON.parse(text) as PdcaCbnImageResult
    } catch {
      return {
        data: null,
        errorMessage: `CBN image API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
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
