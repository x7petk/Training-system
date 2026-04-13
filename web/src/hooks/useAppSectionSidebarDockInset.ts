import { useEffect, useState } from 'react'

function readIsMd() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
}

function readCollapsed(storageKey: string) {
  return typeof window !== 'undefined' && localStorage.getItem(storageKey) === '1'
}

/**
 * Tailwind `left-*` class for `fixed` footers in a section outlet so they align with the main column
 * (clears the desktop sidebar). Pairs with `app-section-sidebar-toggle` from `AppSectionLayout`.
 */
export function useAppSectionSidebarDockLeftClass(storageKey: string): string {
  const [isMd, setIsMd] = useState(readIsMd)
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey))

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const read = () => {
      setIsMd(mq.matches)
      setCollapsed(localStorage.getItem(storageKey) === '1')
    }
    read()
    mq.addEventListener('change', read)
    const onToggle = (e: Event) => {
      const ev = e as CustomEvent<{ storageKey?: string; collapsed?: boolean }>
      if (ev.detail?.storageKey !== storageKey) return
      if (typeof ev.detail.collapsed === 'boolean') setCollapsed(ev.detail.collapsed)
    }
    window.addEventListener('app-section-sidebar-toggle', onToggle)
    return () => {
      mq.removeEventListener('change', read)
      window.removeEventListener('app-section-sidebar-toggle', onToggle)
    }
  }, [storageKey])

  if (!isMd) return 'left-0'
  return collapsed ? 'left-[4.25rem]' : 'left-56'
}
