-- Nudge PostgREST to reload its schema cache so new columns (e.g. checked_by) are visible immediately.
-- Safe no-op if the notification channel is unavailable.
notify pgrst, 'reload schema';
