-- WDS column actions: System & Capability (per WDS board column).

create table if not exists public.dds_wds_actions (
  id uuid primary key default gen_random_uuid(),
  dds_wds_column_id uuid not null references public.dds_wds_columns (id) on delete cascade,
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  kind text not null
    constraint dds_wds_actions_kind_chk check (kind in ('system', 'capability')),
  title text not null,
  owner_name text not null default '',
  target_date date not null,
  status text not null default 'not_started'
    constraint dds_wds_actions_status_chk
    check (status in ('not_started', 'in_progress', 'off_track', 'completed', 'not_required')),
  hc_type_id uuid references public.hc_types (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dds_wds_actions_column_idx
  on public.dds_wds_actions (dds_wds_column_id, sort_order, created_at);

create index if not exists dds_wds_actions_cell_idx
  on public.dds_wds_actions (master_cell_id, target_date);

drop trigger if exists dds_wds_actions_touch_updated_at on public.dds_wds_actions;
create trigger dds_wds_actions_touch_updated_at
  before update on public.dds_wds_actions
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_wds_actions enable row level security;

create policy "dds_wds_actions_select_dds"
  on public.dds_wds_actions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_wds_actions_insert_dds"
  on public.dds_wds_actions for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_wds_actions_update_dds"
  on public.dds_wds_actions for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_wds_actions_delete_dds"
  on public.dds_wds_actions for delete to authenticated
  using (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_wds_actions to authenticated;

notify pgrst, 'reload schema';
