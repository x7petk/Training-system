import { useEffect, useRef, useState } from 'react'

/** Tracks the width of a scroll/viewport container for responsive matrix layout. */
export function useMatrixViewportWidth(fallback = 960) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    ro.observe(el)
    setWidth(el.clientWidth || fallback)
    return () => ro.disconnect()
  }, [fallback])

  return { ref, width }
}
