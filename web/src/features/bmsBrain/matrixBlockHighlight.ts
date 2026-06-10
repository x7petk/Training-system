export type MatrixBlockHighlight = 'none' | 'dimmed' | 'highlighted' | 'focused'

export function matrixBlockHighlightClass(state: MatrixBlockHighlight): string {
  switch (state) {
    case 'focused':
      return 'z-10 opacity-100 ring-2 ring-accent shadow-sm'
    case 'highlighted':
      return 'opacity-100 ring-1 ring-accent/70'
    case 'dimmed':
      return 'opacity-30 saturate-50'
    default:
      return ''
  }
}

export function resolveMatrixBlockHighlight(
  processId: string,
  nodeKey: string,
  highlightProcessId: string | null,
  focusedNodeKey: string | null,
): MatrixBlockHighlight {
  if (!highlightProcessId) return 'none'
  if (processId !== highlightProcessId) return 'dimmed'
  return nodeKey === focusedNodeKey ? 'focused' : 'highlighted'
}
