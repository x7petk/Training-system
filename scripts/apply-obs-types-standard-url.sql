-- Run this in Supabase Dashboard → SQL → New query (pick the project your app uses).
-- Fixes: Could not find the 'standard_url' column of 'sos_types' in the schema cache

alter table public.sos_types add column if not exists standard_url text;
alter table public.qos_types add column if not exists standard_url text;
alter table public.ppo_types add column if not exists standard_url text;

notify pgrst, 'reload schema';
