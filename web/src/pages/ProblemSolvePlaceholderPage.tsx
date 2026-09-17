import { Link } from 'react-router-dom'

type Props = {
  title: string
}

export function ProblemSolvePlaceholderPage({ title }: Props) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Dedicated {title} library screens will land here later. Use{' '}
          <Link className="font-medium text-accent underline-offset-2 hover:underline" to="/problem-solve/navigator">
            Navigator
          </Link>{' '}
          for the AI-supported Loss Elimination flow (chat → method form → refocus → actions).
        </p>
      </header>
    </div>
  )
}
