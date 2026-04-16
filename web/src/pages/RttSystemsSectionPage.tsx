type Props = {
  title: string
  lead?: string
}

export function RttSystemsSectionPage({
  title,
  lead = 'This screen is a placeholder. Wire data, forms, or integrations here when the workflow is defined.',
}: Props) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{lead}</p>
      </header>
    </div>
  )
}
