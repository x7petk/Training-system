import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { callBmsBrainAi } from '../features/bmsBrain/bmsBrainAiProxy'
import { useBmsBrainFullCatalog } from '../features/bmsBrain/useBmsBrainCatalog'

type Tab = 'role' | 'system' | 'knowledge'

export function BmsBrainAiPage() {
  const catalog = useBmsBrainFullCatalog()
  const [tab, setTab] = useState<Tab>('role')
  const [roleId, setRoleId] = useState('')
  const [systemId, setSystemId] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await callBmsBrainAi({
        mode: tab,
        roleId: tab === 'role' ? roleId || null : null,
        systemId: tab === 'system' ? systemId || null : null,
        question: tab === 'knowledge' ? question : undefined,
      })
      setAnswer(res.answer)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <Sparkles className="size-5 text-accent" aria-hidden />
          AI Insights
        </h1>
        <p className="mt-1 text-sm text-muted">
          Summaries grounded only in BMS Brain catalog and published process data.
        </p>
      </header>

      <div className="flex gap-2">
        {(
          [
            ['role', 'Role summary'],
            ['system', 'System summary'],
            ['knowledge', 'Knowledge bot'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              tab === id ? 'bg-accent text-white' : 'border border-border text-muted hover:text-fg',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface-raised/50 p-4 space-y-3">
        {tab === 'role' ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Role</span>
            <select
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">Select role…</option>
              {catalog.roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {tab === 'system' ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium">System / tool</span>
            <select
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2"
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
            >
              <option value="">Select system…</option>
              {catalog.systems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {tab === 'knowledge' ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Question</span>
            <textarea
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2"
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about roles, forums, systems, or process steps…"
            />
          </label>
        ) : null}

        <button
          type="button"
          disabled={loading || (tab === 'role' && !roleId) || (tab === 'system' && !systemId) || (tab === 'knowledge' && !question.trim())}
          onClick={() => void run()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate
        </button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {answer ? (
        <div className="rounded-2xl border border-border bg-white p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {answer}
        </div>
      ) : null}
    </div>
  )
}
