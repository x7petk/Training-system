import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, Send, X } from 'lucide-react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { invokeReportAdvisorViaProxy } from '../../lib/reportAdvisorProxy'
import {
  type ReportAdvisorChartSpec,
  type ReportAdvisorContext,
  parseAdvisorChartsFromMarkdown,
} from './reportAdvisorContext'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

function AdvisorBarChart(props: { spec: ReportAdvisorChartSpec }) {
  const { spec } = props
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface p-3">
      <p className="mb-2 text-xs font-semibold text-fg">{spec.title}</p>
      <div className="h-48 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={spec.data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={56} />
            <YAxis width={32} tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v ?? '—', 'Count']} />
            <Bar dataKey="value" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AssistantBody(props: { content: string }) {
  const { text, charts } = parseAdvisorChartsFromMarkdown(props.content)
  return (
    <div className="space-y-2">
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{text}</div>
      {charts.map((c, i) => (
        <AdvisorBarChart key={`${c.title}-${i}`} spec={c} />
      ))}
    </div>
  )
}

export function MatrixReportAdvisor(props: {
  context: ReportAdvisorContext
  allowSend: boolean
}) {
  const { context, allowSend } = props
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [invokeError, setInvokeError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, sending])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || sending || !allowSend) return
    if (!supabaseConfigured) {
      setInvokeError('Supabase is not configured in this build.')
      return
    }

    setInput('')
    setInvokeError(null)
    const next: ChatMsg[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setSending(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) {
        setInvokeError('You must be signed in to use the report advisor.')
        setSending(false)
        return
      }

      try {
        JSON.stringify({ messages: next, context })
      } catch {
        setInvokeError('Could not serialise report data for the advisor.')
        setSending(false)
        return
      }

      const token = sessionData.session.access_token

      const { data, errorMessage } = await invokeReportAdvisorViaProxy(token, {
        messages: next,
        context,
      })
      if (errorMessage) {
        setInvokeError(errorMessage)
        setSending(false)
        return
      }
      if (data?.error) {
        setInvokeError(data.detail ? `${data.error}: ${data.detail}` : data.error)
        setSending(false)
        return
      }
      const content = data?.content?.trim() || 'No response text returned.'
      setMessages((prev) => [...prev, { role: 'assistant', content }])
    } catch (e) {
      setInvokeError(String(e))
    } finally {
      setSending(false)
    }
  }, [allowSend, context, input, messages, sending])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[45] flex size-14 items-center justify-center rounded-full border border-sky-400/50 bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-900/25 transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50"
        aria-label="Open skill report advisor"
        title="Skill report advisor"
      >
        <MessageCircle className="size-7" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[50] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Skill report advisor"
        >
          <div className="flex h-[min(80vh,720px)] w-[min(96vw,80vw)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-gradient-to-r from-sky-500/12 via-transparent to-indigo-500/10 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                  <Bot className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold tracking-tight text-fg sm:text-lg">Skill report advisor</h2>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    Read-only assistant for this page&apos;s data (gaps, training completions, L2→3 events, plans). It cannot
                    change the database. Charts appear when the model includes an{' '}
                    <code className="rounded bg-black/5 px-1 text-[10px]">advisor-chart</code> block.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-black/[0.05] hover:text-fg"
                aria-label="Close advisor"
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-canvas/50 px-3 py-4 text-sm text-muted">
                  <p className="font-medium text-fg">Try asking, for example:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                    <li>Who most needs L1→2 training in the current filters?</li>
                    <li>Summarise gaps by role and suggest a two-week training focus.</li>
                    <li>Who looks ready for L2→3 assessment?</li>
                    <li>Which week had the most passed training completions?</li>
                  </ul>
                  {!allowSend ? (
                    <p className="mt-3 text-xs font-medium text-amber-800">Wait for the report to finish loading.</p>
                  ) : null}
                  {!supabaseConfigured ? (
                    <p className="mt-2 text-xs font-medium text-amber-800">Supabase environment variables are missing.</p>
                  ) : null}
                </div>
              ) : null}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[min(100%,42rem)] rounded-2xl border px-3 py-2.5 text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'ml-auto border-sky-200/80 bg-sky-50/90 text-sky-950'
                      : 'mr-auto border-border bg-surface text-fg'
                  }`}
                >
                  {m.role === 'assistant' ? <AssistantBody content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                </div>
              ))}

              {sending ? (
                <p className="text-xs text-muted" aria-live="polite">
                  Thinking…
                </p>
              ) : null}

              {invokeError ? (
                <p className="rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-xs text-amber-950">{invokeError}</p>
              ) : null}
            </div>

            <footer className="shrink-0 border-t border-border bg-surface/90 px-3 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                  Your question
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={2}
                    disabled={!allowSend || sending}
                    placeholder={
                      allowSend ? 'Ask about trainings, gaps, assessments, or trends…' : 'Loading report…'
                    }
                    className="mt-1 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-fg outline-none ring-accent/25 focus:border-accent/40 focus:ring-2 disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void send()
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!allowSend || sending || !input.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40 sm:self-stretch"
                >
                  <Send className="size-4" aria-hidden />
                  Send
                </button>
              </div>
              <p className="mt-2 text-[10px] text-muted">
                Snapshot updates when you refresh the report or change filters. Requests go through{' '}
                <code className="rounded bg-black/5 px-0.5">/api/report-advisor</code> to your Supabase Edge Function (OpenAI
                key stays on the server). Do not paste secrets here.
              </p>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}
