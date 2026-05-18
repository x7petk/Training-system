import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  activeAdminItems,
  activeOwners,
  defaultEPlanAdmin,
  loadEPlanAdmin,
  saveEPlanAdmin,
} from '../features/eplan/eplanAdminService'
import type { EPlanAdminItem, EPlanAdminStore, EPlanOwner } from '../features/eplan/eplanTypes'
import { ddsBtn, ddsBtnDanger, ddsBtnGhost, ddsErr, ddsHint, ddsInput, ddsInset, ddsSection, ddsStack, ddsH2 } from '../features/dds/ddsAdminCompactClasses'

type ListKey = 'ogsmPillars' | 'forums' | 'labels' | 'lossTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function newItem(name = ''): EPlanAdminItem {
  const t = nowIso()
  return { id: crypto.randomUUID(), name, isActive: true, createdAt: t, updatedAt: t }
}

function newOwner(name = ''): EPlanOwner {
  const t = nowIso()
  return { id: crypto.randomUUID(), name, isActive: true, createdAt: t, updatedAt: t }
}

function ItemList({
  title,
  items,
  onChange,
}: {
  title: string
  items: EPlanAdminItem[]
  onChange: (items: EPlanAdminItem[]) => void
}) {
  return (
    <section className={ddsSection}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={ddsH2}>{title}</h2>
        <button type="button" className={ddsBtnGhost} onClick={() => onChange([...items, newItem('New item')])}>
          <Plus className="size-3.5" aria-hidden />
          Add
        </button>
      </div>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className={ddsInset}>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1 text-[10px] font-medium text-muted">
                Name
                <input
                  className={ddsInput}
                  value={item.name}
                  onChange={(e) =>
                    onChange(items.map((x) => (x.id === item.id ? { ...x, name: e.target.value, updatedAt: nowIso() } : x)))
                  }
                />
              </label>
              <label className="flex shrink-0 items-end gap-1 pb-1 text-[10px] text-muted">
                <input
                  type="checkbox"
                  checked={item.isActive}
                  onChange={(e) =>
                    onChange(items.map((x) => (x.id === item.id ? { ...x, isActive: e.target.checked, updatedAt: nowIso() } : x)))
                  }
                />
                Active
              </label>
              <button
                type="button"
                className={ddsBtnDanger}
                aria-label="Remove"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DdsAdminEPlanSetupPage() {
  const [store, setStore] = useState<EPlanAdminStore>(() => loadEPlanAdmin())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (store.ogsmPillars.length === 0) {
      setStore(defaultEPlanAdmin())
    }
  }, [store.ogsmPillars.length])

  const setList = useCallback((key: ListKey, items: EPlanAdminItem[]) => {
    setStore((s) => ({ ...s, [key]: items }))
  }, [])

  const setOwners = useCallback((owners: EPlanOwner[]) => {
    setStore((s) => ({ ...s, owners }))
  }, [])

  function save() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    for (const key of ['ogsmPillars', 'forums', 'labels', 'lossTypes'] as const) {
      for (const item of store[key]) {
        if (!item.name.trim()) {
          setError(`Each ${key} entry needs a name.`)
          setSaving(false)
          return
        }
      }
    }
    for (const o of store.owners) {
      if (!o.name.trim()) {
        setError('Each owner needs a name.')
        setSaving(false)
        return
      }
    }
    saveEPlanAdmin(store)
    setSaving(false)
    setSuccess('Saved to browser storage.')
  }

  function resetDefaults() {
    if (!window.confirm('Reset e-Plan admin lists to defaults? This does not delete actions.')) return
    const next = defaultEPlanAdmin()
    setStore(next)
    saveEPlanAdmin(next)
    setSuccess('Reset to defaults.')
  }

  return (
    <div className={ddsStack}>
      <p className={ddsHint}>
        Configure OGSM categories, forums, labels, loss types, and action owners for e-Plan. Values are stored in this
        browser (local storage). Sites, plants, and cells come from Master Data.
      </p>
      {error ? <p className={ddsErr}>{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      <ItemList title="OGSM pillars" items={store.ogsmPillars} onChange={(items) => setList('ogsmPillars', items)} />
      <ItemList title="Forums" items={store.forums} onChange={(items) => setList('forums', items)} />
      <ItemList title="Labels" items={store.labels} onChange={(items) => setList('labels', items)} />
      <ItemList title="Loss types" items={store.lossTypes} onChange={(items) => setList('lossTypes', items)} />

      <section className={ddsSection}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={ddsH2}>Action owners</h2>
          <button type="button" className={ddsBtnGhost} onClick={() => setOwners([...store.owners, newOwner('New owner')])}>
            <Plus className="size-3.5" aria-hidden />
            Add
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {store.owners.map((o) => (
            <li key={o.id} className={ddsInset}>
              <div className="flex flex-wrap gap-2">
                <label className="min-w-[8rem] flex-1 text-[10px] font-medium text-muted">
                  Name
                  <input
                    className={ddsInput}
                    value={o.name}
                    onChange={(e) =>
                      setOwners(store.owners.map((x) => (x.id === o.id ? { ...x, name: e.target.value, updatedAt: nowIso() } : x)))
                    }
                  />
                </label>
                <label className="min-w-[10rem] flex-1 text-[10px] font-medium text-muted">
                  Email
                  <input
                    className={ddsInput}
                    value={o.email ?? ''}
                    onChange={(e) =>
                      setOwners(store.owners.map((x) => (x.id === o.id ? { ...x, email: e.target.value, updatedAt: nowIso() } : x)))
                    }
                  />
                </label>
                <label className="flex shrink-0 items-end gap-1 pb-1 text-[10px] text-muted">
                  <input
                    type="checkbox"
                    checked={o.isActive}
                    onChange={(e) =>
                      setOwners(store.owners.map((x) => (x.id === o.id ? { ...x, isActive: e.target.checked, updatedAt: nowIso() } : x)))
                    }
                  />
                  Active
                </label>
                <button type="button" className={ddsBtnDanger} aria-label="Remove" onClick={() => setOwners(store.owners.filter((x) => x.id !== o.id))}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-muted">
          Active owners: {activeOwners(store.owners).length} · Active OGSM: {activeAdminItems(store.ogsmPillars).length}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={ddsBtn} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={ddsBtnGhost} onClick={resetDefaults}>
          Reset defaults
        </button>
      </div>
    </div>
  )
}
