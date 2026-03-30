import type { MouseEvent } from 'react'

/** Escape text placed inside &lt;a&gt;…&lt;/a&gt; when inserting HTML into TipTap. */
export function escapeHtmlForLinkBody(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeHrefAttr(href: string): string {
  return href.replace(/"/g, '&quot;')
}

/** Normalize URL / mailto / tel / relative paths for training standard links. */
export function normalizeTrainingLinkHref(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^javascript:/i.test(t) || /^data:/i.test(t) || /^vbscript:/i.test(t)) return null
  if (/^mailto:/i.test(t)) return t
  if (/^tel:/i.test(t)) return t
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('//')) return `https:${t}`
  if (t.startsWith('/')) return t
  return `https://${t}`
}

/** Strip dangerous hrefs; force external links to open in a new tab when rendered. */
export function sanitizeStandardContentAnchors(html: string): string {
  if (typeof document === 'undefined') return html
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  wrap.querySelectorAll('a[href]').forEach((node) => {
    const el = node as HTMLAnchorElement
    const href = el.getAttribute('href') || ''
    if (/^javascript:/i.test(href) || /^data:/i.test(href) || /^vbscript:/i.test(href)) {
      const parent = el.parentNode
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
      return
    }
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer')
  })
  return wrap.innerHTML
}

/** Canvas preview: show link text only (no &lt;a&gt;), so layout matches operators without clickable links in the mockup. */
export function stripAnchorsForCanvasPreview(html: string): string {
  if (typeof document === 'undefined') return html
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  wrap.querySelectorAll('a').forEach((a) => {
    const parent = a.parentNode
    if (!parent) return
    while (a.firstChild) parent.insertBefore(a.firstChild, a)
    parent.removeChild(a)
  })
  return wrap.innerHTML
}

export type StandardContentLink = {
  href: string
  label: string
}

/** Extract safe links from HTML so UI can render them outside the canvas. */
export function extractStandardContentLinks(html: string): StandardContentLink[] {
  if (typeof document === 'undefined') return []
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  const out: StandardContentLink[] = []
  wrap.querySelectorAll('a[href]').forEach((a) => {
    const hrefRaw = a.getAttribute('href') || ''
    if (!hrefRaw || /^javascript:/i.test(hrefRaw) || /^data:/i.test(hrefRaw) || /^vbscript:/i.test(hrefRaw)) return
    const label = (a.textContent || '').trim() || hrefRaw
    out.push({ href: hrefRaw, label })
  })
  return out
}

export function interceptProseLinkClick(e: MouseEvent<HTMLDivElement>) {
  const a = (e.target as HTMLElement | null)?.closest?.('a')
  if (!a || !(a instanceof HTMLAnchorElement)) return
  const href = a.getAttribute('href')
  if (!href || /^javascript:/i.test(href) || /^data:/i.test(href)) return
  e.preventDefault()
  window.open(a.href, '_blank', 'noopener,noreferrer')
}
