import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Check, Image as ImageIcon, Smartphone } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fileToJpegFile, IMAGE_ACCEPT, isProbablyImage } from '../features/agents/aiVideoCreator/imageFile'
import { uploadPhoneInboxPhoto } from '../features/agents/aiVideoCreator/phoneInbox'

export function AiVideoCreatorPhonePage() {
  const { user, loading } = useAuth()
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const libraryRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])

  async function sendFiles(list: FileList | null) {
    if (!user) {
      setError('Sign in on this phone with the same account as your computer.')
      return
    }
    const incoming = Array.from(list ?? []).filter(isProbablyImage)
    if (incoming.length === 0) {
      setError('Please choose a picture, or take one with the camera.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const names: string[] = []
      for (const file of incoming) {
        const jpeg = await fileToJpegFile(file)
        const row = await uploadPhoneInboxPhoto(user.id, jpeg)
        names.push(row.file_name)
      }
      setSent((prev) => [...names, ...prev].slice(0, 12))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 pb-10">
      <header>
        <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
          <Smartphone className="size-4" />
          Phone upload
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Add pictures</h1>
        <p className="mt-2 text-sm text-muted">
          Take a photo or pick from this phone. It appears on AI Video Creator on your computer if you are
          signed in with the same account.
        </p>
      </header>

      <input
        ref={cameraRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void sendFiles(e.target.files)
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
          void sendFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div className="grid gap-3">
        <button
          type="button"
          disabled={busy || !user}
          onClick={() => cameraRef.current?.click()}
          className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-accent px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
        >
          <Camera className="size-5" />
          {busy ? 'Sending…' : 'Take photo'}
        </button>
        <button
          type="button"
          disabled={busy || !user}
          onClick={() => libraryRef.current?.click()}
          className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border border-border bg-canvas px-4 py-4 text-base font-semibold text-fg disabled:opacity-60"
        >
          <ImageIcon className="size-5" />
          Photo library
        </button>
      </div>

      {loading ? <p className="text-sm text-muted">Checking your sign-in…</p> : null}
      {!loading && !user ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Sign in on this phone with the same account you use on the computer, then come back to this page.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {sent.length > 0 ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="inline-flex items-center gap-2 font-medium">
            <Check className="size-4" />
            Sent to your computer
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {sent.map((name, index) => (
              <li key={`${name}-${index}`}>{name}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-center text-sm">
        <Link to="/agents/ai-video-creator" className="text-accent underline-offset-2 hover:underline">
          Back to AI Video Creator
        </Link>
      </p>
    </div>
  )
}
