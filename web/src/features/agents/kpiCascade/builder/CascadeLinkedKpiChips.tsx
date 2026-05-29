import type { CascadeKpiOverlayItem } from '../cascadeTypes'

type Props = {
  items: CascadeKpiOverlayItem[]
}

export function CascadeLinkedKpiChips({ items }: Props) {
  if (items.length === 0) return null

  return (
    <div className="mt-1 space-y-0.5 border-t border-dashed border-[#c5cad3] pt-1">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-[#8a939e]">Linked KPIs</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li
            key={item.metricId}
            className={`rounded border px-1.5 py-0.5 text-[10px] leading-tight ${
              item.isFocus
                ? 'border-accent/50 bg-accent/10 font-semibold text-[#1a365d]'
                : 'border-[#d4d9e0] bg-white text-[#333]'
            }`}
          >
            <span className="block truncate">{item.label}</span>
            <span className="text-[9px] text-[#5c6570]">
              {item.measure ? `${item.measure} · ` : ''}
              B {item.budget} / F {item.fact}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
