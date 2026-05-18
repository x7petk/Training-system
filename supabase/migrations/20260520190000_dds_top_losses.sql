-- Top Losses: admin type / root cause / problem solve choices + per cell/date/shift entries with promotion copies.

create table public.dds_tl_type_options (
  id uuid primary key default gen_random_uuid(),
  sort_order smallint not null check (sort_order between 0 and 2),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_tl_type_options_sort_unique unique (sort_order)
);

create table public.dds_tl_root_cause_options (
  id uuid primary key default gen_random_uuid(),
  sort_order smallint not null check (sort_order between 0 and 2),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_tl_root_cause_options_sort_unique unique (sort_order)
);

create table public.dds_tl_problem_solve_options (
  id uuid primary key default gen_random_uuid(),
  sort_order smallint not null check (sort_order between 0 and 2),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_tl_problem_solve_options_sort_unique unique (sort_order)
);

create table public.dds_tl_entries (
  id uuid primary key default gen_random_uuid(),
  root_entry_id uuid references public.dds_tl_entries (id) on delete cascade,
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null,
  visible_surface text not null check (visible_surface in ('shift-dds', 'line-dds', 'site-dds')),
  created_on_surface text not null check (created_on_surface in ('shift-dds', 'line-dds', 'site-dds')),
  top_loss text not null,
  amount text not null default '',
  type_option_id uuid not null references public.dds_tl_type_options (id) on delete restrict,
  immediate_cause text not null default '',
  immediate_action text not null default '',
  root_cause_option_id uuid not null references public.dds_tl_root_cause_options (id) on delete restrict,
  problem_solve_option_id uuid not null references public.dds_tl_problem_solve_options (id) on delete restrict,
  promoted_from_entry_id uuid references public.dds_tl_entries (id) on delete set null,
  promoted_from_surface text check (promoted_from_surface in ('shift-dds', 'line-dds', 'site-dds')),
  promoted_from_cell_id uuid references public.master_cells (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  delete_comment text,
  constraint dds_tl_entries_top_loss_nonempty check (btrim(top_loss) <> '')
);

create index dds_tl_entries_cell_date_shift_surface_idx
  on public.dds_tl_entries (master_cell_id, plan_date, shift_kind, visible_surface)
  where deleted_at is null;

create index dds_tl_entries_root_id_idx on public.dds_tl_entries (root_entry_id) where deleted_at is null;

create table public.dds_tl_promotions (
  id uuid primary key default gen_random_uuid(),
  from_entry_id uuid not null references public.dds_tl_entries (id) on delete cascade,
  to_entry_id uuid not null references public.dds_tl_entries (id) on delete cascade,
  from_surface text not null check (from_surface in ('shift-dds', 'line-dds', 'site-dds')),
  to_surface text not null check (to_surface in ('shift-dds', 'line-dds', 'site-dds')),
  promoted_by uuid references auth.users (id) on delete set null,
  promoted_at timestamptz not null default now()
);

create index dds_tl_promotions_from_entry_idx on public.dds_tl_promotions (from_entry_id);
create index dds_tl_promotions_to_entry_idx on public.dds_tl_promotions (to_entry_id);

insert into public.dds_tl_type_options (sort_order, label)
values (0, 'Type 1'), (1, 'Type 2'), (2, 'Type 3')
on conflict (sort_order) do nothing;

insert into public.dds_tl_root_cause_options (sort_order, label)
values (0, 'Man'), (1, 'Mach'), (2, 'Meth')
on conflict (sort_order) do nothing;

insert into public.dds_tl_problem_solve_options (sort_order, label)
values (0, 'IPS'), (1, 'BDE'), (2, 'W-W')
on conflict (sort_order) do nothing;

create trigger dds_tl_type_options_touch_updated_at
  before update on public.dds_tl_type_options
  for each row execute function public.master_data_touch_updated_at();

create trigger dds_tl_root_cause_options_touch_updated_at
  before update on public.dds_tl_root_cause_options
  for each row execute function public.master_data_touch_updated_at();

create trigger dds_tl_problem_solve_options_touch_updated_at
  before update on public.dds_tl_problem_solve_options
  for each row execute function public.master_data_touch_updated_at();

create trigger dds_tl_entries_touch_updated_at
  before update on public.dds_tl_entries
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_tl_type_options enable row level security;
alter table public.dds_tl_root_cause_options enable row level security;
alter table public.dds_tl_problem_solve_options enable row level security;
alter table public.dds_tl_entries enable row level security;
alter table public.dds_tl_promotions enable row level security;

create policy "dds_tl_type_options_select_dds"
  on public.dds_tl_type_options for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_tl_type_options_write_admin"
  on public.dds_tl_type_options for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_tl_root_cause_options_select_dds"
  on public.dds_tl_root_cause_options for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_tl_root_cause_options_write_admin"
  on public.dds_tl_root_cause_options for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_tl_problem_solve_options_select_dds"
  on public.dds_tl_problem_solve_options for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_tl_problem_solve_options_write_admin"
  on public.dds_tl_problem_solve_options for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_tl_entries_select_dds"
  on public.dds_tl_entries for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_tl_entries_insert_dds"
  on public.dds_tl_entries for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_tl_entries_update_dds"
  on public.dds_tl_entries for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_tl_entries_delete_dds"
  on public.dds_tl_entries for delete to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_tl_promotions_select_dds"
  on public.dds_tl_promotions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_tl_promotions_insert_dds"
  on public.dds_tl_promotions for insert to authenticated
  with check (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_tl_type_options to authenticated;
grant select, insert, update, delete on public.dds_tl_root_cause_options to authenticated;
grant select, insert, update, delete on public.dds_tl_problem_solve_options to authenticated;
grant select, insert, update, delete on public.dds_tl_entries to authenticated;
grant select, insert on public.dds_tl_promotions to authenticated;

notify pgrst, 'reload schema';
