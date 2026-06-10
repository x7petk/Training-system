-- Link process flows to catalog systems; seed flows for all tools.

alter table public.bms_brain_processes
  add column if not exists catalog_system_id uuid references public.bms_brain_systems (id) on delete set null;

create unique index if not exists bms_brain_processes_catalog_system_uidx
  on public.bms_brain_processes (catalog_system_id)
  where catalog_system_id is not null;

comment on column public.bms_brain_processes.catalog_system_id is
  'When set, this flow documents the named catalog system/tool. Null = cross-system integration flow.';

create or replace function public.bms_brain_seed_system_flows()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p_shift uuid := 'a1000001-0001-4000-8000-000000000001';
  p_defect uuid := 'a1000001-0001-4000-8000-000000000002';
  p_cil uuid := 'a1000001-0001-4000-8000-000000000003';
  p_cl uuid := 'a1000002-0001-4000-8000-000000000001';
  p_ips uuid := 'a1000002-0001-4000-8000-000000000002';
  p_plan24 uuid := 'a1000002-0001-4000-8000-000000000003';
  p_wds uuid := 'a1000002-0001-4000-8000-000000000004';
  p_pdca uuid := 'a1000002-0001-4000-8000-000000000005';
  p_p2p uuid := 'a1000002-0001-4000-8000-000000000006';
  r_operator uuid;
  r_cell uuid;
  r_plant uuid;
  r_site uuid;
  r_support uuid;
  f_swp uuid;
  f_p2p uuid;
  f_shift uuid;
  f_line uuid;
  f_wds uuid;
  f_pdca uuid;
  s_plan24 uuid;
  s_cl uuid;
  s_cil uuid;
  s_dh uuid;
  s_ips uuid;
  s_p2p uuid;
  s_wds uuid;
  s_pdca uuid;
