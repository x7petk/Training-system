-- Run in Supabase SQL Editor if you see: column plan24_rosters.pattern_length does not exist
-- (Adds pattern fields; safe to re-run.)

alter table public.plan24_rosters
  add column if not exists pattern_length int not null default 8;

alter table public.plan24_rosters
  add column if not exists pattern_start_date date;

notify pgrst, 'reload schema';
