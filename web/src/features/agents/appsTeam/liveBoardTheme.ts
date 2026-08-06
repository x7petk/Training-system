/**
 * Live Board sky theme for Agents → Apps Team.
 * Source-of-truth patterns elsewhere in the app:
 * - Panel surface: UserGuidePage (`border-sky-200 bg-sky-50/70`)
 * - Column headers: PdcaPage Plan column (`bg-sky-500/15 text-sky-800`)
 * - Lane body: SWP operator lane in roleLaneTheme.ts (`bg-sky-50/80`)
 */

/** Scoped wrapper identifier — all blue styling is applied inside this element only. */
export const LIVE_BOARD_WRAPPER =
  'apps-team-live-board min-h-0 rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-800 dark:bg-sky-950/25'

export const LIVE_BOARD_HEADER =
  'mb-2 flex items-center justify-between border-b border-sky-200/80 pb-2 dark:border-sky-800/80'

export const LIVE_BOARD_TITLE = 'text-sm font-semibold text-sky-900 dark:text-sky-100'

export const LIVE_BOARD_COUNT_BADGE =
  'rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-200'

export const LIVE_BOARD_KANBAN = {
  column:
    'flex w-56 shrink-0 flex-col rounded-xl border border-sky-200 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/20',
  columnHeader:
    'flex items-center justify-between border-b border-sky-200/80 bg-sky-500/15 px-3 py-2 dark:border-sky-800/80',
  columnLabel: 'text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200',
  countBadge:
    'rounded-full bg-sky-600/15 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:bg-sky-400/20 dark:text-sky-100',
  empty: 'px-1 py-6 text-center text-[11px] text-sky-700/70 dark:text-sky-300/70',
  cardSelected:
    'ring-2 ring-sky-500 ring-offset-1 ring-offset-sky-50 dark:ring-offset-sky-950/20',
  cardHover: 'hover:border-sky-400 hover:shadow-sm dark:hover:border-sky-600',
  cardFocus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1',
} as const
