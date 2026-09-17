export const AI_VIDEO_BUCKET = 'ai-video-creator'

export const AI_VIDEO_SECONDS = [
  { id: '4', label: '4 seconds' },
  { id: '8', label: '8 seconds' },
  { id: '12', label: '12 seconds' },
] as const

export const AI_VIDEO_SIZES = [
  { id: '1280x720', label: 'Landscape 16:9', hint: '1280 × 720', width: 1280, height: 720 },
  { id: '720x1280', label: 'Portrait 9:16', hint: '720 × 1280', width: 720, height: 1280 },
  { id: '1792x1024', label: 'Wide landscape', hint: '1792 × 1024', width: 1792, height: 1024 },
  { id: '1024x1792', label: 'Tall portrait', hint: '1024 × 1792', width: 1024, height: 1792 },
] as const

export type AiVideoSeconds = (typeof AI_VIDEO_SECONDS)[number]['id']
export type AiVideoSize = (typeof AI_VIDEO_SIZES)[number]['id']
export type AiVideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed'

export type AiVideoJob = {
  id: string
  user_id: string
  title: string
  prompt: string
  seconds: AiVideoSeconds
  size: AiVideoSize
  status: AiVideoStatus
  progress: number
  openai_video_id: string | null
  image_path: string | null
  video_path: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type AiVideoJobView = AiVideoJob & {
  imageUrl: string | null
  videoUrl: string | null
}

export function isAiVideoSeconds(v: string): v is AiVideoSeconds {
  return AI_VIDEO_SECONDS.some((item) => item.id === v)
}

export function isAiVideoSize(v: string): v is AiVideoSize {
  return AI_VIDEO_SIZES.some((item) => item.id === v)
}

export function videoSizeMeta(size: string) {
  return AI_VIDEO_SIZES.find((item) => item.id === size) ?? AI_VIDEO_SIZES[0]
}
