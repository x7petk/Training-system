import { memo } from 'react'
import { Link2, X } from 'lucide-react'
import type { CascadeMetricKind } from '../cascadeTypes'
import { forumLabel, kpiLabel, kpiMeasure } from '../cascadeUtils'
import type { KpiCascadeForum, KpiCascadeKpi } from '../types'

type TileMetric = {
  id: string
  kind: CascadeMetricKind
  budget: number
  fact: number
  impactNote?: string
  kpiId?: string
  forumId?: string
}

type Props = {
  metric: TileMetric
  kpis: KpiCascadeKpi[]
  forums: KpiCascadeForum[]
  isLinkSource: boolean
  isLinking: boolean
  draggable?: boolean
  onStartLink: () => void
  onCompleteLink?: () => void
  onDelete: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  registerRef: (el: HTMLDivElement | null) => void
}

export const CascadeMetricTile = memo(function CascadeMetricTile({
  metric,
  kpis,
  forums,
  isLinkSource,
  isLinking,
  draggable = false,
  onStartLink,
  onCompleteLink,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  registerRef,
}: Props) {
  const name = metric.forumId
    ? forumLabel(metric.forumId, forums)
    : kpiLabel(metric.kpiId ?? '', kpis)
  const measure = metric.kpiId ? kpiMeasure(metric.kpiId, kpis) : ''
  const isPrimary = metric.kind === 'primary'

  return (
    <div
      ref={registerRef}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-metric-id={metric.id}
      data-metric-primary={isPrimary ? '1' : '0'}
      className={`group relative flex min-h-[2.25rem] shrink-0 items-center rounded-md border border-[#d0d6df] bg-white px-2 py-1 shadow-sm transition ${
        draggable ? 'cursor-grab active:cursor-grabbing' : isLinking ? 'cursor-crosshair' : ''
      } ${
        isLinkSource ? 'ring-2 ring-[#2b6cb0]/60' : 'hover:border-[#aab2bd]'
      }`}
      onClick={() => {
        if (onCompleteLink) onCompleteLink()
      }}
    >
      <span
        data-link-in
        className="pointer-events-none absolute right-0 top-1/2 size-1 translate-x-1/2 -translate-y-1/2"
        aria-hidden
      />
      {isPrimary ? (
        <span
          data-link-out
          className="pointer-events-none absolute left-0 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        />
      ) : null}

      <div className="flex min-h-0 w-full items-center justify-between gap-1 pr-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] leading-tight text-[#1a1a1a]">
            <span className="font-semibold">{name}</span>
            {measure ? <span className="font-medium text-[#5c6570]">, {measure}</span> : null}
          </p>
        </div>
        <div className="absolute right-1 top-1/2 flex shrink-0 -translate-y-1/2 gap-0.5 opacity-0 transition group-hover:opacity-100">
          {isPrimary ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onStartLink()
              }}
              className={`rounded p-0.5 ${
                isLinkSource ? 'bg-[#2b6cb0] text-white' : 'text-[#8a939e] hover:text-[#2b6cb0]'
              }`}
              title={
                isLinkSource
                  ? 'Cancel linking (Esc)'
                  : 'Link to a block on the left'
              }
            >
              <Link2 className="size-3" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="rounded p-0.5 text-[#8a939e] hover:text-[#c53030]"
            aria-label={`Remove ${name}`}
          >
            <X className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
})
