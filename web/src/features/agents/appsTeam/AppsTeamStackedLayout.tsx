import type { ReactNode } from 'react'
import {
  LIVE_BOARD_COUNT_BADGE,
  LIVE_BOARD_HEADER,
  LIVE_BOARD_TITLE,
  LIVE_BOARD_WRAPPER,
} from './liveBoardTheme'

/** Canonical Apps Team page section order: Chat → Live Board → Information (all breakpoints). */
export const APPS_TEAM_STACK_CLASS = 'flex w-full flex-col gap-6'

type AppsTeamStackedLayoutProps = {
  chat: ReactNode
  liveBoard: ReactNode
  ticketCount: number
  information: ReactNode
}

export function AppsTeamStackedLayout({
  chat,
  liveBoard,
  ticketCount,
  information,
}: AppsTeamStackedLayoutProps) {
  return (
    <div className={APPS_TEAM_STACK_CLASS} data-apps-team-layout="stacked">
      <section className="w-full" aria-label="Chat">
        {chat}
      </section>

      <section className={LIVE_BOARD_WRAPPER} aria-label="Live board">
        <div className={LIVE_BOARD_HEADER}>
          <h2 className={LIVE_BOARD_TITLE}>Live board</h2>
          <span className={LIVE_BOARD_COUNT_BADGE}>{ticketCount} tickets</span>
        </div>
        {liveBoard}
      </section>

      <section className="w-full rounded-xl border border-border bg-surface" aria-label="Information">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Information</h2>
          <p className="text-xs text-muted">
            Requirements, progress, and agent activity for the selected ticket.
          </p>
        </div>
        {information}
      </section>
    </div>
  )
}
