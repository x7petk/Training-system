-- PDCA: one persisted board per site or cell.

create table if not exists public.dds_pdca_boards (
  id uuid primary key default gen_random_uuid(),
  scope_kind text not null
    constraint dds_pdca_boards_scope_kind_chk check (scope_kind in ('site', 'cell')),
  master_site_id uuid references public.master_sites (id) on delete cascade,
  master_cell_id uuid references public.master_cells (id) on delete cascade,
  cbn jsonb,
  selected_trends jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_pdca_boards_scope_chk check (
    (scope_kind = 'site' and master_site_id is not null and master_cell_id is null)
    or
    (scope_kind = 'cell' and master_cell_id is not null and master_site_id is null)
  )
);

create unique index if not exists dds_pdca_boards_one_per_site_idx
  on public.dds_pdca_boards (master_site_id)
  where scope_kind = 'site';

create unique index if not exists dds_pdca_boards_one_per_cell_idx
  on public.dds_pdca_boards (master_cell_id)
  where scope_kind = 'cell';

drop trigger if exists dds_pdca_boards_touch_updated_at on public.dds_pdca_boards;
create trigger dds_pdca_boards_touch_updated_at
  before update on public.dds_pdca_boards
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_pdca_boards enable row level security;

create policy "dds_pdca_boards_select_dds"
  on public.dds_pdca_boards for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_pdca_boards_insert_dds"
  on public.dds_pdca_boards for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_pdca_boards_update_dds"
  on public.dds_pdca_boards for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_pdca_boards_delete_dds"
  on public.dds_pdca_boards for delete to authenticated
  using (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_pdca_boards to authenticated;

notify pgrst, 'reload schema';
