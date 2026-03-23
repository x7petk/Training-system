import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { SetupBanner } from '../components/SetupBanner'
import { supabaseConfigured } from '../lib/supabase'

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setPending(true)
    const { error: err } = await signUp(email.trim(), password, displayName.trim())
    setPending(false)
    if (err) {
      setError(err.message)
      return
    }
    setInfo('Check your email to confirm, or sign in if confirmation is disabled.')
    setTimeout(() => navigate('/login', { replace: true }), 1600)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md shadow-glow">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight">Create your account</p>
          <p className="mt-1 text-sm text-muted">One short form — then you can sign in anytime.</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface-raised/80 p-6 backdrop-blur-md">
          {!supabaseConfigured ? <SetupBanner /> : null}

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Display name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 transition-[border-color,box-shadow] placeholder:text-muted/60 focus:border-accent/50 focus:ring-2"
                placeholder="Alex Morgan"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 transition-[border-color,box-shadow] placeholder:text-muted/60 focus:border-accent/50 focus:ring-2"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-canvas/60 px-3 py-2.5 text-sm outline-none ring-accent/40 transition-[border-color,box-shadow] placeholder:text-muted/60 focus:border-accent/50 focus:ring-2"
                placeholder="At least 8 characters"
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="rounded-lg bg-accent-dim px-3 py-2 text-sm text-accent" role="status">
                {info}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending || !supabaseConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-[transform,opacity] hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
            >
              {pending ? 'Creating…' : 'Create account'}
              <UserPlus className="size-4" aria-hidden />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
