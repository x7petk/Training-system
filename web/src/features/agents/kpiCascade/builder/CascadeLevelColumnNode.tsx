import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { ChevronDown, ChevronRight, Link2, Trash2 } from 'lucide-react'
import type { CascadeMetric, CascadeMetricGroup } from '../cascadeTypes'
import { kpiLabel, kpiMeasure, metricsInGroup, variancePct } from '../cascadeUtils'
import type { KpiCascadeKpi, KpiCascadeLevel } from '../types'

export type LevelColumnNodeData = {
  level: KpiCascadeLevel
  groups: CascadeMetricGroup[]
  metrics: CascadeMetric[]
  kpis: KpiCascadeKpi[]
  linkMode: boolean
  linkSourceId: string | null
  selectedMetricIds: Set<string>
  onSelectMetric: (metricId: string) => void
  onUpdateMetric: (metricId: string, patch: Partial<CascadeMetric>) => void
  onDeleteMetric: (metricId: string) => void
  onStartLink: (metricId: string) => void
  onToggleGroup: (groupId: string) => void
  onUpdateGroup: (groupId: string, patch: Partial<CascadeMetricGroup>) => void
  onDeleteGroup: (groupId: string) => void
}

function MetricRow({
  metric,
  kpis,
  linkMode,
  isLinkSource,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onStartLink,
}: {
  metric: CascadeMetric
  kpis: KpiCascadeKpi[]
  linkMode: boolean
  isLinkSource: boolean
  isSelected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<CascadeMetric>) => void
  onDelete: () => void
  onStartLink: () => void
}) {
  const name = kpiLabel(metric.kpiId, kpis)
  const measure = kpiMeasure(metric.kpiId, kpis)
  const pct = variancePct(metric.budget, metric.fact)
  const isPrimary = metric.kind === 'primary'
  const negative = pct !== null && pct < 0

  return (
    <div
      className={`relative rounded-md border px-2 py-1.5 transition ${
        isLinkSource
          ? 'border-accent bg-accent/10 ring-2 ring-accent/30'
          : isSelected
            ? 'border-accent/60 bg-accent/5'
            : isPrimary
              ? 'border-border bg-canvas'
              : 'border-dashed border-border/70 bg-surface-raised/40'
      }`}
    >
      <Handle type="target" position={Position.Left} id={metric.id} className="!h-2 !w-2 !border-accent !bg-accent" />
      {isPrimary ? (
        <Handle type="source" position={Position.Right} id={metric.id} className="!h-2 !w-2 !border-accent !bg-accent" />
      ) : null}

      <div className="flex items-start gap-1.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-0.5 rounded border-border"
          aria-label={`Select ${name}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-semibold text-fg">{name}</span>
            <span
              className={`shrink-0 rounded px-1 text-[9px] font-bold uppercase ${
                isPrimary ? 'bg-accent/15 text-accent' : 'text-muted'
              }`}
            >
              {isPrimary ? 'P' : 'S'}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] tabular-nums text-fg">
            {metric.budget}
            {measure ? ` ${measure}` : ''} / {metric.fact}
            {pct !== null ? (
              <span className={negative ? ' text-rose-600' : ' text-emerald-600'}>
                {' '}
                ({pct > 0 ? '+' : ''}
                {pct.toFixed(1)}%)
              </span>
            ) : null}
          </p>
          {metric.impactNote ? (
            <p className={`text-[10px] ${negative ? 'text-rose-600' : 'text-emerald-600'}`}>{metric.impactNote}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-1">
            <input
              type="number"
              value={metric.budget}
              onChange={(e) => onUpdate({ budget: Number(e.target.value) || 0 })}
              className="w-14 rounded border border-border bg-canvas px-1 py-0.5 text-[10px]"
              title="Budget"
            />
            <input
              type="number"
              value={metric.fact}
              onChange={(e) => onUpdate({ fact: Number(e.target.value) || 0 })}
              className="w-14 rounded border border-border bg-canvas px-1 py-0.5 text-[10px]"
              title="Fact"
            />
            <input
              type="text"
              value={metric.impactNote ?? ''}
              onChange={(e) => onUpdate({ impactNote: e.target.value })}
              placeholder="Impact note"
              className="min-w-0 flex-1 rounded border border-border bg-canvas px-1 py-0.5 text-[10px]"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col">
          {isPrimary ? (
            <button
              type="button"
              onClick={onStartLink}
              className={`rounded p-0.5 ${linkMode && isLinkSource ? 'bg-accent text-white' : 'text-muted hover:text-accent'}`}
              title="Link to lower level"
            >
              <Link2 className="size-3" />
            </button>
          ) : null}
          <button type="button" onClick={onDelete} className="rounded p-0.5 text-muted hover:text-rose-600">
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

export const CascadeLevelColumnNode = memo(function CascadeLevelColumnNode({
  data,
}: {
  data: LevelColumnNodeData
}) {
  const d = data

  return (
    <div className="w-[18rem] rounded-xl border border-border bg-white shadow-md dark:bg-surface-raised">
      <header className="rounded-t-xl border-b border-border bg-slate-50 px-3 py-2 dark:bg-canvas">
        <h3 className="text-sm font-semibold text-fg">KPI {d.level.code ?? d.level.name}</h3>
        <p className="text-[10px] text-muted">Budget / Fact</p>
      </header>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
        {d.groups.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">No cards</p>
        ) : (
          d.groups.map((group) => {
            const groupMetrics = metricsInGroup(d.metrics, group.id)
            return (
              <div key={group.id} className="overflow-hidden rounded-lg border border-border bg-canvas/80">
                <div className="flex items-center gap-1 border-b border-border/60 bg-surface-raised/50 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => d.onToggleGroup(group.id)}
                    className="rounded p-0.5 text-muted hover:bg-black/[0.05]"
                    aria-expanded={!group.collapsed}
                  >
                    {group.collapsed ? (
                      <ChevronRight className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={group.title}
                    onChange={(e) => d.onUpdateGroup(group.id, { title: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-fg focus:outline-none"
                  />
                  <span className="text-[10px] text-muted">{groupMetrics.length}</span>
                  <button
                    type="button"
                    onClick={() => d.onDeleteGroup(group.id)}
                    className="rounded p-0.5 text-muted hover:text-rose-600"
                    aria-label="Delete card"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                {!group.collapsed ? (
                  <div className="space-y-1.5 p-1.5">
                    {groupMetrics.length === 0 ? (
                      <p className="py-2 text-center text-[10px] text-muted">Empty card</p>
                    ) : (
                      groupMetrics.map((metric) => (
                        <MetricRow
                          key={metric.id}
                          metric={metric}
                          kpis={d.kpis}
                          linkMode={d.linkMode}
                          isLinkSource={d.linkSourceId === metric.id}
                          isSelected={d.selectedMetricIds.has(metric.id)}
                          onSelect={() => d.onSelectMetric(metric.id)}
                          onUpdate={(patch) => d.onUpdateMetric(metric.id, patch)}
                          onDelete={() => d.onDeleteMetric(metric.id)}
                          onStartLink={() => d.onStartLink(metric.id)}
                        />
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})
