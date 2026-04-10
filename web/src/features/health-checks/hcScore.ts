/** Integer % per spec: ceil(100 * passes / total). */
export function hcScorePercent(passCount: number, totalActive: number): number {
  if (totalActive <= 0) return 0
  return Math.ceil((100 * passCount) / totalActive)
}

export type HcRag = 'green' | 'amber' | 'red'

/** Global RAG bands: >80 green; 60–80 amber; <60 red. */
export function hcRagFromPercent(pct: number): HcRag {
  if (pct > 80) return 'green'
  if (pct >= 60) return 'amber'
  return 'red'
}

export function hcRagLabel(rag: HcRag): string {
  switch (rag) {
    case 'green':
      return 'Green'
    case 'amber':
      return 'Amber'
    case 'red':
      return 'Red'
  }
}

export function hcRagBadgeClass(rag: HcRag): string {
  switch (rag) {
    case 'green':
      return 'bg-emerald-300 text-emerald-950 ring-emerald-700/45 dark:bg-emerald-400 dark:text-emerald-950 dark:ring-emerald-300/65'
    case 'amber':
      return 'bg-amber-300 text-amber-950 ring-amber-700/55 dark:bg-amber-400 dark:text-amber-950 dark:ring-amber-300/65'
    case 'red':
      return 'bg-rose-300 text-rose-950 ring-rose-700/50 dark:bg-rose-400 dark:text-rose-950 dark:ring-rose-300/65'
  }
}
