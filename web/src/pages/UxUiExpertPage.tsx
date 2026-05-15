import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { invokeUxUiExpertViaProxy } from '../lib/uxUiExpertProxy'
import type { UxUiAssetInput, UxUiExpertRequest, UxUiExpertResult } from '../features/agents/uxUiExpertTypes'

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

async function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file as text.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file)
  })
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-700 dark:text-emerald-300'
  if (score >= 60) return 'text-amber-700 dark:text-amber-300'
  return 'text-rose-700 dark:text-rose-300'
}

function UploadDropzone({
  title,
  hint,
  accept,
  loadedName,
  previewSrc,
  required = false,
  onPick,
}: {
  title: string
  hint: string
  accept: string
  loadedName?: string | null
  previewSrc?: string | null
  required?: boolean
  onPick: (file: File) => Promise<void> | void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)

  function pickFromInput() {
    inputRef.current?.click()
  }

  function handleDrop(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    void onPick(file)
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-fg">
        {title}
        {required ? ' *' : ''}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleDrop(e.target.files)}
      />
      <button
        type="button"
        onClick={pickFromInput}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!dragActive) setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
          handleDrop(e.dataTransfer.files)
        }}
        className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-left transition ${
          dragActive
            ? 'border-accent bg-accent-dim/40'
            : 'border-border bg-canvas hover:border-accent/50 hover:bg-accent-dim/20'
        }`}
      >
        <p className="text-sm font-medium text-fg">Drag and drop file here</p>
        <p className="mt-1 text-xs text-muted">or click to upload</p>
        <p className="mt-2 text-xs text-muted">{hint}</p>
        {previewSrc ? (
          <div className="mt-3 flex items-center gap-3">
            <img
              src={previewSrc}
              alt={loadedName ?? title}
              className="h-16 w-24 rounded-lg border border-border object-cover"
            />
            <p className="min-w-0 truncate text-xs text-accent">{loadedName}</p>
          </div>
        ) : loadedName ? (
          <p className="mt-2 text-xs text-accent">Loaded: {loadedName}</p>
        ) : null}
      </button>
    </div>
  )
}

export function UxUiExpertPage() {
  const { session } = useAuth()
  const [assetA, setAssetA] = useState<UxUiAssetInput | null>(null)
  const [assetB, setAssetB] = useState<UxUiAssetInput | null>(null)
  const [standardImage, setStandardImage] = useState<UxUiAssetInput | null>(null)
  const [companyStandardText, setCompanyStandardText] = useState('')
  const [contextNotes, setContextNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UxUiExpertResult | null>(null)

  const canSubmit = Boolean(assetA) && Boolean(session?.access_token) && !loading
  const showCompare = Boolean(assetB)
  const overallScore = clampScore(result?.overallScore ?? 0)
  const sortedCategories = useMemo(
    () => [...(result?.categories ?? [])].sort((a, b) => b.score - a.score),
    [result],
  )

  async function onImagePick(file: File, target: 'A' | 'B' | 'standard') {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (png/jpg/webp/etc).')
      return
    }
    const dataUrl = await fileToDataUrl(file)
    const next: UxUiAssetInput = { label: file.name, mimeType: file.type, dataUrl }
    if (target === 'A') setAssetA(next)
    if (target === 'B') setAssetB(next)
    if (target === 'standard') setStandardImage(next)
  }

  async function onStandardFilePick(file: File) {
    if (file.type.startsWith('image/')) {
      await onImagePick(file, 'standard')
      return
    }
    const text = await fileToText(file)
    setCompanyStandardText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))
  }

  async function runAnalysis() {
    if (!assetA) {
      setError('Please upload at least one report/app screenshot first.')
      return
    }
    if (!session?.access_token) {
      setError('Your session is missing. Please sign out and sign in again.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload: UxUiExpertRequest = {
        assetA,
        assetB,
        companyStandardText: companyStandardText.trim() || undefined,
        companyStandardImage: standardImage,
        contextNotes: contextNotes.trim() || undefined,
      }
      const { data, errorMessage } = await invokeUxUiExpertViaProxy(session.access_token, payload)
      if (errorMessage || !data) {
        setError(errorMessage ?? 'Analysis failed.')
        return
      }
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">UX/UI expert</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Upload one or two screenshots of reports/apps/web pages. The agent returns structured design feedback,
          category scores, an overall 0-100 score, comparison insights, and prioritized recommendations.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface-raised/40 p-4 backdrop-blur-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <UploadDropzone
            title="Screenshot A (required)"
            hint="PNG, JPG, WEBP or other image formats."
            accept="image/*"
            required
            loadedName={assetA?.label}
            previewSrc={assetA?.dataUrl}
            onPick={(file) => onImagePick(file, 'A')}
          />
          <UploadDropzone
            title="Screenshot B (optional comparison)"
            hint="Optional second screenshot for A vs B comparison."
            accept="image/*"
            loadedName={assetB?.label}
            previewSrc={assetB?.dataUrl}
            onPick={(file) => onImagePick(file, 'B')}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-fg">Company standard text (optional)</span>
            <textarea
              value={companyStandardText}
              onChange={(e) => setCompanyStandardText(e.target.value)}
              placeholder="Paste brand system, design principles, UI standards, report layout requirements, etc."
              rows={6}
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
            />
          </label>

          <UploadDropzone
            title="UI Kit (optional)"
            hint="Supports image or text files. Text gets appended to standards input."
            accept="image/*,.txt,.md,.json"
            loadedName={standardImage?.label}
            previewSrc={standardImage?.dataUrl}
            onPick={onStandardFilePick}
          />
        </div>

        <label className="mt-4 block space-y-2 text-sm">
          <span className="font-medium text-fg">Extra context (optional)</span>
          <textarea
            value={contextNotes}
            onChange={(e) => setContextNotes(e.target.value)}
            placeholder="Example: this is a production dashboard for operations leads; key task is rapid anomaly detection."
            rows={3}
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void runAnalysis()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Analyzing…' : showCompare ? 'Analyze + compare' : 'Analyze design'}
          </button>
        </div>
      </section>

      {result ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface-raised/40 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Overall score</p>
                <p className={`font-display text-4xl font-semibold tracking-tight ${scoreTone(overallScore)}`}>
                  {overallScore}/100
                </p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>Verdict: {result.verdict}</p>
                <p>Model: {result.model}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-fg">{result.executiveSummary}</p>
            <p className="mt-2 text-xs text-muted">Standards: {result.standardsApplied}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {sortedCategories.map((cat) => {
              const score = clampScore(cat.score)
              return (
                <article key={cat.category} className="rounded-xl border border-border bg-surface-raised/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-fg">{cat.category}</h2>
                    <span className={`text-sm font-semibold ${scoreTone(score)}`}>{score}</span>
                  </div>
                  <p className="mt-2 text-sm text-fg">{cat.feedback}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">Strengths</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
                    {cat.strengths.slice(0, 3).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">Risks</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
                    {cat.risks.slice(0, 3).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>

          {result.comparison ? (
            <div className="rounded-xl border border-border bg-surface-raised/30 p-4">
              <h2 className="text-sm font-semibold text-fg">Comparison</h2>
              <p className="mt-1 text-sm text-fg">
                Better asset: <span className="font-semibold">{result.comparison.betterAsset}</span>
              </p>
              <p className="mt-2 text-sm text-fg">{result.comparison.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                {result.comparison.biggestDifferences.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-surface-raised/30 p-4">
            <h2 className="text-sm font-semibold text-fg">Recommendations</h2>
            <ul className="mt-2 space-y-2">
              {result.recommendations.map((rec) => (
                <li key={`${rec.priority}-${rec.title}`} className="rounded-lg border border-border/70 bg-canvas px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted">{rec.priority} priority</p>
                  <p className="text-sm font-medium text-fg">{rec.title}</p>
                  <p className="text-xs text-muted">{rec.action}</p>
                  <p className="mt-1 text-xs text-muted">Impact: {rec.expectedImpact}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  )
}
