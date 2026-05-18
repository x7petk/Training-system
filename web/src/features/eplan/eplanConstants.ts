import type { EPlanActionStatus } from './eplanTypes'

export const EPLAN_STATUS_ORDER: EPlanActionStatus[] = [
  'ON_TRACK',
  'NEED_HELP',
  'OFF_TRACK',
  'COMPLETED',
  'NOT_STARTED',
  'NOT_REQUIRED',
]

export const EPLAN_STATUS_LABEL: Record<EPlanActionStatus, string> = {
  ON_TRACK: 'On Track',
  NEED_HELP: 'Need Help',
  OFF_TRACK: 'Off Track',
  COMPLETED: 'Completed',
  NOT_STARTED: 'Not Started',
  NOT_REQUIRED: 'Not Required',
}

export const EPLAN_STATUS_CARD_CLASS: Record<EPlanActionStatus, string> = {
  ON_TRACK: 'border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100',
  NEED_HELP: 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
  OFF_TRACK: 'border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-100',
  COMPLETED: 'border-emerald-600/40 bg-emerald-600/10 text-emerald-950 dark:text-emerald-100',
  NOT_STARTED: 'border-zinc-400/40 bg-zinc-400/15 text-fg',
  NOT_REQUIRED: 'border-zinc-300/40 bg-zinc-200/30 text-muted dark:bg-zinc-700/20',
}

export const EPLAN_STATUS_BAR_CLASS: Record<EPlanActionStatus, string> = {
  ON_TRACK: 'bg-sky-600',
  NEED_HELP: 'bg-amber-500',
  OFF_TRACK: 'bg-red-600',
  COMPLETED: 'bg-emerald-600',
  NOT_STARTED: 'bg-zinc-400',
  NOT_REQUIRED: 'bg-zinc-300 dark:bg-zinc-600',
}

export const EPLAN_ROW_H = 36
