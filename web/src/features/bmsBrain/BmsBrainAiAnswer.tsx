import { Fragment } from 'react'

type Section = {
  title: string
  items: string[]
  body: string
}

function parseSections(markdown: string): Section[] {
  const chunks = markdown
    .split(/^## /m)
    .map((c) => c.trim())
    .filter(Boolean)

  if (chunks.length === 0) {
    return [{ title: 'Insight', items: [], body: markdown.trim() }]
  }

  return chunks.map((chunk) => {
    const lines = chunk.split('\n')
    const title = lines[0]?.trim() ?? 'Insight'
    const rest = lines.slice(1).join('\n').trim()
    const allLines = rest.split('\n').map((l) => l.trim()).filter(Boolean)
    const items = allLines.filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, ''))
    const body = allLines.filter((l) => !/^[-*]\s+/.test(l)).join(' ').trim()
    return { title, items, body }
  })
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

export function BmsBrainAiAnswer({ content }: { content: string }) {
  const sections = parseSections(content)

  return (
    <div className="space-y-3 text-sm leading-snug text-fg">
      {sections.map((section) => (
        <section key={section.title} className="rounded-xl border border-border/70 bg-canvas/30 px-3 py-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{section.title}</h3>
          {section.body ? <p className="mt-1.5">{renderInline(section.body)}</p> : null}
          {section.items.length ? (
            <ul className="mt-1.5 list-none space-y-1 pl-0">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2 text-[13px] leading-snug">
                  <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  )
}
