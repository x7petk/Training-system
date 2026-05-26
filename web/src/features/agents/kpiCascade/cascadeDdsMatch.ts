export type DdsKpiOption = { id: string; label: string }

/** Normalize for label comparison */
export function normKpiKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cascade catalog name → common DDS admin label variants */
const CASCADE_ALIASES: Record<string, string[]> = {
  oee: ['overall equipment effectiveness', 'oee %', 'oee pct', 'equipment effectiveness'],
  volume: [
    'production volume',
    'output volume',
    'concentrate production volume',
    'output',
    'production output',
    'volume produced',
  ],
  unds: [
    'unplanned downtime',
    'unplanned ds',
    'unscheduled downtime',
    'unds min',
    'unplanned downtime min',
  ],
  pdt: ['planned downtime', 'planned dt', 'planned downtime min', 'pdt min'],
  rate: ['production rate', 'line rate', 'run rate', 'throughput'],
  stops: ['stop count', 'number of stops', 'stops count', '# stops'],
  bd: ['breakdown', 'breakdown time', 'breakdown min', 'bd min', 'breakdown duration'],
}

function tokenSet(s: string): Set<string> {
  return new Set(normKpiKey(s).split(' ').filter((t) => t.length > 1))
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = tokenSet(a)
  const tb = tokenSet(b)
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) {
    if (tb.has(t)) inter++
  }
  return inter / Math.max(ta.size, tb.size)
}

/**
 * Resolve a cascade KPI name (or explicit DDS id) to a `dds_kpis.id`.
 */
export function resolveDdsKpiId(
  cascadeName: string,
  explicitDdsKpiId: string | undefined,
  ddsKpis: DdsKpiOption[],
): string | undefined {
  if (!ddsKpis.length) return undefined

  const byId = new Map(ddsKpis.map((d) => [d.id, d]))
  if (explicitDdsKpiId && byId.has(explicitDdsKpiId)) return explicitDdsKpiId

  const byNorm = new Map<string, string>()
  for (const d of ddsKpis) {
    byNorm.set(normKpiKey(d.label), d.id)
  }

  const key = normKpiKey(cascadeName)
  if (byNorm.has(key)) return byNorm.get(key)

  const aliases = CASCADE_ALIASES[key] ?? []
  for (const alias of aliases) {
    const id = byNorm.get(normKpiKey(alias))
    if (id) return id
  }

  for (const d of ddsKpis) {
    const dl = normKpiKey(d.label)
    if (dl.includes(key) || key.includes(dl)) return d.id
  }

  let bestId: string | undefined
  let bestScore = 0.45
  for (const d of ddsKpis) {
    const score = tokenOverlapScore(cascadeName, d.label)
    if (score > bestScore) {
      bestScore = score
      bestId = d.id
    }
  }
  for (const alias of aliases) {
    for (const d of ddsKpis) {
      const score = tokenOverlapScore(alias, d.label)
      if (score > bestScore) {
        bestScore = score
        bestId = d.id
      }
    }
  }

  return bestId
}

export function formatDdsLabelHint(ddsKpis: DdsKpiOption[], max = 12): string {
  const sample = ddsKpis.slice(0, max).map((d) => d.label)
  const more = ddsKpis.length > max ? ` (+${ddsKpis.length - max} more)` : ''
  return sample.length ? `${sample.join(', ')}${more}` : 'none in DDS admin'
}
