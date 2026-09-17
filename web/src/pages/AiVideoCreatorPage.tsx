import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clapperboard, Download, Sparkles, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { invokeAiVideoCreate, invokeAiVideoSync } from '../lib/aiVideoCreatorProxy'
import { resizeImageToVideoFrame } from '../features/agents/aiVideoCreator/resizeImage'
import { useAiVideos } from '../features/agents/aiVideoCreator/useAiVideos'
import {
  AI_VIDEO_SECONDS,
  AI_VIDEO_SIZES,
  videoSizeMeta,
  type AiVideoJobView,
  type AiVideoSeconds,
  type AiVideoSize,
} from '../features/agents/aiVideoCreator/types'

function statusLabel(status: AiVideoJobView['status']): string {
  if (status === 'queued') return 'Queued'
  if (status === 'in_progress') return 'Generating'
  if (status === 'completed') return 'Ready'
  return 'Failed'
}

function statusClass(status: AiVideoJobView['status']): string {
  if (status === 'completed') return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
  if (status === 'failed') return 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
  if (status === 'in_progress') return 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
  return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
}

async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not download the video.')
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

function safeFileName(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'video'
}

export function AiVideoCreatorPage() {
  const { session } = useAuth()
  const { rows, loading, error: rowsError, upsertJob, uploadSourceImage, deleteJob } = useAiVideos()

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [seconds, setSeconds] = useState<AiVideoSeconds>('8')
  const [size, setSize] = useState<AiVideoSize>('1280x720')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const syncingRef = useRef<Set<string>>(new Set())
  const activeIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const active = useMemo(
    () => rows.find((row) => row.id === activeId) ?? rows[0] ?? null,
    [activeId, rows],
  )

  useEffect(() => {
    if (!activeId && rows[0]) setActiveId(rows[0].id)
  }, [activeId, rows])

  const pendingIds = useMemo(
    () => rows.filter((row) => row.status === 'queued' || row.status === 'in_progress').map((row) => row.id),
    [rows],
  )
  const pendingKey = pendingIds.slice().sort().join(',')

  const syncJob = useCallback(
    async (id: string) => {
      if (!session?.access_token || syncingRef.current.has(id)) return
      syncingRef.current.add(id)
      try {
        const { data, errorMessage } = await invokeAiVideoSync(session.access_token, id)
        if (data?.job) await upsertJob(data.job)
        if (errorMessage && id === activeIdRef.current) setError(errorMessage)
      } finally {
        syncingRef.current.delete(id)
      }
    },
    [session?.access_token, upsertJob],
  )

  useEffect(() => {
    if (!pendingKey || !session?.access_token) return
    const ids = pendingKey.split(',').filter(Boolean)
    let cancelled = false
    const tick = async () => {
      for (const id of ids) {
        if (cancelled) return
        await syncJob(id)
      }
    }
    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, 4500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pendingKey, session?.access_token, syncJob])

  function pickFile(next: File | undefined | null) {
    if (!next) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
    setError(null)
  }

  async function handleCreate() {
    if (!session?.access_token) {
      setError('Your session is missing. Please sign out and sign in again.')
      return
    }
    if (!file) {
      setError('Upload a picture first.')
      return
    }
    if (!prompt.trim()) {
      setError('Describe the motion or scene you want in the video.')
      return
    }
    setCreating(true)
    setError(null)
    const jobId = crypto.randomUUID()
    try {
      const frame = await resizeImageToVideoFrame(file, size)
      const imagePath = await uploadSourceImage(jobId, frame)
      const { data, errorMessage } = await invokeAiVideoCreate(session.access_token, {
        id: jobId,
        prompt: prompt.trim(),
        seconds,
        size,
        imagePath,
      })
      if (data?.job) {
        await upsertJob(data.job)
        setActiveId(data.job.id)
      }
      if (errorMessage) {
        setError(errorMessage)
        return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(job: AiVideoJobView) {
    if (!confirm('Delete this video from your history?')) return
    const ok = await deleteJob(job)
    if (ok && job.id === activeId) setActiveId(null)
  }

  const sizeMeta = videoSizeMeta(size)
  const canSubmit = Boolean(file && prompt.trim() && session?.access_token && !creating)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">AI Video Creator</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Upload a picture, describe what should happen, and Sora turns it into a short video. The image
          becomes the first frame. Finished clips stay in your history so you can replay or download them.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium text-fg">Picture *</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!dragActive) setDragActive(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  pickFile(e.dataTransfer.files?.[0] ?? null)
                }}
                className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-left transition ${
                  dragActive
                    ? 'border-accent bg-accent-dim/40'
                    : 'border-border bg-canvas hover:border-accent/50 hover:bg-accent-dim/20'
                }`}
              >
                <p className="inline-flex items-center gap-2 text-sm font-medium text-fg">
                  <Upload className="size-4" />
                  Drag and drop a picture here
                </p>
                <p className="mt-1 text-xs text-muted">or click to upload JPG, PNG, or WEBP</p>
                <p className="mt-2 text-xs text-muted">
                  It will be cropped to {sizeMeta.label.toLowerCase()} ({sizeMeta.hint}) so Sora can use it as
                  the first frame.
                </p>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file?.name ?? 'Selected picture'}
                    className="mt-3 max-h-48 w-full rounded-lg border border-border object-contain bg-black/5"
                  />
                ) : null}
                {file ? <p className="mt-2 truncate text-xs text-accent">{file.name}</p> : null}
              </button>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="font-medium text-fg">Description *</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="Example: Slow camera push-in. Steam rises from the line. The operator turns, checks the gauge, then walks toward the next station."
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
              />
              <span className="block text-xs text-muted">{prompt.trim().length}/4000</span>
            </label>
          </div>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Duration</legend>
              <div className="flex flex-wrap gap-2">
                {AI_VIDEO_SECONDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSeconds(item.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      seconds === item.id
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-canvas text-fg hover:border-accent/40'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Shape</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {AI_VIDEO_SIZES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSize(item.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      size === item.id
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-canvas text-fg hover:border-accent/40'
                    }`}
                  >
                    <span className="block font-medium">{item.label}</span>
                    <span className={`block text-xs ${size === item.id ? 'text-white/80' : 'text-muted'}`}>
                      {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-xs text-muted">
              Generation usually takes 1–3 minutes. Keep this page open and the clip will appear in your
              history when it is ready.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}
        {rowsError ? (
          <p className="mt-4 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
            Could not load saved videos: {rowsError}
          </p>
        ) : null}

        <div className="mt-5">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleCreate()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="size-4" />
            {creating ? 'Starting Sora…' : 'Create video'}
          </button>
        </div>
      </section>

      {active ? (
        <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Latest / selected</p>
              <h2 className="font-display text-lg font-semibold text-fg">{active.title}</h2>
              <p className="mt-1 text-sm text-muted">{active.prompt}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(active.status)}`}>
              {statusLabel(active.status)}
              {active.status === 'in_progress' || active.status === 'queued' ? ` · ${active.progress}%` : ''}
            </span>
          </div>

          {active.status === 'queued' || active.status === 'in_progress' ? (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.max(6, active.progress)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">Sora is rendering this clip. You can keep working.</p>
            </div>
          ) : null}

          {active.status === 'failed' && active.error_message ? (
            <p className="mt-4 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
              {active.error_message}
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
            {active.videoUrl ? (
              <video
                key={active.videoUrl}
                className="w-full rounded-xl border border-border bg-black"
                src={active.videoUrl}
                controls
                playsInline
                poster={active.imageUrl ?? undefined}
              />
            ) : active.imageUrl ? (
              <img
                src={active.imageUrl}
                alt="Source frame"
                className="w-full rounded-xl border border-border object-contain bg-black/5"
              />
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
                {loading ? 'Loading…' : 'No preview yet'}
              </div>
            )}
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted">Duration:</span> {active.seconds}s
              </p>
              <p>
                <span className="text-muted">Shape:</span> {videoSizeMeta(active.size).label} ({active.size})
              </p>
              {active.imageUrl ? (
                <img
                  src={active.imageUrl}
                  alt="Source picture"
                  className="max-h-40 w-full rounded-lg border border-border object-cover"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!active.videoUrl}
                  onClick={() => {
                    if (!active.videoUrl) return
                    void downloadFromUrl(active.videoUrl, `${safeFileName(active.title)}.mp4`).catch((e) => {
                      setError(e instanceof Error ? e.message : String(e))
                    })
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="size-4" />
                  Download MP4
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(active)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:text-rose-600"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-4 text-muted" />
          <h2 className="font-display text-lg font-semibold text-fg">Your videos</h2>
          {loading ? <span className="text-xs text-muted">Loading…</span> : null}
        </div>
        {rows.length === 0 && !loading ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No saved videos yet. Create one above and it will land here.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((job) => {
              const selected = job.id === active?.id
              return (
                <article
                  key={job.id}
                  className={`overflow-hidden rounded-xl border bg-surface-raised/30 ${
                    selected ? 'border-accent ring-1 ring-accent/40' : 'border-border'
                  }`}
                >
                  <button type="button" onClick={() => setActiveId(job.id)} className="block w-full text-left">
                    {job.imageUrl ? (
                      <img src={job.imageUrl} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-black/5 text-xs text-muted">
                        No still
                      </div>
                    )}
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium text-fg">{job.title}</p>
                      <p className="text-xs text-muted">
                        {job.seconds}s · {videoSizeMeta(job.size).label}
                      </p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(job.status)}`}>
                        {statusLabel(job.status)}
                        {job.status === 'in_progress' || job.status === 'queued' ? ` · ${job.progress}%` : ''}
                      </span>
                    </div>
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
