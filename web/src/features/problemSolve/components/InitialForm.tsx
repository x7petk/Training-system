import type { ChecklistItem, InitialMethod, SixW2H } from '../types'
import { METHOD_LABELS, MOCK_ASSETS, lossTypeById } from '../mockData'
import type { LossTypeId } from '../types'

const SIX_FIELDS: { key: keyof SixW2H; label: string; placeholder: string }[] = [
  { key: 'what', label: 'What', placeholder: 'What is the problem / deviation?' },
  { key: 'where', label: 'Where', placeholder: 'Asset, area, location' },
  { key: 'when', label: 'When', placeholder: 'When did it start / last good?' },
  { key: 'who', label: 'Who', placeholder: 'Who found it / is affected?' },
  { key: 'which', label: 'Which', placeholder: 'Which product, SKU, mode?' },
  { key: 'why', label: 'Why (initial)', placeholder: 'Why do we think this happened? (hypothesis)' },
  { key: 'how', label: 'How', placeholder: 'How was it discovered / how does it fail?' },
  { key: 'howMuch', label: 'How much', placeholder: 'Impact: minutes, units, scrap, $' },
]

export function InitialForm(props: {
  method: InitialMethod
  lossTypeId: LossTypeId | null
  assetId: string | null
  sixW2H: SixW2H
  checklist: ChecklistItem[]
  onChangeSix: (next: SixW2H) => void
  onChangeAsset: (assetId: string) => void
  onChangeChecklist: (items: ChecklistItem[]) => void
  onContinue: () => void
  onBack: () => void
}) {
  const lt = lossTypeById(props.lossTypeId)
  const asset = MOCK_ASSETS.find((a) => a.id === props.assetId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Initial problem solve</p>
          <h2 className="font-display text-xl font-semibold text-fg">{METHOD_LABELS[props.method]}</h2>
          {lt ? (
            <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${lt.border} ${lt.bg} ${lt.color}`}>
              {lt.label}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-fg"
        >
          Back
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="font-display text-sm font-semibold">6W-2H problem framing</h3>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-muted">Asset</span>
            <select
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
              value={props.assetId ?? ''}
              onChange={(e) => props.onChangeAsset(e.target.value)}
            >
              <option value="">Select asset…</option>
              {MOCK_ASSETS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.area})
                </option>
              ))}
            </select>
          </label>
          {asset ? (
            <p className="rounded-lg bg-surface-raised px-3 py-2 text-xs text-muted">
              Centerline: <span className="text-fg">{asset.centerline}</span>
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {SIX_FIELDS.map((f) => (
              <label key={f.key} className={`block space-y-1 text-sm ${f.key === 'what' ? 'sm:col-span-2' : ''}`}>
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">{f.label}</span>
                <textarea
                  rows={f.key === 'what' ? 2 : 2}
                  className="w-full resize-y rounded-lg border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder={f.placeholder}
                  value={props.sixW2H[f.key]}
                  onChange={(e) => props.onChangeSix({ ...props.sixW2H, [f.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="font-display text-sm font-semibold">Initial method checklist</h3>
          <p className="text-xs text-muted">AI-suggested checks — mark status and add notes.</p>
          <ul className="space-y-2">
            {props.checklist.map((item, idx) => (
              <li key={item.id} className="rounded-xl border border-border bg-canvas px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-fg">{item.label}</p>
                    {item.hint ? <p className="text-xs text-muted">{item.hint}</p> : null}
                  </div>
                  <select
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                    value={item.status}
                    onChange={(e) => {
                      const next = [...props.checklist]
                      next[idx] = { ...item, status: e.target.value as ChecklistItem['status'] }
                      props.onChangeChecklist(next)
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="ok">OK</option>
                    <option value="fail">Fail / gap</option>
                    <option value="na">N/A</option>
                  </select>
                </div>
                <input
                  className="mt-1.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs"
                  placeholder="Note…"
                  value={item.note}
                  onChange={(e) => {
                    const next = [...props.checklist]
                    next[idx] = { ...item, note: e.target.value }
                    props.onChangeChecklist(next)
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onContinue}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-95"
        >
          Continue to AI refocus & experts
        </button>
      </div>
    </div>
  )
}
