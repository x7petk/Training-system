import { hcRagFromPercent, hcScorePercent, type HcRag } from '../health-checks/hcScore'

export type SosLevel = 'full' | 'partly' | 'not'

/** Map SOS level to RAG + numeric score for reporting. */
export function sosLevelToStatusAndScore(level: SosLevel): { status: HcRag; score: number } {
  switch (level) {
    case 'full':
      return { status: 'green', score: 100 }
    case 'partly':
      return { status: 'amber', score: 50 }
    case 'not':
      return { status: 'red', score: 0 }
  }
}

export function qosScoreAndRag(passCount: number, totalScored: number): { score: number; rag: HcRag } {
  const score = hcScorePercent(passCount, totalScored)
  return { score, rag: hcRagFromPercent(score) }
}

/** PPO: ≥85 green, 70–84 amber, &lt;70 red (N/A excluded from denominator before calling). */
export function ppoRagFromPercent(pct: number): HcRag {
  if (pct >= 85) return 'green'
  if (pct >= 70) return 'amber'
  return 'red'
}

export function ppoScoreAndRag(passCount: number, totalScored: number): { score: number; rag: HcRag } {
  const score = hcScorePercent(passCount, totalScored)
  return { score, rag: ppoRagFromPercent(score) }
}
