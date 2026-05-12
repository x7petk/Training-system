type Props = {
  title: string
}

export function AgentsToolPage({ title }: Props) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          This tool page is ready. Next step is wiring the actual workflow, forms, prompts, and integrations.
        </p>
      </header>
    </div>
  )
}
