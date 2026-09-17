import { useCallback, useMemo, useState } from 'react'
import { Lightbulb, RotateCcw } from 'lucide-react'
import { ChatEntry } from './components/ChatEntry'
import { EvidenceHub } from './components/EvidenceHub'
import { InitialForm } from './components/InitialForm'
import { ManualMethodPicker } from './components/ManualMethodPicker'
import {
  AdvancedStage,
  CloseTheLoop,
  DecisionStage,
  RefocusStage,
} from './components/RefocusAndClose'
import { StageProgress } from './components/StageProgress'
import {
  METHOD_LABELS,
  MOCK_ASSETS,
  MOCK_DEFECTS,
  LOSS_TYPES,
  defaultChecklist,
  defaultCloseSteps,
  emptySixW2H,
  lossTypeById,
  mockEvidenceForAsset,
  mockExpertsForMethod,
} from './mockData'
import {
  callProblemSolveAi,
  heuristicNavigate,
  heuristicRefocus,
} from './problemSolveAi'
import type {
  ActionItem,
  AiNavigateResponse,
  AiRefocusResponse,
  AttachmentMeta,
  ChatMessage,
  ChatSuggestedAction,
  ChecklistItem,
  CloseLoopStep,
  ExpertFeedback,
  InitialMethod,
  LossTypeId,
  NavigatorStage,
  SixW2H,
} from './types'

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function matchAssetId(name: string): string | null {
  const n = name.toLowerCase()
  const hit = MOCK_ASSETS.find(
    (a) => n.includes(a.name.toLowerCase()) || n.includes(a.id) || n.includes(a.type.toLowerCase()),
  )
  return hit?.id ?? null
}

