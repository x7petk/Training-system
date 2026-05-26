import type { SwpFlowNode, SwpNodeKind } from './types'

export const SWP_NODE_DEFAULT_SIZE: Record<SwpNodeKind, { width: number; height: number }> = {
  start: { width: 80, height: 40 },
  end: { width: 96, height: 40 },
  task: { width: 132, height: 48 },
  decision: { width: 104, height: 104 },
}

export const SWP_NODE_MIN_SIZE: Record<SwpNodeKind, { width: number; height: number }> = {
  start: { width: 56, height: 32 },
  end: { width: 56, height: 32 },
  task: { width: 72, height: 36 },
  decision: { width: 72, height: 72 },
}

export function nodeSize(node: Pick<SwpFlowNode, 'kind' | 'width' | 'height'>) {
  const defaults = SWP_NODE_DEFAULT_SIZE[node.kind]
  return {
    width: node.width ?? defaults.width,
    height: node.height ?? defaults.height,
  }
}
