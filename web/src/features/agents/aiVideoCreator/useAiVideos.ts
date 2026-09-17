import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import {
  AI_VIDEO_BUCKET,
  asPathList,
  isAiVideoModel,
  isAiVideoSeconds,
  isAiVideoSize,
  type AiVideoJob,
  type AiVideoJobView,
  type AiVideoStatus,
} from './types'

const JOB_COLUMNS =
  'id, user_id, title, prompt, seconds, size, model, status, progress, openai_video_id, image_path, video_path, image_paths, openai_video_ids, segment_paths, error_message, created_at, updated_at'

type DbJob = {
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

function asStatus(v: string): AiVideoStatus {
  if (v === 'queued' || v === 'in_progress' || v === 'completed' || v === 'failed') return v
  return 'failed'
}

function normalizeJob(row: DbJob): AiVideoJob {
  const imagePaths = asPathList(row.image_paths)
  const openaiIds = asPathList(row.openai_video_ids)
  const segmentPaths = asPathList(row.segment_paths)
  if (row.image_path && !imagePaths.includes(row.image_path)) imagePaths.unshift(row.image_path)
  if (row.openai_video_id && !openaiIds.includes(row.openai_video_id)) openaiIds.unshift(row.openai_video_id)
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    prompt: row.prompt,
    seconds: isAiVideoSeconds(row.seconds) ? row.seconds : '8',
    size: isAiVideoSize(row.size) ? row.size : '1280x720',
    model: row.model && isAiVideoModel(row.model) ? row.model : 'sora-2',
    status: asStatus(row.status),
    progress: Math.max(0, Math.min(100, Math.round(Number(row.progress) || 0))),
    openai_video_id: row.openai_video_id,
    image_path: row.image_path,
    video_path: row.video_path,
    image_paths: imagePaths,
    openai_video_ids: openaiIds,
    segment_paths: segmentPaths,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function signPath(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(AI_VIDEO_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}

async function signPaths(paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => signPath(path))).then((urls) =>
    urls.map((url) => url ?? ''),
  )
}

async function withSignedUrls(job: AiVideoJob): Promise<AiVideoJobView> {
  const [imageUrl, videoUrl, imageUrls, segmentUrls] = await Promise.all([
    signPath(job.image_path),
    signPath(job.video_path),
    signPaths(job.image_paths),
    signPaths(job.segment_paths),
  ])
  return {
    ...job,
    imageUrl,
    videoUrl,
    imageUrls: imageUrls.filter(Boolean),
    segmentUrls: segmentUrls.filter(Boolean),
  }
}

function mergeJob(prev: AiVideoJobView | undefined, next: AiVideoJob, signed: AiVideoJobView): AiVideoJobView {
  return {
    ...signed,
    imageUrl: signed.imageUrl ?? (prev?.image_path === next.image_path ? prev.imageUrl : null),
    videoUrl: signed.videoUrl ?? (prev?.video_path === next.video_path ? prev.videoUrl : null),
    imageUrls: signed.imageUrls.length ? signed.imageUrls : prev?.imageUrls ?? [],
    segmentUrls: signed.segmentUrls.length ? signed.segmentUrls : prev?.segmentUrls ?? [],
  }
}

export function useAiVideos() {
  const { user } = useAuth()
  const [rows, setRows] = useState<AiVideoJobView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('ai_video_jobs')
      .select(JOB_COLUMNS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (err) {
      setLoading(false)
      setError(err.message)
      return
    }
    const jobs = ((data ?? []) as DbJob[]).map(normalizeJob)
    const views = await Promise.all(jobs.map(withSignedUrls))
    setRows(views)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const upsertJob = useCallback(async (job: AiVideoJob) => {
    const signed = await withSignedUrls(job)
    setRows((prev) => {
      const existing = prev.find((row) => row.id === job.id)
      const next = mergeJob(existing, job, signed)
      const rest = prev.filter((row) => row.id !== job.id)
      return [next, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at))
    })
    return signed
  }, [])

  const uploadSourceImage = useCallback(
    async (jobId: string, blob: Blob, index = 0): Promise<string> => {
      if (!user) throw new Error('Sign in to upload a picture.')
      const path = `${user.id}/${jobId}/source-${index}.jpg`
      const { error: upErr } = await supabase.storage.from(AI_VIDEO_BUCKET).upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (upErr) throw new Error(upErr.message)
      return path
    },
    [user],
  )

  const saveJoinedVideo = useCallback(
    async (job: AiVideoJob, blob: Blob, ext: 'mp4' | 'webm'): Promise<AiVideoJobView | null> => {
      if (!user) return null
      const path = `${user.id}/${job.id}/video.${ext}`
      const { error: upErr } = await supabase.storage.from(AI_VIDEO_BUCKET).upload(path, blob, {
        contentType: ext === 'mp4' ? 'video/mp4' : 'video/webm',
        upsert: true,
      })
      if (upErr) {
        setError(upErr.message)
        return null
      }
      const { data, error: err } = await supabase
        .from('ai_video_jobs')
        .update({
          video_path: path,
          status: 'completed',
          progress: 100,
          error_message: null,
        })
        .eq('id', job.id)
        .select(JOB_COLUMNS)
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      return upsertJob(normalizeJob(data as DbJob))
    },
    [upsertJob, user],
  )

  const deleteJob = useCallback(async (job: AiVideoJobView): Promise<boolean> => {
    setError(null)
    const paths = [job.image_path, job.video_path, ...job.image_paths, ...job.segment_paths].filter(
      (p): p is string => Boolean(p),
    )
    if (paths.length > 0) {
      await supabase.storage.from(AI_VIDEO_BUCKET).remove([...new Set(paths)])
    }
    const { error: err } = await supabase.from('ai_video_jobs').delete().eq('id', job.id)
    if (err) {
      setError(err.message)
      return false
    }
    setRows((prev) => prev.filter((row) => row.id !== job.id))
    return true
  }, [])

  return { rows, loading, error, reload: load, upsertJob, uploadSourceImage, saveJoinedVideo, deleteJob }
}
