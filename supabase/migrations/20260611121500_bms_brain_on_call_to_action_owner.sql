-- On-Call role duplicates Action Owner for flow assignment.
-- Reassign all flow blocks from on-call → action-owner and retire the On-Call role.

begin;

create or replace function public.bms_brain_replace_flow_role(
  flow_json jsonb,
  from_role_id uuid,
  to_role_id uuid
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
              when elem->>'roleId' = from_role_id::text then
                case
                  when elem->>'owner' = 'On-Call' then
                    jsonb_set(
                      jsonb_set(elem, '{roleId}', to_jsonb(to_role_id::text)),
                      '{owner}',
                      to_jsonb('Action Owner'::text)
                    )
                  else jsonb_set(elem, '{roleId}', to_jsonb(to_role_id::text))
                end
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
  on_call_role_id uuid;
  action_owner_role_id uuid;
  proc_count int;
  ver_count int;
begin
  select id into on_call_role_id from public.bms_brain_roles where slug = 'on-call';
  select id into action_owner_role_id from public.bms_brain_roles where slug = 'action-owner';

  if action_owner_role_id is null then
    raise exception 'bms_brain_roles: action-owner role missing';
  end if;

  if on_call_role_id is null then
    raise notice 'on-call role not present — nothing to remap';
    return;
  end if;

  update public.bms_brain_processes p
  set
    flow = public.bms_brain_replace_flow_role(p.flow, on_call_role_id, action_owner_role_id),
    updated_at = now()
  where exists (
    select 1
    from jsonb_array_elements(coalesce(p.flow->'nodes', '[]'::jsonb)) node
    where node->>'roleId' = on_call_role_id::text
  );

  get diagnostics proc_count = row_count;

  update public.bms_brain_process_versions v
  set snapshot = jsonb_set(
    v.snapshot,
    '{flow}',
    public.bms_brain_replace_flow_role(v.snapshot->'flow', on_call_role_id, action_owner_role_id)
  )
  where exists (
    select 1
    from jsonb_array_elements(coalesce(v.snapshot->'flow'->'nodes', '[]'::jsonb)) node
    where node->>'roleId' = on_call_role_id::text
  );

  get diagnostics ver_count = row_count;

  update public.bms_brain_roles
  set is_active = false, updated_at = now()
  where id = on_call_role_id;

  raise notice 'Remapped % process flow(s) and % version snapshot(s) from on-call to action-owner', proc_count, ver_count;
end;
$$;

revoke all on function public.bms_brain_replace_flow_role(jsonb, uuid, uuid) from public;

notify pgrst, 'reload schema';

commit;
