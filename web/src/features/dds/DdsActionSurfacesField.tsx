import type { DdsActionUiSurfaceKey } from './ddsActionSurfaces'
import { DDS_ACTION_UI_SURFACE_KEYS, DDS_ACTION_UI_SURFACE_LABELS } from './ddsActionSurfaces'

type Props = {
  selected: readonly DdsActionUiSurfaceKey[]
  onChange: (next: DdsActionUiSurfaceKey[]) => void
  disabled?: boolean
  idPrefix?: string
  /** Optional extra wrapper classes */
  className?: string
}

export function DdsActionSurfacesField({ selected, onChange, disabled, idPrefix = 'dds-surf', className }: Props) {
  const set = new Set(selected)
  const toggle = (key: DdsActionUiSurfaceKey, on: boolean) => {
    const next = new Set(set)
    if (on) next.add(key)
    else next.delete(key)
    onChange(DDS_ACTION_UI_SURFACE_KEYS.filter((k) => next.has(k)))
  }

  return (
    <fieldset className={className}>
      <legend className="text-xs font-medium text-muted">Show on DDS pages</legend>
      <p className="mt-0.5 text-[10px] leading-snug text-muted/90">Choose one or more. Unchecked pages will not list this action.</p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {DDS_ACTION_UI_SURFACE_KEYS.map((key) => {
          const id = `${idPrefix}-${key}`
          return (
            <label key={key} htmlFor={id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-fg">
              <input
                id={id}
                type="checkbox"
                className="rounded border-border"
                checked={set.has(key)}
                disabled={disabled}
                onChange={(e) => toggle(key, e.target.checked)}
              />
              <span>{DDS_ACTION_UI_SURFACE_LABELS[key]} DDS</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
