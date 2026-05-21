import type { RoadMapApiResponse, RoadMapInputs } from '../features/agents/roadMapBuilderTypes'

export async function invokeRoadMapBuilderViaProxy(
  accessToken: string,
  inputs: RoadMapInputs,
): Promise<{ data: RoadMapApiResponse | null; errorMessage: string | null }> {
  try {
    const res = await fetch('/api/road-map-builder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ inputs }),
    })
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      return {
        data: null,
        errorMessage: `Road Map Builder returned non-JSON (HTTP ${res.status}): ${text.slice(0, 280)}`,
      }
    }
    if (!res.ok) {
      const errObj = parsed as { error?: string; detail?: string }
      const msg = errObj.detail
        ? `${errObj.error ?? 'Error'}: ${errObj.detail}`
        : (errObj.error ?? `HTTP ${res.status}`)
      return { data: null, errorMessage: msg }
    }
    return { data: parsed as RoadMapApiResponse, errorMessage: null }
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}
