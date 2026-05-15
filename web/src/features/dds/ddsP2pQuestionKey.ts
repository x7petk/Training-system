/** Stable key for a P2P question in forms, audits, and summary matrix. */
export function ddsP2pQuestionKey(source: 'standard' | 'soft', questionId: string): string {
  return `${source}:${questionId}`
}
