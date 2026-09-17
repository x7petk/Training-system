export const AI_VIDEO_BUCKET = 'ai-video-creator'
export const AI_VIDEO_MAX_IMAGES = 5

export const AI_VIDEO_SECONDS = [
  { id: '4', label: '4 seconds' },
  { id: '8', label: '8 seconds' },
  { id: '12', label: '12 seconds' },
] as const

export const AI_VIDEO_MODELS = [
  { id: 'sora-2', label: 'Sora', hint: 'Faster, standard shapes' },
  { id: 'sora-2-pro', label: 'Sora Pro', hint: 'Higher quality, all shapes' },
] as const

export const AI_VIDEO_SIZES = [
  { id: '1280x720', label: 'Landscape 16:9', hint: '1280 × 720', width: 1280, height: 720, proOnly: false },
  { id: '720x1280', label: 'Portrait 9:16', hint: '720 × 1280', width: 720, height: 1280, proOnly: false },
  { id: '1792x1024', label: 'Wide landscape', hint: '1792 × 1024', width: 1792, height: 1024, proOnly: true },
  { id: '1024x1792', label: 'Tall portrait', hint: '1024 × 1792', width: 1024, height: 1792, proOnly: true },
] as const

export type AiVideoSeconds = (typeof AI_VIDEO_SECONDS)[number]['id']
export type AiVideoModel = (typeof AI_VIDEO_MODELS)[number]['id']
export type AiVideoSize = (typeof AI_VIDEO_SIZES)[number]['id']
export type AiVideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed'

export type AiVideoJob = {
  id: string
  user_id: string
  title: string
  prompt: string
  seconds: AiVideoSeconds
  size: AiVideoSize
  model: AiVideoModel
  status: AiVideoStatus
  progress: number
  openai_video_id: string | null
  image_path: string | null
  video_path: string | null
  image_paths: string[]
  openai_video_ids: string[]
  segment_paths: string[]
  error_message: string | null
  created_at: string
  updated_at: string
}

export type AiVideoJobView = AiVideoJob & {
  imageUrl: string | null
  videoUrl: string | null
  imageUrls: string[]
  segmentUrls: string[]
}

export function isAiVideoSeconds(v: string): v is AiVideoSeconds {
  return AI_VIDEO_SECONDS.some((item) => item.id === v)
}

export function isAiVideoModel(v: string): v is AiVideoModel {
  return AI_VIDEO_MODELS.some((item) => item.id === v)
}

export function isAiVideoSize(v: string): v is AiVideoSize {
  return AI_VIDEO_SIZES.some((item) => item.id === v)
}

export function videoModelMeta(model: string) {
  return AI_VIDEO_MODELS.find((item) => item.id === model) ?? AI_VIDEO_MODELS[0]
}

export function videoSizeMeta(size: string) {
  return AI_VIDEO_SIZES.find((item) => item.id === size) ?? AI_VIDEO_SIZES[0]
}

/** Sora only renders the two standard shapes; the wide/tall ones need Sora Pro. */
export function modelSupportsSize(model: AiVideoModel, size: AiVideoSize): boolean {
  return model === 'sora-2-pro' || !videoSizeMeta(size).proOnly
}

/** Closest shape the given model can render, so switching model never sends an invalid pair. */
export function sizeForModel(model: AiVideoModel, size: AiVideoSize): AiVideoSize {
  if (modelSupportsSize(model, size)) return size
  return videoSizeMeta(size).width >= videoSizeMeta(size).height ? '1280x720' : '720x1280'
}

export function asPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

export function jobSceneCount(job: Pick<AiVideoJob, 'image_paths' | 'openai_video_ids' | 'segment_paths'>): number {
  return Math.max(job.image_paths.length, job.openai_video_ids.length, job.segment_paths.length, 1)
}

export function jobNeedsStitch(
  job: Pick<AiVideoJob, 'video_path' | 'segment_paths' | 'status' | 'openai_video_ids' | 'image_paths'>,
): boolean {
  const expected = Math.max(job.openai_video_ids.length, job.image_paths.length, 0)
  return (
    job.status !== 'failed' &&
    !job.video_path &&
    expected >= 2 &&
    job.segment_paths.length >= expected
  )
}

export function jobTotalSeconds(job: Pick<AiVideoJob, 'seconds' | 'image_paths' | 'openai_video_ids' | 'segment_paths'>): number {
  return Number(job.seconds) * jobSceneCount(job)
}
