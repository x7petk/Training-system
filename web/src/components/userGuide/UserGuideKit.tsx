import type { ComponentType, ReactNode } from 'react'
import { BookOpenText } from 'lucide-react'
import { NavLink } from 'react-router-dom'

type IconComp = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

export type GuideBlock = {
  title: string
  body: string | readonly string[]
}

export type GuideColour = {
  label: string
  tone: string
  meaning: string
}

export type GuideAccess = {
  title: string
  body: string | readonly string[]
}

type HeaderProps = {
  title: string
  subtitle: string
  Icon?: IconComp
  iconClass: string
}

export function UserGuideHeader({ title, subtitle, Icon = BookOpenText, iconClass }: HeaderProps) {
  return (
    <header className="flex items-start gap-3">
      <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-12 ${iconClass}`}>
        <Icon className="size-5 sm:size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>
      </div>
    </header>
  )
}

export function UserGuideSection({
  title,
  lead,
  Icon,
  children,
}: {
  title: string
  lead?: string
  Icon?: IconComp
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-raised/50 p-4 backdrop-blur-sm md:p-6">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-5 shrink-0 text-accent" aria-hidden /> : null}
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {lead ? <p className="mt-2 text-sm text-muted">{lead}</p> : null}
      <div className={lead || Icon ? 'mt-4' : 'mt-3'}>{children}</div>
    </section>
  )
}

export function GuideParagraphs({ text }: { text: string | readonly string[] }) {
  const lines = typeof text === 'string' ? [text] : text
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  )
}

export function GuideBlockList({ blocks }: { blocks: readonly GuideBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.title} className="rounded-xl border border-border bg-surface px-3 py-3">
          <h3 className="text-sm font-semibold text-fg">{block.title}</h3>
          {typeof block.body === 'string' ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">{block.body}</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {block.body.map((line) => (
                <li key={line} className="border-l-2 border-border pl-3">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

export function GuideValueList({ items }: { items: readonly string[] }) {
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="rounded-xl border border-border bg-surface px-3 py-3 text-sm leading-relaxed text-fg">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function GuideColourGrid({ items }: { items: readonly GuideColour[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className={`rounded-xl border px-3 py-3 ${item.tone}`}>
          <p className="font-semibold">{item.label}</p>
          <p className="mt-1 text-sm opacity-90">{item.meaning}</p>
        </div>
      ))}
    </div>
  )
}

export function GuideAccessList({ items }: { items: readonly GuideAccess[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.title} className="rounded-xl border border-border bg-surface px-3 py-3">
          <p className="text-sm font-semibold text-fg">{item.title}</p>
          {typeof item.body === 'string' ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {item.body.map((line) => (
                <li key={line} className="border-l-2 border-border pl-3">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

const footerClass = (isCollapsed: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    [
      'flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors',
      isCollapsed ? 'justify-center gap-0 px-2' : 'gap-2',
      isActive ? 'bg-accent-dim text-accent' : 'text-muted hover:bg-black/[0.06] hover:text-fg',
    ].join(' ')

export function UserGuideFooterLink({
  to,
  collapsed = false,
}: {
  to: string
  collapsed?: boolean
}) {
  return (
    <NavLink to={to} className={footerClass(collapsed)} title={collapsed ? 'User Guide' : undefined}>
      <BookOpenText className="size-4 shrink-0" aria-hidden />
      {!collapsed ? 'User Guide' : null}
    </NavLink>
  )
}

/** Shown in the main nav on small screens; desktop uses the sidebar footer link. */
export function UserGuideMobileNavLink({ to }: { to: string }) {
  return (
    <div className="md:hidden">
      <UserGuideFooterLink to={to} />
    </div>
  )
}
