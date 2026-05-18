-- Reward & Recognition: global value/behaviour choices + per cell/date/shift entries with promotion copies.

create table public.dds_rr_value_options (
  id uuid primary key default gen_random_uuid(),
  sort_order smallint not null check (sort_order between 0 and 2),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_rr_value_options_sort_unique unique (sort_order)
);

create table public.dds_rr_behaviour_options (
  id uuid primary key default gen_random_uuid(),
  value_option_id uuid not null references public.dds_rr_value_options (id) on delete cascade,
  sort_order smallint not null check (sort_order between 0 and 2),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dds_rr_behaviour_options_value_sort_unique unique (value_option_id, sort_order)
);

create index dds_rr_behaviour_options_value_id_idx on public.dds_rr_behaviour_options (value_option_id);

create table public.dds_rr_entries (
  id uuid primary key default gen_random_uuid(),
  root_entry_id uuid references public.dds_rr_entries (id) on delete cascade,
  master_cell_id uuid not null references public.master_cells (id) on delete cascade,
  plan_date date not null,
  shift_kind text not null,
  visible_surface text not null check (visible_surface in ('shift-dds', 'line-dds', 'site-dds')),
  created_on_surface text not null check (created_on_surface in ('shift-dds', 'line-dds', 'site-dds')),
  name_mode text not null check (name_mode in ('one_person', 'multiple_people', 'free_text')),
  free_text_names text,
  reason text not null,
  value_option_id uuid not null references public.dds_rr_value_options (id) on delete restrict,
  behaviour_option_id uuid not null references public.dds_rr_behaviour_options (id) on delete restrict,
  promoted_from_entry_id uuid references public.dds_rr_entries (id) on delete set null,
  promoted_from_surface text check (promoted_from_surface in ('shift-dds', 'line-dds', 'site-dds')),
  promoted_from_cell_id uuid references public.master_cells (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  delete_comment text,
  constraint dds_rr_entries_free_text_when_mode check (
    name_mode <> 'free_text' or (free_text_names is not null and btrim(free_text_names) <> '')
  )
);

create index dds_rr_entries_cell_date_shift_surface_idx
  on public.dds_rr_entries (master_cell_id, plan_date, shift_kind, visible_surface)
  where deleted_at is null;

create index dds_rr_entries_root_id_idx on public.dds_rr_entries (root_entry_id) where deleted_at is null;

create table public.dds_rr_entry_people (
  entry_id uuid not null references public.dds_rr_entries (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (entry_id, person_id)
);

create index dds_rr_entry_people_person_id_idx on public.dds_rr_entry_people (person_id);

create table public.dds_rr_promotions (
  id uuid primary key default gen_random_uuid(),
  from_entry_id uuid not null references public.dds_rr_entries (id) on delete cascade,
  to_entry_id uuid not null references public.dds_rr_entries (id) on delete cascade,
  from_surface text not null check (from_surface in ('shift-dds', 'line-dds', 'site-dds')),
  to_surface text not null check (to_surface in ('shift-dds', 'line-dds', 'site-dds')),
  promoted_by uuid references auth.users (id) on delete set null,
  promoted_at timestamptz not null default now()
);

create index dds_rr_promotions_from_entry_idx on public.dds_rr_promotions (from_entry_id);
create index dds_rr_promotions_to_entry_idx on public.dds_rr_promotions (to_entry_id);

-- Seed 3 values × 3 behaviours (labels editable in admin).
insert into public.dds_rr_value_options (sort_order, label)
values (0, 'Choice 1'), (1, 'Choice 2'), (2, 'Choice 3')
on conflict (sort_order) do nothing;

insert into public.dds_rr_behaviour_options (value_option_id, sort_order, label)
select v.id, b.sort_order, b.label
from public.dds_rr_value_options v
cross join (
  values
    (0, 'Behaviour 1'),
    (1, 'Behaviour 2'),
    (2, 'Behaviour 3')
) as b(sort_order, label)
on conflict (value_option_id, sort_order) do nothing;

create trigger dds_rr_value_options_touch_updated_at
  before update on public.dds_rr_value_options
  for each row execute function public.master_data_touch_updated_at();

create trigger dds_rr_behaviour_options_touch_updated_at
  before update on public.dds_rr_behaviour_options
  for each row execute function public.master_data_touch_updated_at();

create trigger dds_rr_entries_touch_updated_at
  before update on public.dds_rr_entries
  for each row execute function public.master_data_touch_updated_at();

alter table public.dds_rr_value_options enable row level security;
alter table public.dds_rr_behaviour_options enable row level security;
alter table public.dds_rr_entries enable row level security;
alter table public.dds_rr_entry_people enable row level security;
alter table public.dds_rr_promotions enable row level security;

create policy "dds_rr_value_options_select_dds"
  on public.dds_rr_value_options for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_rr_value_options_write_admin"
  on public.dds_rr_value_options for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_rr_behaviour_options_select_dds"
  on public.dds_rr_behaviour_options for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_rr_behaviour_options_write_admin"
  on public.dds_rr_behaviour_options for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "dds_rr_entries_select_dds"
  on public.dds_rr_entries for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_rr_entries_insert_dds"
  on public.dds_rr_entries for insert to authenticated
  with check (public.app_user_can_access_dds());

create policy "dds_rr_entries_update_dds"
  on public.dds_rr_entries for update to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_rr_entries_delete_dds"
  on public.dds_rr_entries for delete to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_rr_entry_people_select_dds"
  on public.dds_rr_entry_people for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_rr_entry_people_write_dds"
  on public.dds_rr_entry_people for all to authenticated
  using (public.app_user_can_access_dds()) with check (public.app_user_can_access_dds());

create policy "dds_rr_promotions_select_dds"
  on public.dds_rr_promotions for select to authenticated
  using (public.app_user_can_access_dds());

create policy "dds_rr_promotions_insert_dds"
  on public.dds_rr_promotions for insert to authenticated
  with check (public.app_user_can_access_dds());

grant select, insert, update, delete on public.dds_rr_value_options to authenticated;
grant select, insert, update, delete on public.dds_rr_behaviour_options to authenticated;
grant select, insert, update, delete on public.dds_rr_entries to authenticated;
grant select, insert, update, delete on public.dds_rr_entry_people to authenticated;
grant select, insert on public.dds_rr_promotions to authenticated;

notify pgrst, 'reload schema';
