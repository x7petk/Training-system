type Props = {
  title: string
}

export function DdsPlaceholderPage({ title }: Props) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          DDS Process — screens for this area will be added later. Site, plant, and cell use the same scope as Plan 24.
        </p>
      </header>
    </div>
  )
}
