import { useAuth } from '../hooks/useAuth'
import { AppHubPage } from '../pages/AppHubPage'

/** Everyone lands on the app hub; section tiles depend on profile flags and role. */
export function HomeRoute() {
  const { profileReady } = useAuth()

  if (!profileReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return <AppHubPage />
}