begin
  select id into r_operator from bms_brain_roles where slug = 'operator';
  select id into r_cell from bms_brain_roles where slug = 'cell';
  select id into r_plant from bms_brain_roles where slug = 'plant';
  select id into r_site from bms_brain_roles where slug = 'site';
  select id into r_support from bms_brain_roles where slug = 'support';

  select id into f_swp from bms_brain_forums where slug = 'swp';
  select id into f_p2p from bms_brain_forums where slug = 'p2p';
  select id into f_shift from bms_brain_forums where slug = 'shift-dds';
  select id into f_line from bms_brain_forums where slug = 'line-dds';
  select id into f_wds from bms_brain_forums where slug = 'wds';
  select id into f_pdca from bms_brain_forums where slug = 'pdca';

  select id into s_plan24 from bms_brain_systems where slug = 'plan24';
  select id into s_cl from bms_brain_systems where slug = 'cl';
  select id into s_cil from bms_brain_systems where slug = 'cil';
  select id into s_dh from bms_brain_systems where slug = 'dh';
  select id into s_ips from bms_brain_systems where slug = 'ips';
  select id into s_p2p from bms_brain_systems where slug = 'p2p-sys';
  select id into s_wds from bms_brain_systems where slug = 'wds-sys';
  select id into s_pdca from bms_brain_systems where slug = 'pdca-sys';

  update bms_brain_processes set catalog_system_id = null where id = p_shift;
  update bms_brain_processes set catalog_system_id = s_dh where id = p_defect;
  update bms_brain_processes set catalog_system_id = s_cil where id = p_cil;

  insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
  values
    (
      p_cl,
      'CL — Centreline checks',
      'Standard centreline check execution, deviation handling, and sign-off.',
      'published',
      jsonb_build_object(
        'nodes', jsonb_build_array(
          jsonb_build_object('id','n-cl-1','kind','start','label','CL check due','description','Plan 24 schedules centreline checks for the role.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl,s_plan24),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-cl-2','kind','process','label','Perform CL check','description','Compare actual vs standard; record result.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'position',jsonb_build_object('x',220,'y',120)),
          jsonb_build_object('id','n-cl-3','kind','decision','label','Within standard?','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl,s_dh),'position',jsonb_build_object('x',400,'y',200)),
          jsonb_build_object('id','n-cl-4','kind','process','label','Raise DH / adjust','description','Log deviation and contain if needed.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh,s_cl),'position',jsonb_build_object('x',580,'y',280)),
          jsonb_build_object('id','n-cl-5','kind','end','label','CL complete','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cl,s_plan24),'position',jsonb_build_object('x',760,'y',360))
        ),
        'edges', jsonb_build_array(
          jsonb_build_object('id','e-cl-1','source','n-cl-1','target','n-cl-2'),
          jsonb_build_object('id','e-cl-2','source','n-cl-2','target','n-cl-3'),
          jsonb_build_object('id','e-cl-3','source','n-cl-3','target','n-cl-5','label','Yes'),
          jsonb_build_object('id','e-cl-4','source','n-cl-3','target','n-cl-4','label','No'),
          jsonb_build_object('id','e-cl-5','source','n-cl-4','target','n-cl-5')
        )
      ),
      r_cell,
      s_cl
    ),
    (
      p_ips,
      'IPS — Integrated production checks',
      'Shift IPS checks, escalation, and line review loop.',
      'published',
      jsonb_build_object(
        'nodes', jsonb_build_array(
          jsonb_build_object('id','n-ips-1','kind','start','label','IPS check window','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips,s_plan24),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-ips-2','kind','process','label','Run IPS checklist','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',220,'y',120)),
          jsonb_build_object('id','n-ips-3','kind','decision','label','All green?','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',400,'y',200)),
          jsonb_build_object('id','n-ips-4','kind','review','label','Line DDS review','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_ips,s_plan24),'position',jsonb_build_object('x',580,'y',280)),
          jsonb_build_object('id','n-ips-5','kind','end','label','Actions tracked','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',760,'y',360))
        ),
        'edges', jsonb_build_array(
          jsonb_build_object('id','e-ips-1','source','n-ips-1','target','n-ips-2'),
          jsonb_build_object('id','e-ips-2','source','n-ips-2','target','n-ips-3'),
          jsonb_build_object('id','e-ips-3','source','n-ips-3','target','n-ips-5','label','Yes'),
          jsonb_build_object('id','e-ips-4','source','n-ips-3','target','n-ips-4','label','No'),
          jsonb_build_object('id','e-ips-5','source','n-ips-4','target','n-ips-5')
        )
      ),
      r_plant,
      s_ips
    ),
    (
      p_plan24,
      'Plan 24 — Shift execution grid',
      'How tasks are planned, assigned, executed, and closed on the shift grid.',
      'published',
      jsonb_build_object(
        'nodes', jsonb_build_array(
          jsonb_build_object('id','n-p24-1','kind','start','label','Shift plan published','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_plan24),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-p24-2','kind','process','label','Assign tasks to roles','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_plan24),'position',jsonb_build_object('x',220,'y',120)),
          jsonb_build_object('id','n-p24-3','kind','process','label','Execute on grid','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_plan24,s_cl,s_cil),'position',jsonb_build_object('x',400,'y',200)),
          jsonb_build_object('id','n-p24-4','kind','review','label','Shift DDS review','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_plan24,s_ips),'position',jsonb_build_object('x',580,'y',280)),
          jsonb_build_object('id','n-p24-5','kind','end','label','Grid complete','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_plan24),'position',jsonb_build_object('x',760,'y',360))
        ),
        'edges', jsonb_build_array(
          jsonb_build_object('id','e-p24-1','source','n-p24-1','target','n-p24-2'),
          jsonb_build_object('id','e-p24-2','source','n-p24-2','target','n-p24-3'),
          jsonb_build_object('id','e-p24-3','source','n-p24-3','target','n-p24-4'),
          jsonb_build_object('id','e-p24-4','source','n-p24-4','target','n-p24-5')
        )
      ),
      r_cell,
      s_plan24
    ),
    (
      p_wds,
      'WDS — Weekly direction board',
      'Weekly priorities from line/site into the WDS board and actions.',
      'published',
      jsonb_build_object(
        'nodes', jsonb_build_array(
          jsonb_build_object('id','n-wds-1','kind','start','label','WDS week opens','roleId',r_site,'forumId',f_wds,'systemIds',jsonb_build_array(s_wds),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-wds-2','kind','process','label','Cascade priorities','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_wds,s_ips),'position',jsonb_build_object('x',220,'y',120)),
          jsonb_build_object('id','n-wds-3','kind','process','label','Update WDS board','roleId',r_site,'forumId',f_wds,'systemIds',jsonb_build_array(s_wds),'position',jsonb_build_object('x',400,'y',200)),
          jsonb_build_object('id','n-wds-4','kind','end','label','Week actions live','roleId',r_site,'forumId',f_wds,'systemIds',jsonb_build_array(s_wds,s_plan24),'position',jsonb_build_object('x',580,'y',280))
        ),
        'edges', jsonb_build_array(
          jsonb_build_object('id','e-wds-1','source','n-wds-1','target','n-wds-2'),
          jsonb_build_object('id','e-wds-2','source','n-wds-2','target','n-wds-3'),
          jsonb_build_object('id','e-wds-3','source','n-wds-3','target','n-wds-4')
        )
      ),
      r_site,
      s_wds
    ),
    (
      p_pdca,
      'PDCA — Problem solving loop',
      'Structured plan-do-check-act for losses and repeat defects.',
      'published',
      jsonb_build_object(
        'nodes', jsonb_build_array(
          jsonb_build_object('id','n-pdca-1','kind','start','label','Problem selected','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_pdca,s_dh),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-pdca-2','kind','process','label','Plan countermeasure','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_pdca),'position',jsonb_build_object('x',220,'y',120)),
          jsonb_build_object('id','n-pdca-3','kind','process','label','Do & check','roleId',r_cell,'forumId',f_pdca,'systemIds',jsonb_build_array(s_pdca,s_cl),'position',jsonb_build_object('x',400,'y',200)),
          jsonb_build_object('id','n-pdca-4','kind','review','label','Act & standardise','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_pdca,s_dh),'position',jsonb_build_object('x',580,'y',280)),
          jsonb_build_object('id','n-pdca-5','kind','end','label','Loop closed','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_pdca),'position',jsonb_build_object('x',760,'y',360))
        ),
        'edges', jsonb_build_array(
          jsonb_build_object('id','e-pdca-1','source','n-pdca-1','target','n-pdca-2'),
          jsonb_build_object('id','e-pdca-2','source','n-pdca-2','target','n-pdca-3'),
          jsonb_build_object('id','e-pdca-3','source','n-pdca-3','target','n-pdca-4'),
          jsonb_build_object('id','e-pdca-4','source','n-pdca-4','target','n-pdca-5')
        )
      ),
      r_support,
      s_pdca
    ),
    (
      p_p2p,
      'P2P — People & process audit',
      'P2P spot checks, scoring, and follow-up in Shift DDS.',
      'published',
      jsonb_build_object(
        'nodes', jsonb_build_array(
          jsonb_build_object('id','n-p2p-1','kind','start','label','P2P scheduled','roleId',r_cell,'forumId',f_p2p,'systemIds',jsonb_build_array(s_p2p,s_plan24),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-p2p-2','kind','process','label','Conduct audit','roleId',r_cell,'forumId',f_p2p,'systemIds',jsonb_build_array(s_p2p),'position',jsonb_build_object('x',220,'y',120)),
          jsonb_build_object('id','n-p2p-3','kind','decision','label','Score acceptable?','roleId',r_cell,'forumId',f_p2p,'systemIds',jsonb_build_array(s_p2p),'position',jsonb_build_object('x',400,'y',200)),
          jsonb_build_object('id','n-p2p-4','kind','process','label','Coach & re-check','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_p2p,s_cl),'position',jsonb_build_object('x',580,'y',280)),
          jsonb_build_object('id','n-p2p-5','kind','end','label','P2P closed','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_p2p,s_ips),'position',jsonb_build_object('x',760,'y',360))
        ),
        'edges', jsonb_build_array(
          jsonb_build_object('id','e-p2p-1','source','n-p2p-1','target','n-p2p-2'),
          jsonb_build_object('id','e-p2p-2','source','n-p2p-2','target','n-p2p-3'),
          jsonb_build_object('id','e-p2p-3','source','n-p2p-3','target','n-p2p-5','label','Yes'),
          jsonb_build_object('id','e-p2p-4','source','n-p2p-3','target','n-p2p-4','label','No'),
          jsonb_build_object('id','e-p2p-5','source','n-p2p-4','target','n-p2p-5')
        )
      ),
      r_cell,
      s_p2p
    )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    flow = excluded.flow,
    owner_role_id = excluded.owner_role_id,
    catalog_system_id = excluded.catalog_system_id,
    updated_at = now();

  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select p.id, 1, to_jsonb(p.*), 'System/tool flow seed'
  from bms_brain_processes p
  where p.id in (p_cl, p_ips, p_plan24, p_wds, p_pdca, p_p2p)
  on conflict (process_id, version_no) do nothing;
end;
$$;

select public.bms_brain_seed_system_flows();

revoke all on function public.bms_brain_seed_system_flows() from public;

notify pgrst, 'reload schema';
