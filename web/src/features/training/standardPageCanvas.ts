/**
 * Shared layout for training standard “page” preview.
 * Admin canvas and operator Training dialog must use the same structure and classes
 * so image x/y/w/h (percent of the stage below the title) match visually.
 */
export const standardPageOuterClass = 'overflow-hidden rounded-xl border border-sky-800/10 bg-white'

export const standardPageTitleClass =
  'bg-sky-700 px-4 py-3 text-lg font-semibold leading-snug text-white'

/** Positioning box for HTML + overlay images (% are relative to this element only, not the title). */
export const standardPageStageClass = 'relative min-h-[20rem] overflow-hidden p-4'

export const standardPageProseClass =
  'prose prose-sm max-w-none text-black/90 [&_a]:font-medium [&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-sky-500/45 [&_a]:transition-colors hover:[&_a]:text-sky-900 hover:[&_a]:decoration-sky-700/70'

/** object-contain shows the full image inside x/y/w/h; object-cover crops to fill. */
export const standardPageImageClass =
  'pointer-events-none absolute z-10 rounded-md bg-white object-contain object-center shadow'
