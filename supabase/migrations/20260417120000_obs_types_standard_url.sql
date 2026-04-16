-- Optional URL to the standard document for each SOS / QOS / PPO type (admin + record UI).

alter table public.sos_types add column if not exists standard_url text;
alter table public.qos_types add column if not exists standard_url text;
alter table public.ppo_types add column if not exists standard_url text;

-- Refresh PostgREST so the API sees the new columns (avoids "schema cache" errors).
notify pgrst, 'reload schema';
