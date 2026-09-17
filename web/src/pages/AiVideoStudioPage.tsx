import { useCallback, useMemo, useRef, useState } from 'react'
import { Clapperboard, Download, Film, ImagePlus, Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { invokeAiVideoStudioViaProxy } from '../lib/aiVideoStudioProxy'
import { composeSlideshowVideo } from '../features/agents/aiVideoStudio/composeSlideshowVideo'
import { resizeImageDataUrl } from '../features/agents/aiVideoStudio/resizeImageDataUrl'

type SourceImage = {
  id: string
  name: string
  dataUrl: string
}

type AiClip = {
  imageId: string
  videoUrl: string
}

const MAX_IMAGES = 8

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function AiVideoStudioPage() {
  const { session } = useAuth()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [images, setImages] = useState<SourceImage[]>([])
  const [motionPrompt, setMotionPrompt] = useState('')
  const [motionBucket, setMotionBucket] = useState(127)
  const [secondsPerSlide, setSecondsPerSlide] = useState(3)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [slideshowUrl, setSlideshowUrl] = useState<string | null>(null)
  const [aiClips, setAiClips] = useState<AiClip[]>([])

  const revokeSlideshow = useCallback((url: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }, [])

  const onPickFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return
      setError(null)
      const remaining = MAX_IMAGES - images.length
      if (remaining <= 0) {
        setError(`You can use up to ${MAX_IMAGES} images.`)
        return
      }
      const files = Array.from(fileList).slice(0, remaining)
      const added: SourceImage[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        try {
          const dataUrl = await resizeImageDataUrl(file)
          added.push({ id: newId(), name: file.name, dataUrl })
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
      if (added.length) {
        setImages((prev) => [...prev, ...added])
        revokeSlideshow(slideshowUrl)
        setSlideshowUrl(null)
      }
    },
    [images.length, revokeSlideshow, slideshowUrl],
  )

  function removeImage(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id))
    setAiClips((prev) => prev.filter((c) => c.imageId !== id))
    revokeSlideshow(slideshowUrl)
    setSlideshowUrl(null)
  }

  async function buildSlideshow() {
    if (images.length === 0) {
      setError('Add at least one photo.')
      return
    }
    setBusy(true)
    setError(null)
    setProgress('Rendering slideshow in your browser…')
    try {
      const { blob } = await composeSlideshowVideo(
        images.map((i) => i.dataUrl),
        { secondsPerSlide, width: 1280, height: 720 },
      )
      revokeSlideshow(slideshowUrl)
      setSlideshowUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function generateAiMotion() {
    const token = session?.access_token
    if (!token) {
      setError('Sign in to use AI motion video.')
      return
    }
    if (images.length === 0) {
      setError('Add at least one photo.')
      return
    }
    setBusy(true)
    setError(null)
    setAiClips([])
    try {
      const clips: AiClip[] = []
      for (let i = 0; i < images.length; i++) {
        const img = images[i]!
        setProgress(`AI motion: photo ${i + 1} of ${images.length}…`)
        const { data, errorMessage } = await invokeAiVideoStudioViaProxy(token, {
          action: 'create',
          imageDataUrl: img.dataUrl,
          motionPrompt,
          motionBucket,
        })
        if (errorMessage || !data?.videoUrl) {
          throw new Error(errorMessage ?? data?.error ?? 'No video URL returned.')
        }
        clips.push({ imageId: img.id, videoUrl: data.videoUrl })
        setAiClips([...clips])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const primaryPreview = useMemo(() => {
    if (slideshowUrl) return { kind: 'slideshow' as const, url: slideshowUrl }
    const lastClip = aiClips[aiClips.length - 1]
    if (lastClip) return { kind: 'ai' as const, url: lastClip.videoUrl }
    return null
  }, [aiClips, slideshowUrl])

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Clapperboard className="size-8 text-accent" aria-hidden />
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">AI Video Studio</h1>
        </div>
        <p className="max-w-3xl text-sm text-muted">
          Turn one or more photos into video. Use <strong className="font-medium text-fg">AI motion</strong> for
          short cinematic clips per image (requires Replicate on the server), or build a{' '}
          <strong className="font-medium text-fg">slideshow</strong> instantly in your browser with smooth pan and zoom.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-6 rounded-xl border border-border bg-surface p-4 sm:p-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-fg">Photos</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            <button
              type="button"
              disabled={busy || images.length >= MAX_IMAGES}
              onClick={() => inputRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg px-4 py-8 text-sm text-muted transition hover:border-accent hover:text-fg disabled:opacity-50"
            >
              <ImagePlus className="size-5 shrink-0" aria-hidden />
              Add photos (up to {MAX_IMAGES})
            </button>
            {images.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((img, index) => (
                  <li key={img.id} className="group relative overflow-hidden rounded-lg border border-border bg-bg">
                    <img src={img.dataUrl} alt="" className="aspect-video w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] text-white">
                      {index + 1}. {img.name}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${img.name}`}
                      disabled={busy}
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 rounded-md bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-fg">Motion / scene prompt (optional, AI mode)</span>
            <textarea
              value={motionPrompt}
              onChange={(e) => setMotionPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. gentle camera push-in, soft factory lighting, calm atmosphere"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-fg">AI motion amount</span>
              <input
                type="range"
                min={1}
                max={255}
                value={motionBucket}
                onChange={(e) => setMotionBucket(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-muted">{motionBucket} — higher = more movement</span>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-fg">Seconds per slide (slideshow)</span>
              <input
                type="number"
                min={1}
                max={15}
                value={secondsPerSlide}
                onChange={(e) => setSecondsPerSlide(Math.max(1, Math.min(15, Number(e.target.value) || 3)))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busy || images.length === 0}
              onClick={() => void buildSlideshow()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
            >
              {busy && progress?.includes('slideshow') ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Film className="size-4" aria-hidden />
              )}
              Build slideshow video
            </button>
            <button
              type="button"
              disabled={busy || images.length === 0}
              onClick={() => void generateAiMotion()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface disabled:opacity-50"
            >
              {busy && progress?.includes('AI') ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-4" aria-hidden />
              )}
              Generate AI motion clips
            </button>
          </div>

          {progress && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
              {progress}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
              {error}
            </p>
          )}

          <p className="text-xs text-muted">
            <Sparkles className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
            AI mode needs{' '}
            <code className="rounded bg-bg px-1 py-0.5 text-[11px]">REPLICATE_API_TOKEN</code> on the{' '}
            <code className="rounded bg-bg px-1 py-0.5 text-[11px]">ai-video-studio</code> Supabase Edge Function.
            Slideshow mode runs entirely in your browser.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-6">
          <h2 className="text-sm font-medium text-fg">Preview &amp; download</h2>
          {primaryPreview ? (
            <div className="space-y-3">
              <video
                key={primaryPreview.url}
                src={primaryPreview.url}
                controls
                playsInline
                className="aspect-video w-full rounded-lg border border-border bg-black object-contain"
              />
              <a
                href={primaryPreview.url}
                download={primaryPreview.kind === 'slideshow' ? 'slideshow.webm' : 'ai-motion.mp4'}
                className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
              >
                <Download className="size-4" aria-hidden />
                Download preview
              </a>
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-bg text-sm text-muted">
              Generated videos appear here
            </div>
          )}

          {aiClips.length > 1 && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">AI clips ({aiClips.length})</p>
              <ul className="space-y-2">
                {aiClips.map((clip, i) => {
                  const img = images.find((x) => x.id === clip.imageId)
                  return (
                    <li key={clip.imageId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-fg">
                        {i + 1}. {img?.name ?? 'Photo'}
                      </span>
                      <a
                        href={clip.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-accent hover:underline"
                      >
                        Open
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
