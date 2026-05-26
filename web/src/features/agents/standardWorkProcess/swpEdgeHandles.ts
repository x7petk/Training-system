type NodeBox = {
  x: number
  y: number
  width: number
  height: number
}

/** Pick handle pair that gives the shortest straight connector. */
export function shortestConnectionHandles(
  source: NodeBox,
  target: NodeBox,
): { sourceHandle: string; targetHandle: string } {
  const pairs: { sourceHandle: string; targetHandle: string }[] = [
    { sourceHandle: 'bottom', targetHandle: 'top' },
    { sourceHandle: 'top', targetHandle: 'bottom' },
    { sourceHandle: 'right', targetHandle: 'left' },
    { sourceHandle: 'left', targetHandle: 'right' },
  ]

  const handlePoint = (box: NodeBox, handle: string) => {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    if (handle === 'top') return { x: cx, y: box.y }
    if (handle === 'bottom') return { x: cx, y: box.y + box.height }
    if (handle === 'left') return { x: box.x, y: cy }
    return { x: box.x + box.width, y: cy }
  }

  let best = pairs[0]
  let bestLen = Infinity
  for (const pair of pairs) {
    const a = handlePoint(source, pair.sourceHandle)
    const b = handlePoint(target, pair.targetHandle)
    const len = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    if (len < bestLen) {
      bestLen = len
      best = pair
    }
  }
  return best
}
