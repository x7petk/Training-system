-- Backfill plan24_rosters pattern columns when an environment applied later
-- migrations (e.g. shift_kind checks) without 20260418130000_plan24_teams_pattern.sql.

alter table public.plan24_rosters
  add column if not exists pattern_length int not null default 8;

alter table public.plan24_rosters
  add column if not exists pattern_start_date date;

notify pgrst, 'reload schema';
