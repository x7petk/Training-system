-- Sample published BMS Brain processes for demo / UX review (idempotent).

create or replace function public.bms_brain_seed_demo_processes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p_shift uuid := 'a1000001-0001-4000-8000-000000000001';
  p_defect uuid := 'a1000001-0001-4000-8000-000000000002';
  p_cil uuid := 'a1000001-0001-4000-8000-000000000003';
  r_operator uuid;
  r_cell uuid;
  r_plant uuid;
  r_site uuid;
  r_support uuid;
  r_maint uuid;
  f_swp uuid;
  f_p2p uuid;
  f_shift uuid;
  f_line uuid;
  f_site uuid;
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
  flow_shift jsonb;
  flow_defect jsonb;
  flow_cil jsonb;
begin
  select id into r_operator from bms_brain_roles where slug = 'operator';
  select id into r_cell from bms_brain_roles where slug = 'cell';
  select id into r_plant from bms_brain_roles where slug = 'plant';
  select id into r_site from bms_brain_roles where slug = 'site';
  select id into r_support from bms_brain_roles where slug = 'support';
  select id into r_maint from bms_brain_roles where slug = 'maintenance';

  select id into f_swp from bms_brain_forums where slug = 'swp';
  select id into f_p2p from bms_brain_forums where slug = 'p2p';
  select id into f_shift from bms_brain_forums where slug = 'shift-dds';
  select id into f_line from bms_brain_forums where slug = 'line-dds';
  select id into f_site from bms_brain_forums where slug = 'site-dds';
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

  flow_shift := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id','n-shift-1','kind','start','label','Shift start / handover','description','Team leader confirms roster, targets, and top losses from previous shift.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_plan24,s_ips),'owner','Cell team leader','inputs','Previous shift DDS notes, Plan 24 roster','outputs','Shift priorities logged','position',jsonb_build_object('x',40,'y',40)),
      jsonb_build_object('id','n-shift-2','kind','process','label','Execute Plan 24 checks','description','Operators complete CL, CIL, and quality checks on the shift grid.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_plan24,s_cl,s_cil),'owner','Operator','inputs','Published standards','outputs','Check completion in Plan 24','position',jsonb_build_object('x',220,'y',120)),
      jsonb_build_object('id','n-shift-3','kind','process','label','P2P audit spot check','description','Cell leader runs a focused P2P on safety and process adherence.','roleId',r_cell,'forumId',f_p2p,'systemIds',jsonb_build_array(s_p2p,s_plan24),'owner','Cell team leader','inputs','P2P question set','outputs','P2P score & actions','position',jsonb_build_object('x',400,'y',200)),
      jsonb_build_object('id','n-shift-4','kind','decision','label','KPIs on target?','description','Review shift KPIs against targets in Shift DDS.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips,s_plan24),'owner','Cell team leader','inputs','Shift KPI values','outputs','Go / no-go for line review','position',jsonb_build_object('x',580,'y',280)),
      jsonb_build_object('id','n-shift-5','kind','review','label','Line DDS review','description','Escalate gaps, assign actions, recognise wins.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_ips,s_plan24),'owner','Plant manager','inputs','Shift DDS pack','outputs','Line actions & owners','position',jsonb_build_object('x',760,'y',360)),
      jsonb_build_object('id','n-shift-6','kind','end','label','Actions tracked in WDS','description','Weekly direction updated from line actions.','roleId',r_site,'forumId',f_wds,'systemIds',jsonb_build_array(s_wds),'owner','Site DDS owner','inputs','Line actions','outputs','WDS board updated','position',jsonb_build_object('x',940,'y',440))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id','e-shift-1','source','n-shift-1','target','n-shift-2'),
      jsonb_build_object('id','e-shift-2','source','n-shift-2','target','n-shift-3'),
      jsonb_build_object('id','e-shift-3','source','n-shift-3','target','n-shift-4'),
      jsonb_build_object('id','e-shift-4','source','n-shift-4','target','n-shift-5','label','No'),
      jsonb_build_object('id','e-shift-5','source','n-shift-5','target','n-shift-6'),
      jsonb_build_object('id','e-shift-6','source','n-shift-4','target','n-shift-6','label','Yes')
    )
  );

  flow_defect := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id','n-dh-1','kind','start','label','Trigger / issue raised','description','Operator identifies defect or deviation on the line.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh,s_plan24),'owner','Operator','inputs','Visual defect, sensor alarm','outputs','DH record opened','position',jsonb_build_object('x',40,'y',40)),
      jsonb_build_object('id','n-dh-2','kind','process','label','Record in DH','description','Log defect type, location, photo, and containment.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh),'owner','Operator','inputs','Defect details','outputs','DH ticket ID','position',jsonb_build_object('x',200,'y',120)),
      jsonb_build_object('id','n-dh-3','kind','decision','label','Standard exists?','description','Check if standard work covers the failure mode.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh,s_cl),'owner','Cell team leader','position',jsonb_build_object('x',380,'y',200)),
      jsonb_build_object('id','n-dh-4','kind','process','label','Apply standard & verify','description','Re-train operator and confirm standard is followed.','roleId',r_cell,'forumId',f_p2p,'systemIds',jsonb_build_array(s_p2p,s_cl),'owner','Cell team leader','position',jsonb_build_object('x',560,'y',280)),
      jsonb_build_object('id','n-dh-5','kind','process','label','Root cause & PDCA','description','Run structured problem solving for repeat or major defects.','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_pdca,s_dh),'owner','Quality engineer','inputs','DH history, photos','outputs','Countermeasure plan','position',jsonb_build_object('x',740,'y',360)),
      jsonb_build_object('id','n-dh-6','kind','review','label','Line DDS review','description','Review defect trend and actions in Line DDS.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_ips,s_dh),'owner','Plant manager','position',jsonb_build_object('x',920,'y',440)),
      jsonb_build_object('id','n-dh-7','kind','end','label','Close loop','description','Confirm defect closed and standard updated.','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_dh,s_cl),'owner','Cell team leader','position',jsonb_build_object('x',1100,'y',520))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id','e-dh-1','source','n-dh-1','target','n-dh-2'),
      jsonb_build_object('id','e-dh-2','source','n-dh-2','target','n-dh-3'),
      jsonb_build_object('id','e-dh-3','source','n-dh-3','target','n-dh-4','label','Yes'),
      jsonb_build_object('id','e-dh-4','source','n-dh-3','target','n-dh-5','label','No'),
      jsonb_build_object('id','e-dh-5','source','n-dh-4','target','n-dh-7'),
      jsonb_build_object('id','e-dh-6','source','n-dh-5','target','n-dh-6'),
      jsonb_build_object('id','e-dh-7','source','n-dh-6','target','n-dh-7')
    )
  );

  flow_cil := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id','n-cil-1','kind','start','label','CIL route due','description','Plan 24 schedules CIL route for the shift.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_plan24,s_cil),'owner','Operator','position',jsonb_build_object('x',40,'y',40)),
      jsonb_build_object('id','n-cil-2','kind','process','label','Execute CIL tasks','description','Complete clean, inspect, lubricate tasks with photos where required.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil,s_plan24),'owner','Operator','position',jsonb_build_object('x',220,'y',120)),
      jsonb_build_object('id','n-cil-3','kind','decision','label','Abnormality found?','description','Any inspect fail or lubrication issue.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil,s_dh),'owner','Operator','position',jsonb_build_object('x',400,'y',200)),
      jsonb_build_object('id','n-cil-4','kind','process','label','Raise DH / tag maintenance','description','Create defect or hand off to maintenance.','roleId',r_maint,'forumId',f_pdca,'systemIds',jsonb_build_array(s_dh,s_cil),'owner','Maintenance technician','position',jsonb_build_object('x',580,'y',280)),
      jsonb_build_object('id','n-cil-5','kind','review','label','Cell sign-off','description','Cell leader verifies route completion in Shift DDS.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_plan24,s_cil),'owner','Cell team leader','position',jsonb_build_object('x',760,'y',360)),
      jsonb_build_object('id','n-cil-6','kind','end','label','Route complete','description','CIL completion feeds line compliance view.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_plan24,s_ips),'owner','Plant manager','position',jsonb_build_object('x',940,'y',440))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id','e-cil-1','source','n-cil-1','target','n-cil-2'),
      jsonb_build_object('id','e-cil-2','source','n-cil-2','target','n-cil-3'),
      jsonb_build_object('id','e-cil-3','source','n-cil-3','target','n-cil-5','label','No'),
      jsonb_build_object('id','e-cil-4','source','n-cil-3','target','n-cil-4','label','Yes'),
      jsonb_build_object('id','e-cil-5','source','n-cil-4','target','n-cil-5'),
      jsonb_build_object('id','e-cil-6','source','n-cil-5','target','n-cil-6')
    )
  );

  insert into bms_brain_processes (id, name, description, status, flow, owner_role_id)
  values
    (
      p_shift,
      'Shift DDS daily rhythm',
      'End-to-end flow from shift handover through Plan 24 execution, P2P, Shift DDS, Line DDS, and WDS actions.',
      'published',
      flow_shift,
      r_cell
    ),
    (
      p_defect,
      'Defect handling escalation',
      'How defects move from the line through DH, standards, PDCA, and Line DDS review.',
      'published',
      flow_defect,
      r_plant
    ),
    (
      p_cil,
      'CIL route execution',
      'CIL route from Plan 24 through abnormality handling, maintenance, and compliance sign-off.',
      'published',
      flow_cil,
      r_maint
    )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    flow = excluded.flow,
    owner_role_id = excluded.owner_role_id,
    updated_at = now();

  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select p.id, 1, to_jsonb(p.*), 'Initial published demo seed'
  from bms_brain_processes p
  where p.id in (p_shift, p_defect, p_cil)
  on conflict (process_id, version_no) do nothing;
end;
$$;

select public.bms_brain_seed_demo_processes();

revoke all on function public.bms_brain_seed_demo_processes() from public;

notify pgrst, 'reload schema';
