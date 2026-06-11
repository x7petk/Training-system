-- Operational Execution forum duplicates SWP (Standard Work Process).
-- Reassign all flow blocks from operational-execution → swp and retire the OE forum.

begin;

create or replace function public.bms_brain_replace_flow_forum(
  flow_json jsonb,
  from_forum_id uuid,
  to_forum_id uuid
)
returns jsonb
language sql
immutable
as $$
  select case
    when flow_json is null or jsonb_typeof(flow_json->'nodes') <> 'array' then flow_json
    else jsonb_set(
      flow_json,
      '{nodes}',
      coalesce(
        (
          select jsonb_agg(
            case
              when elem->>'forumId' = from_forum_id::text
              then jsonb_set(elem, '{forumId}', to_jsonb(to_forum_id::text))
              else elem
            end
            order by ord
          )
          from jsonb_array_elements(flow_json->'nodes') with ordinality as t(elem, ord)
        ),
        '[]'::jsonb
      )
    )
  end;
$$;

do $$
declare
  oe_forum_id uuid;
  swp_forum_id uuid;
  proc_count int;
  ver_count int;
begin
  select id into oe_forum_id from public.bms_brain_forums where slug = 'operational-execution';
  select id into swp_forum_id from public.bms_brain_forums where slug = 'swp';

  if swp_forum_id is null then
    raise exception 'bms_brain_forums: swp forum missing';
  end if;

  if oe_forum_id is null then
    raise notice 'operational-execution forum not present — nothing to remap';
    return;
  end if;

  update public.bms_brain_processes p
  set
    flow = public.bms_brain_replace_flow_forum(p.flow, oe_forum_id, swp_forum_id),
    updated_at = now()
  where exists (
    select 1
    from jsonb_array_elements(coalesce(p.flow->'nodes', '[]'::jsonb)) node
    where node->>'forumId' = oe_forum_id::text
  );

  get diagnostics proc_count = row_count;

  update public.bms_brain_process_versions v
  set snapshot = jsonb_set(
    v.snapshot,
    '{flow}',
    public.bms_brain_replace_flow_forum(v.snapshot->'flow', oe_forum_id, swp_forum_id)
  )
  where exists (
    select 1
    from jsonb_array_elements(coalesce(v.snapshot->'flow'->'nodes', '[]'::jsonb)) node
    where node->>'forumId' = oe_forum_id::text
  );

  get diagnostics ver_count = row_count;

  update public.bms_brain_forums
  set is_active = false, updated_at = now()
  where id = oe_forum_id;

  raise notice 'Remapped % process flow(s) and % version snapshot(s) from operational-execution to swp', proc_count, ver_count;
end;
$$;

revoke all on function public.bms_brain_replace_flow_forum(jsonb, uuid, uuid) from public;

notify pgrst, 'reload schema';

commit;
