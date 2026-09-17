import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Copy,
  Download,
  Image as ImageIcon,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { invokeAiVideoCreate, invokeAiVideoSync } from '../lib/aiVideoCreatorProxy'
import { fileToJpegFile, IMAGE_ACCEPT, isProbablyImage } from '../features/agents/aiVideoCreator/imageFile'
import { consumePhoneInboxItem, listPhoneInbox } from '../features/agents/aiVideoCreator/phoneInbox'
import { resizeImageToVideoFrame } from '../features/agents/aiVideoCreator/resizeImage'
import { stitchVideoBlobs } from '../features/agents/aiVideoCreator/stitchVideos'
import { useAiVideos } from '../features/agents/aiVideoCreator/useAiVideos'
import {
  AI_VIDEO_MAX_IMAGES,
  AI_VIDEO_MODELS,
  AI_VIDEO_SECONDS,
  AI_VIDEO_SIZES,
  jobNeedsStitch,
  jobSceneCount,
  jobTotalSeconds,
  videoModelMeta,
  videoSizeMeta,
  type AiVideoJobView,
  type AiVideoModel,
  type AiVideoSeconds,
  type AiVideoSize,
} from '../features/agents/aiVideoCreator/types'

type PickedStill = {
  id: string
  file: File
  previewUrl: string
}

