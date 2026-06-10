-- Add Team Lead role (between Operator and Cell) and reassign first-line activities.

insert into public.bms_brain_roles (slug, name, description, color, icon, sort_order)
values (
  'team-lead',
  'Team Lead',
  'First-line leadership supervising operators, shift forums, and team execution.',
  '#475569',
  'user-cog',
  2
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

update public.bms_brain_roles set sort_order = 3, updated_at = now() where slug = 'cell';
update public.bms_brain_roles set sort_order = 4, updated_at = now() where slug = 'plant';
update public.bms_brain_roles set sort_order = 5, updated_at = now() where slug = 'site';
update public.bms_brain_roles set sort_order = 6, updated_at = now() where slug = 'support';
update public.bms_brain_roles set sort_order = 7, updated_at = now() where slug = 'maintenance';

create or replace function public.bms_brain_node_to_team_lead(
  node jsonb,
  r_cell uuid,
  r_team_lead uuid,
  f_shift uuid,
  f_p2p uuid,
  f_swp uuid,
  f_pdca uuid
)
returns jsonb
language plpgsql
immutable
as $$
declare
  n_role uuid;
  n_forum uuid;
  n_label text;
  remap boolean := false;
begin
  if node is null or node = 'null'::jsonb then
    return node;
  end if;

  begin
    n_role := nullif(node->>'roleId', '')::uuid;
    n_forum := nullif(node->>'forumId', '')::uuid;
  exception when others then
    return node;
  end;

  if n_role is null or n_role <> r_cell then
    return node;
  end if;

  n_label := coalesce(node->>'label', '');

  if n_forum in (f_shift, f_p2p) then
    remap := true;
  elsif n_forum = f_swp and (
    n_label ilike '%sign-off%'
    or n_label ilike '%operational corrective%'
    or n_label ilike '%complete corrective action%'
    or n_label ilike '%apply standard%'
    or n_label ilike '%raise dh / adjust%'
  ) then
    remap := true;
  elsif n_forum = f_pdca and n_label ilike '%do & check%' then
    remap := true;
  end if;

  if not remap then
    return node;
  end if;

  node := jsonb_set(node, '{roleId}', to_jsonb(r_team_lead::text), true);
  if coalesce(node->>'owner', '') in ('Cell team leader', 'Cell leader') then
    node := jsonb_set(node, '{owner}', '"Team Lead"', true);
  end if;
  return node;
end;
$$;

create or replace function public.bms_brain_apply_team_lead_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_cell uuid;
  r_team_lead uuid;
  f_shift uuid;
  f_p2p uuid;
  f_swp uuid;
  f_pdca uuid;
  proc record;
  nodes jsonb;
  node jsonb;
  new_nodes jsonb;
  new_flow jsonb;
  next_ver int;
begin
  select id into r_team_lead from bms_brain_roles where slug = 'team-lead';
  select id into r_cell from bms_brain_roles where slug = 'cell';
  select id into f_shift from bms_brain_forums where slug = 'shift-dds';
  select id into f_p2p from bms_brain_forums where slug = 'p2p';
  select id into f_swp from bms_brain_forums where slug = 'swp';
  select id into f_pdca from bms_brain_forums where slug = 'pdca';

  if r_team_lead is null or r_cell is null then
    raise exception 'Team Lead or Cell role missing';
  end if;

  for proc in
    select id, flow
    from bms_brain_processes
    where status = 'published' and flow is not null
  loop
    new_nodes := '[]'::jsonb;
    for node in select value from jsonb_array_elements(coalesce(proc.flow->'nodes', '[]'::jsonb)) as t(value) loop
      new_nodes := new_nodes || jsonb_build_array(
        public.bms_brain_node_to_team_lead(node, r_cell, r_team_lead, f_shift, f_p2p, f_swp, f_pdca)
      );
    end loop;

    new_flow := jsonb_set(coalesce(proc.flow, '{}'::jsonb), '{nodes}', new_nodes, true);

    update bms_brain_processes
    set flow = new_flow, updated_at = now()
    where id = proc.id;

    select coalesce(max(version_no), 0) + 1 into next_ver
    from bms_brain_process_versions
    where process_id = proc.id;

    insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
    select proc.id, next_ver, to_jsonb(p.*), 'Team Lead role assignment'
    from bms_brain_processes p
    where p.id = proc.id;
  end loop;

  -- Shift-operated system flows: Team Lead as process owner where Cell owned shift execution.
  update bms_brain_processes
  set owner_role_id = r_team_lead, updated_at = now()
  where owner_role_id = r_cell
    and catalog_system_id in (
      select id from bms_brain_systems where slug in ('cil', 'dh', 'cl', 'triggers', 'p2p-sys', 'plan24')
    );
end;
$$;

select public.bms_brain_apply_team_lead_role();

revoke all on function public.bms_brain_node_to_team_lead(jsonb, uuid, uuid, uuid, uuid, uuid, uuid) from public;
revoke all on function public.bms_brain_apply_team_lead_role() from public;

notify pgrst, 'reload schema';
