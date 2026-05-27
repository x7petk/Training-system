/** Shared DDS KPI table column widths (Safety, Quality, RTT, Production, etc.). */

export const DDS_KPI_TABLE_CLASS =
  'w-full min-w-0 table-fixed border-collapse text-[9px] leading-tight'

export const DDS_KPI_METRIC_COL_CLASS =
  'sticky left-0 z-[1] w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] border-r border-border/50 px-1 py-px'

export const DDS_KPI_METRIC_TH_CLASS = `${DDS_KPI_METRIC_COL_CLASS} bg-surface-raised/80 text-left text-[8px] font-semibold text-muted`

export const DDS_KPI_METRIC_TD_CLASS = `${DDS_KPI_METRIC_COL_CLASS} bg-canvas/80`

export const DDS_KPI_VALUE_COL_CLASS = 'w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] p-px align-middle'

export const DDS_KPI_VALUE_TH_CLASS = `${DDS_KPI_VALUE_COL_CLASS} text-center text-[8px] font-semibold leading-none text-muted`

/** Value entry block — same footprint in by-cell and by-line tables. */
export const DDS_KPI_VALUE_BUTTON_CLASS =
  'relative mx-auto flex min-h-[1.375rem] w-[3.125rem] min-w-[3.125rem] max-w-[3.125rem] cursor-pointer flex-col items-center justify-center gap-px rounded-sm border px-0.5 py-px text-center outline-none ring-accent/30 transition hover:brightness-[1.02] focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50'

/** Site consolidated KPI tiles (non-table). */
export const DDS_KPI_TILE_CLASS =
  'flex w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] cursor-pointer flex-col rounded-sm border px-1 py-px text-left outline-none ring-accent/30 focus-visible:ring-2'