function statusLabel(status: AiVideoJobView['status'], stitching: boolean): string {
  if (stitching) return 'Joining scenes'
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
  const { session, user } = useAuth()
  const { rows, loading, error: rowsError, upsertJob, uploadSourceImage, saveJoinedVideo, deleteJob } = useAiVideos()

  const [stills, setStills] = useState<PickedStill[]>([])
  const [prompt, setPrompt] = useState('')
  const [seconds, setSeconds] = useState<AiVideoSeconds>('8')
  const [model, setModel] = useState<AiVideoModel>('sora-2')
  const [size, setSize] = useState<AiVideoSize>('1280x720')
  const [creating, setCreating] = useState(false)
  const [stitchingId, setStitchingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneUrl, setPhoneUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const libraryRef = useRef<HTMLInputElement | null>(null)
  const syncingRef = useRef<Set<string>>(new Set())
  const stitchingRef = useRef<Set<string>>(new Set())
  const activeIdRef = useRef<string | null>(null)
  const stillsRef = useRef<PickedStill[]>([])
  const seenInboxRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    stillsRef.current = stills
  }, [stills])

  useEffect(() => {
    setPhoneUrl(`${window.location.origin}/agents/ai-video-creator/phone`)
    if (window.matchMedia('(max-width: 767px)').matches) {
      setSize('720x1280')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let pulling = false
    const pull = async () => {
      if (pulling || stillsRef.current.length >= AI_VIDEO_MAX_IMAGES) return
      pulling = true
      try {
        const items = await listPhoneInbox()
        for (const item of items) {
          if (cancelled) return
          if (seenInboxRef.current.has(item.id)) continue
          if (stillsRef.current.length >= AI_VIDEO_MAX_IMAGES) break
          seenInboxRef.current.add(item.id)
          const file = await consumePhoneInboxItem(item)
          if (cancelled) return
          const previewUrl = URL.createObjectURL(file)
          setStills((prev) => {
            if (prev.length >= AI_VIDEO_MAX_IMAGES) return prev
            return [...prev, { id: item.id, file, previewUrl }]
          })
        }
      } catch {
        /* inbox table may not exist yet on an old session */
      } finally {
        pulling = false
      }
    }
    void pull()
    const timer = window.setInterval(() => {
      void pull()
    }, 3000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user])

  useEffect(() => {
    return () => {
      stillsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  const active = useMemo(
    () => rows.find((row) => row.id === activeId) ?? rows[0] ?? null,
    [activeId, rows],
  )

  useEffect(() => {
    if (!activeId && rows[0]) setActiveId(rows[0].id)
  }, [activeId, rows])

  const pendingIds = useMemo(
    () =>
      rows
        .filter((row) => (row.status === 'queued' || row.status === 'in_progress') && !jobNeedsStitch(row))
        .map((row) => row.id),
    [rows],
  )
  const pendingKey = pendingIds.slice().sort().join(',')
  const stitchKey = rows
    .filter(jobNeedsStitch)
    .map((row) => row.id)
    .sort()
    .join(',')

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

  const stitchJob = useCallback(
    async (job: AiVideoJobView) => {
      if (stitchingRef.current.has(job.id) || job.segmentUrls.length < 2) return
      stitchingRef.current.add(job.id)
      setStitchingId(job.id)
      try {
        const blobs = await Promise.all(
          job.segmentUrls.map(async (url) => {
            const res = await fetch(url)
            if (!res.ok) throw new Error('Could not download a scene to join.')
            return res.blob()
          }),
        )
        const joined = await stitchVideoBlobs(blobs, job.size)
        const saved = await saveJoinedVideo(job, joined.blob, joined.ext)
        if (!saved) throw new Error('Could not save the joined video.')
      } catch (e) {
        if (job.id === activeIdRef.current) {
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        stitchingRef.current.delete(job.id)
        setStitchingId((current) => (current === job.id ? null : current))
      }
    },
    [saveJoinedVideo],
  )

  useEffect(() => {
    if (!stitchKey) return
    const jobs = rows.filter((row) => stitchKey.split(',').includes(row.id))
    for (const job of jobs) void stitchJob(job)
  }, [rows, stitchJob, stitchKey])

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return
    const incoming = Array.from(list).filter(isProbablyImage)
    if (incoming.length === 0) {
      setError('Please upload pictures (JPG, PNG, WEBP, or a phone photo).')
      return
    }
    setError(null)
    try {
      const converted: File[] = []
      for (const file of incoming) {
        converted.push(await fileToJpegFile(file))
      }
      setStills((prev) => {
        const room = AI_VIDEO_MAX_IMAGES - prev.length
        const next = converted.slice(0, Math.max(0, room)).map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        }))
        return [...prev, ...next]
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function removeStill(id: string) {
    setStills((prev) => {
      const found = prev.find((item) => item.id === id)
      if (found) URL.revokeObjectURL(found.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  function moveStill(id: string, direction: -1 | 1) {
    setStills((prev) => {
      const index = prev.findIndex((item) => item.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev
      const copy = [...prev]
      const [item] = copy.splice(index, 1)
      copy.splice(nextIndex, 0, item)
      return copy
    })
  }

  async function handleCreate() {
    if (!session?.access_token) {
      setError('Your session is missing. Please sign out and sign in again.')
      return
    }
    if (stills.length === 0) {
      setError('Upload at least one picture.')
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
      const imagePaths: string[] = []
      for (let i = 0; i < stills.length; i++) {
        const frame = await resizeImageToVideoFrame(stills[i].file, size)
        imagePaths.push(await uploadSourceImage(jobId, frame, i))
      }
      const { data, errorMessage } = await invokeAiVideoCreate(session.access_token, {
        id: jobId,
        prompt: prompt.trim(),
        seconds,
        size,
        model,
        imagePath: imagePaths[0],
        imagePaths,
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
  const sceneCount = stills.length
  const canSubmit = Boolean(stills.length > 0 && prompt.trim() && session?.access_token && !creating)
  const activeStitching = Boolean(active && stitchingId === active.id)
  const activeScenes = active ? jobSceneCount(active) : 0

  return (
    <div className="space-y-4 pb-24 md:space-y-6 md:pb-0">
      <header>
        <h1 className="font-display text-xl font-semibold tracking-tight sm:text-3xl">AI Video Creator</h1>
        <p className="mt-1 text-sm text-muted md:mt-2 md:max-w-3xl">
          <span className="md:hidden">Take or pick pictures, describe the motion, then create the video.</span>
          <span className="hidden md:inline">
            Upload one picture, or several in order. Each still becomes a Sora scene from your description,
            then the scenes are joined into one video. On a phone, use Take photo or Photo library. On a
            computer, use From phone to send camera-roll pictures here.
          </span>
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-3 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium text-fg">Pictures *</p>
              <input
                ref={inputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <input
                ref={cameraRef}
                type="file"
                accept={IMAGE_ACCEPT}
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <input
                ref={libraryRef}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3 text-base font-semibold text-white sm:min-h-11 sm:text-sm"
                >
                  <Camera className="size-5 sm:size-4" />
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => libraryRef.current?.click()}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border bg-canvas px-3 py-3 text-base font-semibold text-fg sm:min-h-11 sm:text-sm sm:font-medium"
                >
                  <ImageIcon className="size-5 sm:size-4" />
                  Photo library
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneOpen((open) => !open)}
                  className="hidden min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg sm:inline-flex"
                >
                  <Smartphone className="size-4" />
                  From phone
                </button>
              </div>
              {phoneOpen ? (
                <div className="hidden rounded-xl border border-border bg-canvas px-3 py-3 sm:block">
                  <p className="text-sm font-medium text-fg">Send a picture from your phone</p>
                  <p className="mt-1 text-xs text-muted">
                    Scan the code or open the link on your phone. Sign in with the same account, then take or
                    pick photos. They appear in the list below.
                  </p>
                  {phoneUrl ? (
                    <div className="mt-3 flex flex-wrap items-start gap-3">
                      <img
                        alt="QR code for phone upload"
                        className="h-36 w-36 rounded-lg border border-border bg-white p-1"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(phoneUrl)}`}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="break-all text-xs text-muted">{phoneUrl}</p>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(phoneUrl).then(() => {
                              setCopied(true)
                              window.setTimeout(() => setCopied(false), 1500)
                            })
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg"
                        >
                          <Copy className="size-3.5" />
                          {copied ? 'Copied' : 'Copy link'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                  void addFiles(e.dataTransfer.files)
                }}
                className={`hidden w-full rounded-xl border-2 border-dashed px-4 py-5 text-left transition md:block ${
                  dragActive
                    ? 'border-accent bg-accent-dim/40'
                    : 'border-border bg-canvas hover:border-accent/50 hover:bg-accent-dim/20'
                }`}
              >
                <p className="inline-flex items-center gap-2 text-sm font-medium text-fg">
                  <Upload className="size-4" />
                  Drag and drop pictures here
                </p>
                <p className="mt-1 text-xs text-muted">or click to add files from this device — up to {AI_VIDEO_MAX_IMAGES}</p>
                <p className="mt-2 text-xs text-muted">
                  Order is the scene order. Each picture is cropped to {sizeMeta.label.toLowerCase()} (
                  {sizeMeta.hint}) and used as that scene’s first frame.
                </p>
              </button>
              {stills.length > 0 ? (
                <ul className="space-y-2">
                  {stills.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-canvas px-2 py-2"
                    >
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="h-14 w-20 shrink-0 rounded-md border border-border object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-fg">Scene {index + 1}</p>
                        <p className="truncate text-xs text-muted">{item.file.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveStill(item.id, -1)}
                          disabled={index === 0}
                          className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-black/[0.04] disabled:opacity-30"
                          aria-label="Move scene up"
                        >
                          <ChevronUp className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStill(item.id, 1)}
                          disabled={index === stills.length - 1}
                          className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-black/[0.04] disabled:opacity-30"
                          aria-label="Move scene down"
                        >
                          <ChevronDown className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStill(item.id)}
                          className="flex size-11 items-center justify-center rounded-md text-muted hover:text-rose-600"
                          aria-label="Remove scene"
                        >
                          <X className="size-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label className="block space-y-2 text-sm">
              <span className="font-medium text-fg">Description *</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="What should happen in the video?"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-3 text-base sm:py-2 sm:text-sm"
              />
              <span className="block text-xs text-muted">{prompt.trim().length}/4000</span>
            </label>
          </div>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Model</legend>
              <div className="grid grid-cols-2 gap-2">
                {AI_VIDEO_MODELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModel(item.id)}
                    className={`min-h-14 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      model === item.id
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-canvas text-fg hover:border-accent/40'
                    }`}
                  >
                    <span className="block font-medium">{item.label}</span>
                    <span className={`block text-xs ${model === item.id ? 'text-white/80' : 'text-muted'}`}>
                      {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">
                {sceneCount > 1 ? 'Duration per scene' : 'Duration'}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {AI_VIDEO_SECONDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSeconds(item.id)}
                    className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-medium transition ${
                      seconds === item.id
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-canvas text-fg hover:border-accent/40'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {sceneCount > 1 ? (
                <p className="text-xs text-muted">
                  {sceneCount} scenes × {seconds}s ≈ {sceneCount * Number(seconds)}s finished video.
                </p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Shape</legend>
              <div className="grid grid-cols-2 gap-2">
                {AI_VIDEO_SIZES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSize(item.id)}
                    className={`min-h-14 rounded-lg border px-3 py-2 text-left text-sm transition ${
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
              One picture usually takes 1–3 minutes. Several pictures take longer because each scene is
              rendered, then joined.
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

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:z-auto md:mt-5 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleCreate()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:min-h-0 md:rounded-lg md:py-2 md:text-sm"
          >
            <Sparkles className="size-4" />
            {creating ? 'Starting Sora…' : sceneCount > 1 ? `Create ${sceneCount}-scene video` : 'Create video'}
          </button>
        </div>
      </section>

      {active ? (
        <section className="rounded-2xl border border-border bg-surface-raised/40 p-3 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Latest / selected</p>
              <h2 className="font-display text-lg font-semibold text-fg">{active.title}</h2>
              <p className="mt-1 text-sm text-muted">{active.prompt}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(active.status)}`}>
              {statusLabel(active.status, activeStitching)}
              {active.status === 'in_progress' || active.status === 'queued' ? ` · ${active.progress}%` : ''}
            </span>
          </div>

          {active.status === 'queued' || active.status === 'in_progress' || activeStitching ? (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.max(6, activeStitching ? 97 : active.progress)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {activeStitching
                  ? 'Scenes are ready. Joining them into one video…'
                  : activeScenes > 1
                    ? `Sora is rendering ${activeScenes} scenes. You can keep working.`
                    : 'Sora is rendering this clip. You can keep working.'}
              </p>
            </div>
          ) : null}

          {active.status === 'failed' && active.error_message ? (
            <p className="mt-4 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
              {active.error_message}
            </p>
          ) : null}

          {active && jobNeedsStitch(active) && !activeStitching ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void stitchJob(active)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white sm:w-auto sm:min-h-0 sm:rounded-lg sm:py-2 sm:text-sm"
              >
                Join scenes into one video
              </button>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
            {active.videoUrl ? (
              <video
                key={active.videoUrl}
                className="max-h-[55vh] w-full rounded-xl border border-border bg-black"
                src={active.videoUrl}
                controls
                playsInline
                poster={active.imageUrl ?? undefined}
              />
            ) : active.segmentUrls.length > 1 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">Individual scenes (joined video appears when ready)</p>
                {active.segmentUrls.map((url, index) => (
                  <video
                    key={url}
                    className="w-full rounded-xl border border-border bg-black"
                    src={url}
                    controls
                    playsInline
                    poster={active.imageUrls[index] ?? active.imageUrl ?? undefined}
                  />
                ))}
              </div>
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
                <span className="text-muted">Duration:</span> {jobTotalSeconds(active)}s
                {activeScenes > 1 ? ` (${activeScenes} × ${active.seconds}s)` : ''}
              </p>
              <p>
                <span className="text-muted">Model:</span> {videoModelMeta(active.model).label}
              </p>
              <p>
                <span className="text-muted">Shape:</span> {videoSizeMeta(active.size).label} ({active.size})
              </p>
              {active.imageUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {active.imageUrls.map((url, index) => (
                    <img
                      key={url}
                      src={url}
                      alt={`Scene ${index + 1}`}
                      className="h-16 w-24 rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              ) : active.imageUrl ? (
                <img
                  src={active.imageUrl}
                  alt="Source picture"
                  className="max-h-40 w-full rounded-lg border border-border object-cover"
                />
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={!active.videoUrl}
                  onClick={() => {
                    if (!active.videoUrl) return
                    const ext = active.video_path?.endsWith('.webm') ? 'webm' : 'mp4'
                    void downloadFromUrl(active.videoUrl, `${safeFileName(active.title)}.${ext}`).catch((e) => {
                      setError(e instanceof Error ? e.message : String(e))
                    })
                  }}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="size-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(active)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-fg hover:text-rose-600"
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
          <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
            {rows.map((job) => {
              const selected = job.id === active?.id
              const scenes = jobSceneCount(job)
              return (
                <article
                  key={job.id}
                  className={`w-[78vw] shrink-0 snap-start overflow-hidden rounded-xl border bg-surface-raised/30 sm:w-auto ${
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
                        {jobTotalSeconds(job)}s{scenes > 1 ? ` · ${scenes} scenes` : ''} · {videoModelMeta(job.model).label} · {videoSizeMeta(job.size).label}
                      </p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(job.status)}`}>
                        {statusLabel(job.status, stitchingId === job.id)}
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
