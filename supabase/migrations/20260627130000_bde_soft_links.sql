-- BDE soft links to Plan 24 / DDS Top Losses / IPS (reference).

alter table public.bde_records
  add column if not exists plan24_event_id uuid references public.plan24_events (id) on delete set null,
  add column if not exists plan24_event_label text,
  add column if not exists dds_tl_entry_id uuid references public.dds_tl_entries (id) on delete set null,
  add column if not exists dds_tl_label text,
  add column if not exists ips_reference text;

create index if not exists bde_records_plan24_event_idx
  on public.bde_records (plan24_event_id)
  where deleted_at is null and plan24_event_id is not null;

create index if not exists bde_records_dds_tl_idx
  on public.bde_records (dds_tl_entry_id)
  where deleted_at is null and dds_tl_entry_id is not null;

comment on column public.bde_records.plan24_event_id is 'Optional soft link to a Plan 24 event.';
comment on column public.bde_records.dds_tl_entry_id is 'Optional soft link to a DDS Top Loss entry.';
comment on column public.bde_records.ips_reference is 'Free-text IPS reference until IPS module is built.';
