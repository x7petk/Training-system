import { useId } from 'react'
import type { WdsWeekSlot } from './ddsWds'

export type WdsChartTone = 'neutral' | 'good' | 'bad' | 'warn'

export type WdsTrendSeries = {
  valueByWeek: (number | null)[]
  targetByWeek: (number | null)[]
  toneByWeek: WdsChartTone[]
  commentCountByWeek: number[]
}

const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const tickFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

export function wdsToneTextClass(tone: WdsChartTone): string {
  if (tone === 'good') return 'text-emerald-700 dark:text-emerald-300'
  if (tone === 'bad') return 'text-rose-700 dark:text-rose-300'
  if (tone === 'warn') return 'text-amber-700 dark:text-amber-300'
  return 'text-sky-700 dark:text-sky-300'
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  if (n <= 1) return pow
  if (n <= 2) return 2 * pow
  if (n <= 5) return 5 * pow
  return 10 * pow
}

function linePath(values: (number | null)[], xAt: (index: number) => number, yAt: (value: number) => number): string {
  let d = ''
  let penDown = false
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v == null || !Number.isFinite(v)) {
      penDown = false
      continue
    }
    const x = xAt(i)
    const y = yAt(v)
    d += `${penDown ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `
    penDown = true
  }
  return d.trim()
}

function barFill(tone: WdsChartTone): string {
  if (tone === 'good') return '#10b981'
  if (tone === 'bad') return '#f43f5e'
  if (tone === 'warn') return '#f59e0b'
  return '#0ea5e9'
}

export function WdsTrendChart({
  series,
  weeks,
  compact = true,
  onChartClick,
  onBarClick,
}: {
  series: WdsTrendSeries
  weeks: WdsWeekSlot[]
  compact?: boolean
  onChartClick?: () => void
  onBarClick?: (weekIndex: number) => void
}) {
  const clipId = useId().replace(/:/g, '')
  const width = compact ? 320 : 1080
  const height = compact ? 86 : 560
  const margin = compact ? { top: 6, right: 6, bottom: 14, left: 26 } : { top: 16, right: 20, bottom: 38, left: 58 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const allVals = [...series.valueByWeek, ...series.targetByWeek].filter((v): v is number => v != null && Number.isFinite(v))
  const fallbackMin = 0
  const fallbackMax = 100
  const rawMin = allVals.length > 0 ? Math.min(...allVals) : fallbackMin
  const rawMax = allVals.length > 0 ? Math.max(...allVals) : fallbackMax
  const spread = Math.max(1, Math.abs(rawMax - rawMin))
  const paddedMin = Math.max(0, rawMin - spread * 0.15)
  const paddedMax = Math.min(100, rawMax + spread * 0.15)
  const step = niceStep((paddedMax - paddedMin) / 4)
  const niceMin = Math.floor(paddedMin / step) * step
  const niceMax = Math.ceil(paddedMax / step) * step
  const yTicks = [niceMin, niceMin + (niceMax - niceMin) / 2, niceMax]
  const xAt = (i: number) => margin.left + (i * plotW) / Math.max(1, weeks.length - 1)
  const yAt = (v: number) => margin.top + ((niceMax - v) / Math.max(1e-9, niceMax - niceMin)) * plotH
  const targetPath = linePath(series.targetByWeek, xAt, yAt)
  const baselineValue = niceMin <= 0 && niceMax >= 0 ? 0 : niceMin
  const yBase = yAt(baselineValue)
  const barBand = plotW / Math.max(1, weeks.length)
  const baseBarW = Math.max(3, Math.min(compact ? 12 : 20, barBand * 0.58))
  const barW = compact ? baseBarW : Math.min(40, baseBarW * 2)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`${compact ? 'h-[5.25rem]' : 'h-full min-h-[22rem]'} w-full rounded border border-border/70 bg-surface-raised/20`}
      onClick={onChartClick}
    >
      <defs>
        <clipPath id={`clip-${clipId}`}>
          <rect x={margin.left} y={margin.top} width={plotW} height={plotH} />
        </clipPath>
      </defs>

      {yTicks.map((t) => (
        <g key={`y-${t}`}>
          <line x1={margin.left} y1={yAt(t)} x2={margin.left + plotW} y2={yAt(t)} stroke="currentColor" opacity="0.1" />
          <text x={margin.left - (compact ? 4 : 8)} y={yAt(t) + 3} textAnchor="end" className={`fill-muted ${compact ? 'text-[7px]' : 'text-[11px]'}`}>
            {tickFmt.format(t)}
          </text>
        </g>
      ))}

      {weeks.map((w, i) => (
        <g key={`${w.startYmd}-x`}>
          <line x1={xAt(i)} y1={margin.top} x2={xAt(i)} y2={margin.top + plotH} stroke="currentColor" opacity={i % 3 === 0 ? 0.06 : 0.02} />
          {compact ? i === 0 || i === Math.floor((weeks.length - 1) / 2) || i === weeks.length - 1 : i % 2 === 0 || i === weeks.length - 1 ? (
            <text x={xAt(i)} y={height - (compact ? 4 : 10)} textAnchor="middle" className={`fill-muted ${compact ? 'text-[7px]' : 'text-[10px]'}`}>
              {w.shortLabel}
            </text>
          ) : null}
        </g>
      ))}

      <g clipPath={`url(#clip-${clipId})`}>
        {series.valueByWeek.map((v, i) => {
          if (v == null || !Number.isFinite(v)) return null
          const tone = series.toneByWeek[i] ?? 'neutral'
          const fill = barFill(tone)
          const xCenter = xAt(i)
          const yVal = yAt(v)
          const top = Math.min(yVal, yBase)
          const h = Math.max(1, Math.abs(yVal - yBase))
          return (
            <g key={`bar-${i}`}>
              <rect
                x={xCenter - barW / 2}
                y={top}
                width={barW}
                height={h}
                rx={compact ? '1.5' : '2.5'}
                fill={fill}
                opacity="0.8"
                className={onBarClick ? 'cursor-pointer hover:opacity-100' : undefined}
                onClick={(e) => {
                  if (!onBarClick) return
                  e.stopPropagation()
                  onBarClick(i)
                }}
              />
              {series.commentCountByWeek[i]! > 0 ? (
                <circle
                  cx={xCenter}
                  cy={Math.max(margin.top + 3, top - 3)}
                  r={compact ? 1.6 : 3}
                  fill="#f59e0b"
                  stroke="#78350f"
                  strokeWidth={compact ? '0.3' : '0.8'}
                  className={onBarClick ? 'cursor-pointer' : undefined}
                  onClick={(e) => {
                    if (!onBarClick) return
                    e.stopPropagation()
                    onBarClick(i)
                  }}
                />
              ) : null}
              <text
                x={xCenter}
                y={Math.max(margin.top + (compact ? 4 : 10), top - (compact ? 1.2 : 4))}
                textAnchor="middle"
                className={`fill-fg/80 tabular-nums ${compact ? 'text-[6.5px]' : 'text-[10px]'} pointer-events-none`}
              >
                {compact ? tickFmt.format(v) : compactFmt.format(v)}
              </text>
            </g>
          )
        })}
        {targetPath ? (
          <path d={targetPath} fill="none" stroke="#2563eb" strokeWidth={compact ? '1.2' : '2.2'} strokeDasharray={compact ? '3 2' : '6 3'} />
        ) : null}
      </g>
    </svg>
  )
}