export function LossNavigatorPage() {
  const [stage, setStage] = useState<NavigatorStage>('identify')
  const [showManual, setShowManual] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])

  const [problemStatement, setProblemStatement] = useState('')
  const [assetId, setAssetId] = useState<string | null>(null)
  const [assetName, setAssetName] = useState('')
  const [area, setArea] = useState('')
  const [lossTypeId, setLossTypeId] = useState<LossTypeId | null>(null)
  const [initialMethod, setInitialMethod] = useState<InitialMethod | null>(null)
  const [sixW2H, setSixW2H] = useState<SixW2H>(emptySixW2H())
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [evidence, setEvidence] = useState(mockEvidenceForAsset(null, ''))
  const [evidenceLoading, setEvidenceLoading] = useState(false)

  const [refocusStatement, setRefocusStatement] = useState('')
  const [known, setKnown] = useState<string[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [narrowedScope, setNarrowedScope] = useState('')
  const [experts, setExperts] = useState<ExpertFeedback[]>([])
  const [refocusLoading, setRefocusLoading] = useState(false)
  const [recommendInHouse, setRecommendInHouse] = useState(true)
  const [rationale, setRationale] = useState('')
  const [actions, setActions] = useState<ActionItem[]>([])
  const [closeSteps, setCloseSteps] = useState<CloseLoopStep[]>(defaultCloseSteps())
  const [learning, setLearning] = useState('')
  const [doneBanner, setDoneBanner] = useState(false)

  const defects = useMemo(
    () => MOCK_DEFECTS.filter((d) => !assetId || d.assetId === assetId),
    [assetId],
  )

  const advancedLabel = useMemo(() => {
    const lt = lossTypeById(lossTypeId)
    return lt ? METHOD_LABELS[lt.advancedMethod] : 'Advanced method'
  }, [lossTypeId])

  const resetAll = () => {
    setStage('identify')
    setShowManual(false)
    setMessages([])
    setInput('')
    setSending(false)
    setAttachments([])
    setProblemStatement('')
    setAssetId(null)
    setAssetName('')
    setArea('')
    setLossTypeId(null)
    setInitialMethod(null)
    setSixW2H(emptySixW2H())
    setChecklist([])
    setEvidence(mockEvidenceForAsset(null, ''))
    setRefocusStatement('')
    setKnown([])
    setMissing([])
    setNarrowedScope('')
    setExperts([])
    setRecommendInHouse(true)
    setRationale('')
    setActions([])
    setCloseSteps(defaultCloseSteps())
    setLearning('')
    setDoneBanner(false)
  }

  const applyExtracted = useCallback((extracted: AiNavigateResponse['extracted']) => {
    if (!extracted) return
    if (extracted.problemStatement) setProblemStatement(extracted.problemStatement)
    if (extracted.assetName) {
      setAssetName(extracted.assetName)
      const id = matchAssetId(extracted.assetName)
      if (id) setAssetId(id)
    }
    if (extracted.area) setArea(extracted.area)
    if (extracted.lossTypeId) setLossTypeId(extracted.lossTypeId)
    if (extracted.initialMethod) {
      setInitialMethod(extracted.initialMethod)
      setChecklist(defaultChecklist(extracted.initialMethod))
    }
    if (extracted.sixW2H) {
      setSixW2H((prev) => ({ ...prev, ...extracted.sixW2H }))
    }
  }, [])

  const runEvidence = useCallback((aid: string | null, problem: string) => {
    setEvidenceLoading(true)
    window.setTimeout(() => {
      setEvidence(mockEvidenceForAsset(aid, problem))
      setEvidenceLoading(false)
    }, 600)
  }, [])

  const openForm = useCallback(
    (method: InitialMethod, lt?: LossTypeId | null) => {
      const resolvedLt = lt ?? lossTypeId
      const m = method
      setInitialMethod(m)
      if (resolvedLt) setLossTypeId(resolvedLt)
      setChecklist((prev) => (prev.length ? prev : defaultChecklist(m)))
      setSixW2H((prev) => ({
        ...prev,
        what: prev.what || problemStatement,
        where: prev.where || assetName,
        which: prev.which || (resolvedLt ? lossTypeById(resolvedLt)?.shortLabel || '' : prev.which),
      }))
      runEvidence(assetId, problemStatement)
      setStage('initial')
      setShowManual(false)
    },
    [assetId, assetName, lossTypeId, problemStatement, runEvidence],
  )

  const navigateAi = useCallback(
    async (userText: string, historyOverride?: ChatMessage[]) => {
      setSending(true)
      const history = historyOverride ?? messages
      try {
        let result: AiNavigateResponse
        try {
          result = (await callProblemSolveAi({
            mode: 'navigate',
            payload: {
              message: userText,
              history: history.map((m) => ({ role: m.role, content: m.content })),
              known: {
                problemStatement: problemStatement || userText,
                assetName,
                area,
                lossTypeId,
              },
              attachments: attachments.map((a) => ({ name: a.name, kind: a.kind })),
            },
          })) as AiNavigateResponse
        } catch {
          result = heuristicNavigate({
            message: userText,
            history: history.map((m) => ({ role: m.role, content: m.content })),
            known: { problemStatement: problemStatement || userText, assetName, area, lossTypeId },
          })
        }

        applyExtracted(result.extracted)
        if (result.extracted?.problemStatement || userText) {
          setProblemStatement((p) => p || result.extracted?.problemStatement || userText)
        }

        const aid =
          result.extracted?.assetName != null ? matchAssetId(result.extracted.assetName) : assetId
        if (result.runEvidenceChecks) runEvidence(aid, result.extracted?.problemStatement || userText)

        const assistant: ChatMessage = {
          id: uid('a'),
          role: 'assistant',
          content: result.reply,
          createdAt: new Date().toISOString(),
          suggestedActions: result.suggestedActions,
        }
        setMessages((prev) => [...prev, assistant])

        if (result.readyForForm && result.extracted?.initialMethod) {
          // Keep chat visible with open_form action — user confirms
        }
      } finally {
        setSending(false)
      }
    },
    [applyExtracted, area, assetId, assetName, attachments, lossTypeId, messages, problemStatement, runEvidence],
  )

  const handleSend = async () => {
    const text = input.trim()
    if (!text && !attachments.length) return
    const content =
      text +
      (attachments.length
        ? `\n\n[Attached: ${attachments.map((a) => a.name).join(', ')}]`
        : '')
    const userMsg: ChatMessage = {
      id: uid('u'),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setInput('')
    if (!problemStatement) setProblemStatement(text)
    await navigateAi(content, nextHistory)
  }

  const handleAction = async (a: ChatSuggestedAction) => {
    if (a.kind === 'skip_ai') {
      setShowManual(true)
      return
    }
    if (a.kind === 'open_form') {
      const method = (a.payload as InitialMethod) || initialMethod || 'IPS'
      openForm(method)
      return
    }
    if (a.kind === 'run_checks') {
      runEvidence(assetId, problemStatement)
      const assistant: ChatMessage = {
        id: uid('a'),
        role: 'assistant',
        content: 'Evidence hub updated from connected systems (mock). Review the panel, then open the form when ready.',
        createdAt: new Date().toISOString(),
        suggestedActions: [
          {
            id: 'open',
            label: `Open ${(initialMethod || 'IPS').replaceAll('_', ' ')} form`,
            kind: 'open_form',
            payload: initialMethod || 'IPS',
          },
        ],
      }
      setMessages((prev) => [...prev, assistant])
      return
    }
    if (a.kind === 'answer' || a.kind === 'continue') {
      const payload = a.payload || a.label
      const userMsg: ChatMessage = {
        id: uid('u'),
        role: 'user',
        content: payload,
        createdAt: new Date().toISOString(),
      }
      if (/^asset:/i.test(payload)) {
        const name = payload.replace(/^asset:\s*/i, '')
        setAssetName(name)
        setAssetId(matchAssetId(name))
      }
      if (/^loss type:/i.test(payload)) {
        const label = payload.replace(/^loss type:\s*/i, '').toLowerCase()
        const matched = LOSS_TYPES.find(
          (t) =>
            t.label.toLowerCase() === label ||
            t.shortLabel.toLowerCase() === label ||
            label.includes(t.shortLabel.toLowerCase()),
        )
        if (matched) {
          setLossTypeId(matched.id)
          setInitialMethod(matched.initialMethod)
        }
      }
      const nextHistory = [...messages, userMsg]
      setMessages(nextHistory)
      await navigateAi(payload, nextHistory)
    }
  }

  const handleAddFiles = (files: FileList | null) => {
    if (!files?.length) return
    const next: AttachmentMeta[] = Array.from(files).map((f) => ({
      id: uid('f'),
      name: f.name,
      kind: f.type.startsWith('image/') ? 'image' : 'document',
      sizeLabel: f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }))
    setAttachments((prev) => [...prev, ...next])
  }

  const runRefocus = async () => {
    setRefocusLoading(true)
    try {
      const checklistNotes = checklist
        .filter((c) => c.note || c.status !== 'pending')
        .map((c) => `${c.label}: ${c.status}${c.note ? ` — ${c.note}` : ''}`)
        .join('; ')
      let result: AiRefocusResponse
      try {
        result = (await callProblemSolveAi({
          mode: 'refocus',
          payload: {
            problemStatement,
            method: initialMethod || 'IPS',
            sixW2H,
            checklistNotes,
            evidence: evidence.map((e) => ({ source: e.source, title: e.title, detail: e.detail })),
          },
        })) as AiRefocusResponse
      } catch {
        result = heuristicRefocus({
          problemStatement,
          method: initialMethod || 'IPS',
          sixW2H,
          checklistNotes,
        })
      }
      setRefocusStatement(result.refocusStatement)
      setKnown(result.known || [])
      setMissing(result.missing || [])
      setNarrowedScope(result.narrowedScope || '')
      setExperts(result.expertFeedback?.length ? result.expertFeedback : mockExpertsForMethod(initialMethod || 'IPS', problemStatement))
      setRecommendInHouse(result.recommendInHouse !== false)
      setRationale(result.rationale || '')
      setActions(
        (result.suggestedActions || []).map((a) => ({
          ...a,
          id: a.id || uid('act'),
          status: a.status || 'open',
        })),
      )
    } finally {
      setRefocusLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-900">
              <Lightbulb className="size-5" aria-hidden />
            </span>
            Problem Solve
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Solve at the lowest capable level. Use AI to access facts, standards and expertise before escalating.
          </p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-fg"
        >
          <RotateCcw className="size-3.5" />
          New problem
        </button>
      </header>

      <StageProgress stage={stage} />

      {doneBanner ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Problem solve closed. Learning captured for the AI knowledge base. Start a new problem anytime.
        </div>
      ) : null}

      {stage === 'identify' && !showManual ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <ChatEntry
            messages={messages}
            input={input}
            sending={sending}
            attachments={attachments}
            onInput={setInput}
            onSend={() => void handleSend()}
            onAction={(a) => void handleAction(a)}
            onAddFiles={handleAddFiles}
            onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
            onSkipAi={() => setShowManual(true)}
          />
          <EvidenceHub items={evidence} defects={defects} loading={evidenceLoading} />
        </div>
      ) : null}

      {stage === 'identify' && showManual ? (
        <ManualMethodPicker
          onCancel={() => setShowManual(false)}
          onPick={(lt, method) => {
            setLossTypeId(lt)
            setProblemStatement((p) => p || input || 'Manual problem entry')
            setSixW2H((prev) => ({
              ...prev,
              what: prev.what || input || 'Manual problem entry',
              which: lossTypeById(lt)?.shortLabel || '',
            }))
            openForm(method, lt)
          }}
        />
      ) : null}

      {stage === 'initial' && initialMethod ? (
        <div className="space-y-4">
          <EvidenceHub items={evidence} defects={defects} loading={evidenceLoading} />
          <InitialForm
            method={initialMethod}
            lossTypeId={lossTypeId}
            assetId={assetId}
            sixW2H={sixW2H}
            checklist={checklist}
            onChangeSix={setSixW2H}
            onChangeAsset={(id) => {
              setAssetId(id || null)
              const a = MOCK_ASSETS.find((x) => x.id === id)
              if (a) {
                setAssetName(a.name)
                setArea(a.area)
                setSixW2H((prev) => ({ ...prev, where: a.name }))
                runEvidence(id, problemStatement)
              }
            }}
            onChangeChecklist={setChecklist}
            onBack={() => setStage('identify')}
            onContinue={() => {
              setStage('refocus')
              void runRefocus()
            }}
          />
        </div>
      ) : null}

      {stage === 'refocus' ? (
        <RefocusStage
          refocusStatement={refocusStatement}
          known={known}
          missing={missing}
          narrowedScope={narrowedScope}
          experts={experts}
          loading={refocusLoading}
          onRun={() => void runRefocus()}
          onContinue={() => setStage('decision')}
        />
      ) : null}

      {stage === 'decision' ? (
        <DecisionStage
          recommendInHouse={recommendInHouse}
          rationale={rationale}
          actions={actions}
          advancedMethodLabel={advancedLabel}
          onResolveInHouse={() => setStage('close')}
          onEscalate={() => setStage('advanced')}
          onToggleAction={(id) =>
            setActions((prev) =>
              prev.map((a) =>
                a.id === id ? { ...a, status: a.status === 'done' ? 'open' : 'done' } : a,
              ),
            )
          }
        />
      ) : null}

      {stage === 'advanced' ? (
        <AdvancedStage methodLabel={advancedLabel} onContinueClose={() => setStage('close')} />
      ) : null}

      {stage === 'close' ? (
        <CloseTheLoop
          steps={closeSteps}
          learning={learning}
          onToggle={(id) =>
            setCloseSteps((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)))
          }
          onNote={(id, note) =>
            setCloseSteps((prev) => prev.map((s) => (s.id === id ? { ...s, note } : s)))
          }
          onLearning={setLearning}
          onFinish={() => {
            setDoneBanner(true)
            if (!learning) {
              setLearning(
                `Problem: ${refocusStatement || problemStatement}. Method: ${initialMethod}. Actions completed on shift.`,
              )
            }
          }}
        />
      ) : null}
    </div>
  )
}
