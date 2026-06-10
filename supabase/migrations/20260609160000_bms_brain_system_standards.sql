-- BMS Brain system standards: CIL, DH, BDE, IPS, MP&S, Triggers

insert into public.bms_brain_forums (slug, name, description, color, icon, sort_order) values
  ('weekly-maintenance-planning', 'Weekly Maintenance Planning', 'Weekly maintenance planning and scheduling forum.', '#f59e0b', 'calendar-range', 9),
  ('bde-review', 'BDE Review', 'Breakdown event investigation and review forum.', '#dc2626', 'alert-triangle', 10)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into public.bms_brain_systems (slug, name, description, integrations, color, icon, sort_order) values
  ('bde', 'BDE', 'Breakdown event response, investigation and closure.', 'Shift DDS, Line DDS, DH, MP&S, IPS', '#dc2626', 'alert-triangle', 9),
  ('mps', 'MP&S', 'Maintenance planning, scheduling and work execution.', 'DH, BDE, CIL, IPS, Shift DDS', '#f59e0b', 'calendar-range', 10),
  ('triggers', 'Triggers', 'Threshold triggers, assessments and escalation.', 'P2P, Shift DDS, IPS, WDS', '#a855f7', 'zap', 11)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  integrations = excluded.integrations,
  updated_at = now();

update public.bms_brain_systems set
  description = 'Clean, inspect and lubricate tasks — execution, abnormal conditions and defect linkage.',
  integrations = 'Plan 24, DH, MP&S, IPS, Shift DDS'
where slug = 'cil';

update public.bms_brain_systems set
  description = 'Defect handling — identification, prioritisation, maintenance and IPS escalation.',
  integrations = 'CIL, BDE, MP&S, IPS, Shift DDS, Line DDS, WDS'
where slug = 'dh';

update public.bms_brain_systems set
  description = 'Integrated problem solving — local actions through structured IPS and standardisation.',
  integrations = 'CL, CIL, DH, Triggers, BDE, WDS, PDCA'
where slug = 'ips';

create or replace function public.bms_brain_update_system_standards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p_dh uuid := 'a1000001-0001-4000-8000-000000000002';
  p_ips uuid := 'a1000002-0001-4000-8000-000000000002';
  p_mps uuid := 'a1000003-0001-4000-8000-000000000002';
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
  f_ips_review uuid;
  f_weekly_maint uuid;
  f_bde_review uuid;
  s_cil uuid;
  s_dh uuid;
  s_bde uuid;
  s_ips uuid;
  s_mps uuid;
  s_triggers uuid;
  s_cl uuid;
  flow_cil jsonb;
  flow_dh jsonb;
  flow_bde jsonb;
  flow_ips jsonb;
  flow_mps jsonb;
  flow_triggers jsonb;
  next_ver int;
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
  select id into f_ips_review from bms_brain_forums where slug = 'ips-review';
  select id into f_weekly_maint from bms_brain_forums where slug = 'weekly-maintenance-planning';
  select id into f_bde_review from bms_brain_forums where slug = 'bde-review';

  select id into s_cil from bms_brain_systems where slug = 'cil';
  select id into s_dh from bms_brain_systems where slug = 'dh';
  select id into s_bde from bms_brain_systems where slug = 'bde';
  select id into s_ips from bms_brain_systems where slug = 'ips';
  select id into s_mps from bms_brain_systems where slug = 'mps';
  select id into s_triggers from bms_brain_systems where slug = 'triggers';
  select id into s_cl from bms_brain_systems where slug = 'cl';

  flow_cil := jsonb_build_object('nodes', jsonb_build_array(
          jsonb_build_object('id','n-cil-1','kind','start','label','CIL task becomes due','description','Trigger: scheduled task, PftD task or manual request.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil),'owner','Operator','inputs','Plan 24 schedule, PftD task or manual request','position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-cil-2','kind','process','label','Complete cleaning, inspection and lubrication task','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil),'position',jsonb_build_object('x',40,'y',120)),
          jsonb_build_object('id','n-cil-3','kind','process','label','Record completion, readings, comments and evidence','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil),'position',jsonb_build_object('x',40,'y',200)),
          jsonb_build_object('id','n-cil-4','kind','decision','label','Was an abnormal condition identified?','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil),'position',jsonb_build_object('x',40,'y',280)),
          jsonb_build_object('id','n-cil-5y','kind','end','label','Complete CIL task','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil),'position',jsonb_build_object('x',40,'y',380)),
          jsonb_build_object('id','n-cil-5n','kind','process','label','Record abnormal condition','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil),'position',jsonb_build_object('x',240,'y',280)),
          jsonb_build_object('id','n-cil-6','kind','process','label','Create linked defect','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil,s_dh),'position',jsonb_build_object('x',240,'y',360)),
          jsonb_build_object('id','n-cil-7','kind','decision','label','Can the condition be safely restored immediately?','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil,s_dh),'position',jsonb_build_object('x',240,'y',440)),
          jsonb_build_object('id','n-cil-8ry','kind','process','label','Restore condition and record action','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cil,s_dh),'position',jsonb_build_object('x',240,'y',540)),
          jsonb_build_object('id','n-cil-9ry','kind','review','label','Verify condition','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cil,s_dh),'position',jsonb_build_object('x',240,'y',640)),
          jsonb_build_object('id','n-cil-10ry','kind','decision','label','Is the condition restored?','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cil,s_dh),'position',jsonb_build_object('x',240,'y',740)),
          jsonb_build_object('id','n-cil-11ry','kind','end','label','Close linked defect','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cil,s_dh),'position',jsonb_build_object('x',240,'y',840)),
          jsonb_build_object('id','n-cil-8nr','kind','review','label','Review defect priority and risk','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',460,'y',440)),
          jsonb_build_object('id','n-cil-9nr','kind','process','label','Assign owner and due date','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',460,'y',520)),
          jsonb_build_object('id','n-cil-rda','kind','review','label','Review defect and assign corrective action','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',460,'y',740)),
          jsonb_build_object('id','n-cil-10m','kind','decision','label','Is maintenance support required?','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_dh,s_mps),'position',jsonb_build_object('x',460,'y',600)),
          jsonb_build_object('id','n-cil-11my','kind','subprocess','label','Create maintenance work request','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_dh,s_mps),'subprocessProcessId',p_mps,'position',jsonb_build_object('x',680,'y',520)),
          jsonb_build_object('id','n-cil-12my','kind','process','label','Complete maintenance work','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh,s_mps),'position',jsonb_build_object('x',680,'y',620)),
          jsonb_build_object('id','n-cil-11mn','kind','process','label','Complete operational corrective action','roleId',r_cell,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',680,'y',700)),
          jsonb_build_object('id','n-cil-12mn','kind','review','label','Verify defect resolution','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',680,'y',800)),
          jsonb_build_object('id','n-cil-13','kind','decision','label','Is the defect resolved?','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',680,'y',900)),
          jsonb_build_object('id','n-cil-14y','kind','end','label','Close defect','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cil,s_dh),'position',jsonb_build_object('x',680,'y',1000)),
          jsonb_build_object('id','n-cil-14n','kind','decision','label','Is the defect recurring, critical or overdue?','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_dh,s_ips),'position',jsonb_build_object('x',900,'y',900)),
          jsonb_build_object('id','n-cil-15cy','kind','subprocess','label','Create linked IPS','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_cil,s_dh,s_ips),'subprocessProcessId',p_ips,'position',jsonb_build_object('x',900,'y',780)),
          jsonb_build_object('id','n-cil-15cn','kind','process','label','Reassign corrective action','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',900,'y',1000))
        ), 'edges', jsonb_build_array(
          jsonb_build_object('id','e-cil-1','source','n-cil-1','target','n-cil-2'),
          jsonb_build_object('id','e-cil-2','source','n-cil-2','target','n-cil-3'),
          jsonb_build_object('id','e-cil-3','source','n-cil-3','target','n-cil-4'),
          jsonb_build_object('id','e-cil-4','source','n-cil-4','target','n-cil-5y','label','No'),
          jsonb_build_object('id','e-cil-5','source','n-cil-4','target','n-cil-5n','label','Yes'),
          jsonb_build_object('id','e-cil-6','source','n-cil-5n','target','n-cil-6'),
          jsonb_build_object('id','e-cil-7','source','n-cil-6','target','n-cil-7'),
          jsonb_build_object('id','e-cil-8','source','n-cil-7','target','n-cil-8ry','label','Yes'),
          jsonb_build_object('id','e-cil-9','source','n-cil-7','target','n-cil-8nr','label','No'),
          jsonb_build_object('id','e-cil-10','source','n-cil-8ry','target','n-cil-9ry'),
          jsonb_build_object('id','e-cil-11','source','n-cil-9ry','target','n-cil-10ry'),
          jsonb_build_object('id','e-cil-12','source','n-cil-10ry','target','n-cil-11ry','label','Yes'),
          jsonb_build_object('id','e-cil-13','source','n-cil-10ry','target','n-cil-rda','label','No'),
          jsonb_build_object('id','e-cil-14','source','n-cil-8nr','target','n-cil-9nr'),
          jsonb_build_object('id','e-cil-15','source','n-cil-9nr','target','n-cil-10m'),
          jsonb_build_object('id','e-cil-16','source','n-cil-rda','target','n-cil-10m'),
          jsonb_build_object('id','e-cil-17','source','n-cil-10m','target','n-cil-11my','label','Yes'),
          jsonb_build_object('id','e-cil-18','source','n-cil-10m','target','n-cil-11mn','label','No'),
          jsonb_build_object('id','e-cil-19','source','n-cil-11my','target','n-cil-12my'),
          jsonb_build_object('id','e-cil-20','source','n-cil-12my','target','n-cil-13'),
          jsonb_build_object('id','e-cil-21','source','n-cil-11mn','target','n-cil-12mn'),
          jsonb_build_object('id','e-cil-22','source','n-cil-12mn','target','n-cil-13'),
          jsonb_build_object('id','e-cil-23','source','n-cil-13','target','n-cil-14y','label','Yes'),
          jsonb_build_object('id','e-cil-24','source','n-cil-13','target','n-cil-14n','label','No'),
          jsonb_build_object('id','e-cil-25','source','n-cil-14n','target','n-cil-15cy','label','Yes'),
          jsonb_build_object('id','e-cil-26','source','n-cil-14n','target','n-cil-15cn','label','No')
        ));

  update bms_brain_processes
  set
    name = 'CIL — Clean, inspect and lubricate',
    description = 'CIL task execution, abnormal conditions, defect linkage and corrective paths.',
    status = 'published',
    flow = flow_cil,
    owner_role_id = r_cell,
    catalog_system_id = s_cil,
    updated_at = now()
  where id = 'a1000001-0001-4000-8000-000000000003';

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      'a1000001-0001-4000-8000-000000000003',
      'CIL — Clean, inspect and lubricate',
      'CIL task execution, abnormal conditions, defect linkage and corrective paths.',
      'published',
      flow_cil,
      r_cell,
      s_cil
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver from bms_brain_process_versions where process_id = 'a1000001-0001-4000-8000-000000000003';
  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select 'a1000001-0001-4000-8000-000000000003', next_ver, to_jsonb(p.*), 'CIL — Clean, inspect and lubricate standard'
  from bms_brain_processes p where p.id = 'a1000001-0001-4000-8000-000000000003';

  flow_dh := jsonb_build_object('nodes', jsonb_build_array(
          jsonb_build_object('id','n-dh-1','kind','start','label','Defect identified','description','Trigger: CIL finding, inspection, failed check, breakdown, audit or manual identification.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-dh-2','kind','process','label','Record defect details','description','Record equipment, location, description, source, image, risk and comments.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',40,'y',120)),
          jsonb_build_object('id','n-dh-3','kind','process','label','Assign default equipment owner','description','System assigns default equipment owner in Shift DDS.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',40,'y',200)),
          jsonb_build_object('id','n-dh-4','kind','review','label','Review defect severity and priority','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',40,'y',280)),
          jsonb_build_object('id','n-dh-5','kind','decision','label','Is there an immediate safety, quality or production risk?','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',40,'y',360)),
          jsonb_build_object('id','n-dh-6y','kind','process','label','Make condition safe','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',240,'y',360)),
          jsonb_build_object('id','n-dh-7y','kind','process','label','Escalate critical defect','roleId',r_plant,'forumId',f_site,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',240,'y',460)),
          jsonb_build_object('id','n-dh-8y','kind','process','label','Assign immediate response','roleId',r_plant,'forumId',f_site,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',240,'y',560)),
          jsonb_build_object('id','n-dh-6n','kind','process','label','Assign corrective action, owner and due date','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',460,'y',360)),
          jsonb_build_object('id','n-dh-7n','kind','decision','label','Is maintenance work required?','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_dh,s_mps),'position',jsonb_build_object('x',460,'y',460)),
          jsonb_build_object('id','n-dh-8my','kind','subprocess','label','Create linked maintenance work request','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_dh,s_mps),'subprocessProcessId',p_mps,'position',jsonb_build_object('x',680,'y',400)),
          jsonb_build_object('id','n-dh-9my','kind','process','label','Plan and execute maintenance work','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh,s_mps),'position',jsonb_build_object('x',680,'y',500)),
          jsonb_build_object('id','n-dh-8mn','kind','process','label','Complete operational corrective action','roleId',r_cell,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',680,'y',580)),
          jsonb_build_object('id','n-dh-9mn','kind','process','label','Record action completion and evidence','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_dh),'owner','Action owner','position',jsonb_build_object('x',680,'y',680)),
          jsonb_build_object('id','n-dh-10','kind','review','label','Verify defect resolution','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',680,'y',780)),
          jsonb_build_object('id','n-dh-11','kind','decision','label','Is the defect fully resolved?','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',680,'y',880)),
          jsonb_build_object('id','n-dh-12y','kind','end','label','Close defect','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',680,'y',980)),
          jsonb_build_object('id','n-dh-12n','kind','process','label','Return defect to owner','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',900,'y',880)),
          jsonb_build_object('id','n-dh-13','kind','decision','label','Is the defect recurring, high severity or overdue?','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_dh,s_ips),'position',jsonb_build_object('x',900,'y',980)),
          jsonb_build_object('id','n-dh-14y','kind','subprocess','label','Create linked IPS','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_dh,s_ips),'subprocessProcessId',p_ips,'position',jsonb_build_object('x',1120,'y',880)),
          jsonb_build_object('id','n-dh-15y','kind','review','label','Monitor corrective actions','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_dh,s_ips),'position',jsonb_build_object('x',1120,'y',980)),
          jsonb_build_object('id','n-dh-14n','kind','process','label','Reassign action and due date','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',1120,'y',1080)),
          jsonb_build_object('id','n-dh-16','kind','review','label','Review open and overdue defects','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_dh),'position',jsonb_build_object('x',40,'y',680)),
          jsonb_build_object('id','n-dh-17','kind','review','label','Review recurring and systemic defects','roleId',r_site,'forumId',f_pdca,'systemIds',jsonb_build_array(s_dh,s_ips),'position',jsonb_build_object('x',40,'y',780))
        ), 'edges', jsonb_build_array(
          jsonb_build_object('id','e-dh-1','source','n-dh-1','target','n-dh-2'),
          jsonb_build_object('id','e-dh-2','source','n-dh-2','target','n-dh-3'),
          jsonb_build_object('id','e-dh-3','source','n-dh-3','target','n-dh-4'),
          jsonb_build_object('id','e-dh-4','source','n-dh-4','target','n-dh-5'),
          jsonb_build_object('id','e-dh-5','source','n-dh-5','target','n-dh-6y','label','Yes'),
          jsonb_build_object('id','e-dh-6','source','n-dh-6y','target','n-dh-7y'),
          jsonb_build_object('id','e-dh-7','source','n-dh-7y','target','n-dh-8y'),
          jsonb_build_object('id','e-dh-7b','source','n-dh-8y','target','n-dh-10'),
          jsonb_build_object('id','e-dh-8','source','n-dh-5','target','n-dh-6n','label','No'),
          jsonb_build_object('id','e-dh-9','source','n-dh-6n','target','n-dh-7n'),
          jsonb_build_object('id','e-dh-10','source','n-dh-7n','target','n-dh-8my','label','Yes'),
          jsonb_build_object('id','e-dh-11','source','n-dh-7n','target','n-dh-8mn','label','No'),
          jsonb_build_object('id','e-dh-12','source','n-dh-8my','target','n-dh-9my'),
          jsonb_build_object('id','e-dh-13','source','n-dh-9my','target','n-dh-10'),
          jsonb_build_object('id','e-dh-14','source','n-dh-8mn','target','n-dh-9mn'),
          jsonb_build_object('id','e-dh-15','source','n-dh-9mn','target','n-dh-10'),
          jsonb_build_object('id','e-dh-16','source','n-dh-10','target','n-dh-11'),
          jsonb_build_object('id','e-dh-17','source','n-dh-11','target','n-dh-12y','label','Yes'),
          jsonb_build_object('id','e-dh-18','source','n-dh-11','target','n-dh-12n','label','No'),
          jsonb_build_object('id','e-dh-19','source','n-dh-12n','target','n-dh-13'),
          jsonb_build_object('id','e-dh-20','source','n-dh-13','target','n-dh-14y','label','Yes'),
          jsonb_build_object('id','e-dh-21','source','n-dh-13','target','n-dh-14n','label','No'),
          jsonb_build_object('id','e-dh-22','source','n-dh-14y','target','n-dh-15y'),
          jsonb_build_object('id','e-dh-23','source','n-dh-16','target','n-dh-17')
        ));

  update bms_brain_processes
  set
    name = 'DH — Defect handling',
    description = 'Defect identification, prioritisation, maintenance linkage, IPS escalation and periodic review.',
    status = 'published',
    flow = flow_dh,
    owner_role_id = r_cell,
    catalog_system_id = s_dh,
    updated_at = now()
  where id = 'a1000001-0001-4000-8000-000000000002';

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      'a1000001-0001-4000-8000-000000000002',
      'DH — Defect handling',
      'Defect identification, prioritisation, maintenance linkage, IPS escalation and periodic review.',
      'published',
      flow_dh,
      r_cell,
      s_dh
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver from bms_brain_process_versions where process_id = 'a1000001-0001-4000-8000-000000000002';
  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select 'a1000001-0001-4000-8000-000000000002', next_ver, to_jsonb(p.*), 'DH — Defect handling standard'
  from bms_brain_processes p where p.id = 'a1000001-0001-4000-8000-000000000002';

  flow_bde := jsonb_build_object('nodes', jsonb_build_array(
          jsonb_build_object('id','n-bde-1','kind','start','label','Equipment breakdown occurs','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-bde-2','kind','process','label','Stop equipment, make safe and notify support','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',40,'y',120)),
          jsonb_build_object('id','n-bde-3','kind','process','label','Create breakdown event','description','Record equipment, start time, symptoms, production impact and evidence.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',40,'y',200)),
          jsonb_build_object('id','n-bde-4','kind','process','label','Diagnose breakdown','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',40,'y',280)),
          jsonb_build_object('id','n-bde-5','kind','process','label','Restore equipment','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',40,'y',360)),
          jsonb_build_object('id','n-bde-6','kind','process','label','Record restoration time, downtime and initial cause','roleId',r_maint,'forumId',f_shift,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',40,'y',440)),
          jsonb_build_object('id','n-bde-7','kind','decision','label','Has the breakdown investigation threshold been met?','description','Criteria: duration, recurrence, safety, quality, cost or production impact.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',40,'y',520)),
          jsonb_build_object('id','n-bde-8n','kind','process','label','Record breakdown category and failure mode','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',260,'y',520)),
          jsonb_build_object('id','n-bde-9n','kind','decision','label','Is follow-up work required?','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_bde,s_dh),'position',jsonb_build_object('x',260,'y',620)),
          jsonb_build_object('id','n-bde-10ny','kind','subprocess','label','Create linked defect or maintenance request','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_bde,s_dh,s_mps),'subprocessProcessId',p_mps,'position',jsonb_build_object('x',260,'y',720)),
          jsonb_build_object('id','n-bde-10nn','kind','end','label','Close standard breakdown event','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',260,'y',820)),
          jsonb_build_object('id','n-bde-8y','kind','process','label','Assign BDE owner and investigation team','roleId',r_plant,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',480,'y',400)),
          jsonb_build_object('id','n-bde-9y','kind','process','label','Confirm problem statement and event timeline','roleId',r_plant,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',480,'y',480)),
          jsonb_build_object('id','n-bde-10y','kind','process','label','Collect evidence and confirm failure mode','roleId',r_maint,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',480,'y',560)),
          jsonb_build_object('id','n-bde-11y','kind','process','label','Complete root cause analysis','roleId',r_support,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',480,'y',640)),
          jsonb_build_object('id','n-bde-12y','kind','decision','label','Has the root cause been confirmed?','roleId',r_plant,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',480,'y',720)),
          jsonb_build_object('id','n-bde-13yn','kind','process','label','Collect additional evidence','roleId',r_maint,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',700,'y',640)),
          jsonb_build_object('id','n-bde-13yy','kind','process','label','Define corrective and preventive actions','roleId',r_plant,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',700,'y',760)),
          jsonb_build_object('id','n-bde-14y','kind','process','label','Assign owners and due dates','roleId',r_plant,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',700,'y',840)),
          jsonb_build_object('id','n-bde-15y','kind','subprocess','label','Create maintenance or improvement work','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_bde,s_mps,s_ips),'subprocessProcessId',p_mps,'position',jsonb_build_object('x',700,'y',920)),
          jsonb_build_object('id','n-bde-16y','kind','process','label','Complete assigned actions','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_bde,s_mps),'owner','Action owner','position',jsonb_build_object('x',920,'y',920)),
          jsonb_build_object('id','n-bde-17y','kind','review','label','Verify effectiveness and recurrence','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',920,'y',1020)),
          jsonb_build_object('id','n-bde-18y','kind','decision','label','Were actions effective?','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',920,'y',1120)),
          jsonb_build_object('id','n-bde-19yn','kind','process','label','Reopen investigation','roleId',r_plant,'forumId',f_bde_review,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',1140,'y',1020)),
          jsonb_build_object('id','n-bde-19yy','kind','end','label','Approve and close BDE','roleId',r_site,'forumId',f_pdca,'systemIds',jsonb_build_array(s_bde),'position',jsonb_build_object('x',1140,'y',1220))
        ), 'edges', jsonb_build_array(
          jsonb_build_object('id','e-bde-1','source','n-bde-1','target','n-bde-2'),
          jsonb_build_object('id','e-bde-2','source','n-bde-2','target','n-bde-3'),
          jsonb_build_object('id','e-bde-3','source','n-bde-3','target','n-bde-4'),
          jsonb_build_object('id','e-bde-4','source','n-bde-4','target','n-bde-5'),
          jsonb_build_object('id','e-bde-5','source','n-bde-5','target','n-bde-6'),
          jsonb_build_object('id','e-bde-6','source','n-bde-6','target','n-bde-7'),
          jsonb_build_object('id','e-bde-7','source','n-bde-7','target','n-bde-8n','label','No'),
          jsonb_build_object('id','e-bde-8','source','n-bde-8n','target','n-bde-9n'),
          jsonb_build_object('id','e-bde-9','source','n-bde-9n','target','n-bde-10ny','label','Yes'),
          jsonb_build_object('id','e-bde-10','source','n-bde-9n','target','n-bde-10nn','label','No'),
          jsonb_build_object('id','e-bde-11','source','n-bde-7','target','n-bde-8y','label','Yes'),
          jsonb_build_object('id','e-bde-12','source','n-bde-8y','target','n-bde-9y'),
          jsonb_build_object('id','e-bde-13','source','n-bde-9y','target','n-bde-10y'),
          jsonb_build_object('id','e-bde-14','source','n-bde-10y','target','n-bde-11y'),
          jsonb_build_object('id','e-bde-15','source','n-bde-11y','target','n-bde-12y'),
          jsonb_build_object('id','e-bde-16','source','n-bde-12y','target','n-bde-13yn','label','No'),
          jsonb_build_object('id','e-bde-17','source','n-bde-13yn','target','n-bde-11y'),
          jsonb_build_object('id','e-bde-18','source','n-bde-12y','target','n-bde-13yy','label','Yes'),
          jsonb_build_object('id','e-bde-19','source','n-bde-13yy','target','n-bde-14y'),
          jsonb_build_object('id','e-bde-20','source','n-bde-14y','target','n-bde-15y'),
          jsonb_build_object('id','e-bde-21','source','n-bde-15y','target','n-bde-16y'),
          jsonb_build_object('id','e-bde-22','source','n-bde-16y','target','n-bde-17y'),
          jsonb_build_object('id','e-bde-23','source','n-bde-17y','target','n-bde-18y'),
          jsonb_build_object('id','e-bde-24','source','n-bde-18y','target','n-bde-19yn','label','No'),
          jsonb_build_object('id','e-bde-25','source','n-bde-19yn','target','n-bde-11y'),
          jsonb_build_object('id','e-bde-26','source','n-bde-18y','target','n-bde-19yy','label','Yes')
        ));

  update bms_brain_processes
  set
    name = 'BDE — Breakdown event',
    description = 'Breakdown response, standard closure, investigation, RCA and effectiveness verification.',
    status = 'published',
    flow = flow_bde,
    owner_role_id = r_plant,
    catalog_system_id = s_bde,
    updated_at = now()
  where id = 'a1000003-0001-4000-8000-000000000001';

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      'a1000003-0001-4000-8000-000000000001',
      'BDE — Breakdown event',
      'Breakdown response, standard closure, investigation, RCA and effectiveness verification.',
      'published',
      flow_bde,
      r_plant,
      s_bde
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver from bms_brain_process_versions where process_id = 'a1000003-0001-4000-8000-000000000001';
  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select 'a1000003-0001-4000-8000-000000000001', next_ver, to_jsonb(p.*), 'BDE — Breakdown event standard'
  from bms_brain_processes p where p.id = 'a1000003-0001-4000-8000-000000000001';

  flow_ips := jsonb_build_object('nodes', jsonb_build_array(
          jsonb_build_object('id','n-ips-1','kind','start','label','Problem-solving trigger identified','description','Trigger: repeating defect, KPI gap, trigger, breakdown, quality issue, CL deviation or audit finding.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-ips-2','kind','review','label','Review issue, impact and available evidence','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',40,'y',120)),
          jsonb_build_object('id','n-ips-3','kind','decision','label','Is structured problem solving required?','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',40,'y',200)),
          jsonb_build_object('id','n-ips-4n','kind','process','label','Create local corrective action','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',260,'y',200)),
          jsonb_build_object('id','n-ips-5n','kind','review','label','Complete and verify local action','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',260,'y',280)),
          jsonb_build_object('id','n-ips-6n','kind','end','label','Close local issue','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',260,'y',360)),
          jsonb_build_object('id','n-ips-4y','kind','process','label','Create IPS and link the source record','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',120)),
          jsonb_build_object('id','n-ips-5y','kind','process','label','Assign IPS owner and problem-solving team','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',200)),
          jsonb_build_object('id','n-ips-6y','kind','process','label','Define the problem statement','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',280)),
          jsonb_build_object('id','n-ips-7y','kind','process','label','Define target condition and success criteria','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',360)),
          jsonb_build_object('id','n-ips-8y','kind','process','label','Implement immediate containment','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',440)),
          jsonb_build_object('id','n-ips-9y','kind','process','label','Collect data and confirm current condition','roleId',r_support,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',520)),
          jsonb_build_object('id','n-ips-10y','kind','process','label','Identify potential causes','roleId',r_support,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'owner','Problem-solving team','position',jsonb_build_object('x',480,'y',600)),
          jsonb_build_object('id','n-ips-11y','kind','review','label','Validate the root cause','roleId',r_support,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',680)),
          jsonb_build_object('id','n-ips-12y','kind','decision','label','Has the root cause been validated?','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',480,'y',760)),
          jsonb_build_object('id','n-ips-13yn','kind','process','label','Collect more evidence and revise analysis','roleId',r_support,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',700,'y',680)),
          jsonb_build_object('id','n-ips-13yy','kind','process','label','Define countermeasures','roleId',r_support,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'owner','Problem-solving team','position',jsonb_build_object('x',700,'y',840)),
          jsonb_build_object('id','n-ips-14y','kind','process','label','Assign countermeasure owners and due dates','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',700,'y',920)),
          jsonb_build_object('id','n-ips-15y','kind','process','label','Execute countermeasures','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_ips),'owner','Action owner','position',jsonb_build_object('x',700,'y',1000)),
          jsonb_build_object('id','n-ips-16y','kind','review','label','Verify results against success criteria','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',920,'y',1000)),
          jsonb_build_object('id','n-ips-17y','kind','decision','label','Were countermeasures effective?','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',920,'y',1080)),
          jsonb_build_object('id','n-ips-18yn','kind','process','label','Reopen root cause analysis','roleId',r_support,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',1140,'y',1000)),
          jsonb_build_object('id','n-ips-18yy','kind','process','label','Standardise successful countermeasures','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_ips,s_cl,s_cil,s_dh),'position',jsonb_build_object('x',1140,'y',1160)),
          jsonb_build_object('id','n-ips-19y','kind','process','label','Update standards, training and controls','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',1140,'y',1240)),
          jsonb_build_object('id','n-ips-20y','kind','end','label','Approve and close IPS','roleId',r_site,'forumId',f_pdca,'systemIds',jsonb_build_array(s_ips),'position',jsonb_build_object('x',1140,'y',1320))
        ), 'edges', jsonb_build_array(
          jsonb_build_object('id','e-ips-1','source','n-ips-1','target','n-ips-2'),
          jsonb_build_object('id','e-ips-2','source','n-ips-2','target','n-ips-3'),
          jsonb_build_object('id','e-ips-3','source','n-ips-3','target','n-ips-4n','label','No'),
          jsonb_build_object('id','e-ips-4','source','n-ips-4n','target','n-ips-5n'),
          jsonb_build_object('id','e-ips-5','source','n-ips-5n','target','n-ips-6n'),
          jsonb_build_object('id','e-ips-6','source','n-ips-3','target','n-ips-4y','label','Yes'),
          jsonb_build_object('id','e-ips-7','source','n-ips-4y','target','n-ips-5y'),
          jsonb_build_object('id','e-ips-8','source','n-ips-5y','target','n-ips-6y'),
          jsonb_build_object('id','e-ips-9','source','n-ips-6y','target','n-ips-7y'),
          jsonb_build_object('id','e-ips-10','source','n-ips-7y','target','n-ips-8y'),
          jsonb_build_object('id','e-ips-11','source','n-ips-8y','target','n-ips-9y'),
          jsonb_build_object('id','e-ips-12','source','n-ips-9y','target','n-ips-10y'),
          jsonb_build_object('id','e-ips-13','source','n-ips-10y','target','n-ips-11y'),
          jsonb_build_object('id','e-ips-14','source','n-ips-11y','target','n-ips-12y'),
          jsonb_build_object('id','e-ips-15','source','n-ips-12y','target','n-ips-13yn','label','No'),
          jsonb_build_object('id','e-ips-16','source','n-ips-13yn','target','n-ips-10y'),
          jsonb_build_object('id','e-ips-17','source','n-ips-12y','target','n-ips-13yy','label','Yes'),
          jsonb_build_object('id','e-ips-18','source','n-ips-13yy','target','n-ips-14y'),
          jsonb_build_object('id','e-ips-19','source','n-ips-14y','target','n-ips-15y'),
          jsonb_build_object('id','e-ips-20','source','n-ips-15y','target','n-ips-16y'),
          jsonb_build_object('id','e-ips-21','source','n-ips-16y','target','n-ips-17y'),
          jsonb_build_object('id','e-ips-22','source','n-ips-17y','target','n-ips-18yn','label','No'),
          jsonb_build_object('id','e-ips-23','source','n-ips-18yn','target','n-ips-10y'),
          jsonb_build_object('id','e-ips-24','source','n-ips-17y','target','n-ips-18yy','label','Yes'),
          jsonb_build_object('id','e-ips-25','source','n-ips-18yy','target','n-ips-19y'),
          jsonb_build_object('id','e-ips-26','source','n-ips-19y','target','n-ips-20y')
        ));

  update bms_brain_processes
  set
    name = 'IPS — Integrated problem solving',
    description = 'Structured problem solving from trigger through containment, RCA, countermeasures and standardisation.',
    status = 'published',
    flow = flow_ips,
    owner_role_id = r_plant,
    catalog_system_id = s_ips,
    updated_at = now()
  where id = 'a1000002-0001-4000-8000-000000000002';

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      'a1000002-0001-4000-8000-000000000002',
      'IPS — Integrated problem solving',
      'Structured problem solving from trigger through containment, RCA, countermeasures and standardisation.',
      'published',
      flow_ips,
      r_plant,
      s_ips
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver from bms_brain_process_versions where process_id = 'a1000002-0001-4000-8000-000000000002';
  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select 'a1000002-0001-4000-8000-000000000002', next_ver, to_jsonb(p.*), 'IPS — Integrated problem solving standard'
  from bms_brain_processes p where p.id = 'a1000002-0001-4000-8000-000000000002';

  flow_mps := jsonb_build_object('nodes', jsonb_build_array(
          jsonb_build_object('id','n-mps-1','kind','start','label','Maintenance work demand created','description','Trigger: DH defect, BDE action, CIL finding, IPS action, inspection or planned maintenance requirement.','roleId',r_maint,'forumId',f_shift,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-mps-2','kind','review','label','Review and validate work request','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',40,'y',120)),
          jsonb_build_object('id','n-mps-3','kind','decision','label','Is the request valid and sufficiently defined?','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',40,'y',200)),
          jsonb_build_object('id','n-mps-4n','kind','process','label','Return request for additional information','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',260,'y',200)),
          jsonb_build_object('id','n-mps-4y','kind','process','label','Assess priority, risk and equipment criticality','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',260,'y',120)),
          jsonb_build_object('id','n-mps-5','kind','decision','label','Is immediate work required?','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',260,'y',280)),
          jsonb_build_object('id','n-mps-6ey','kind','process','label','Escalate and arrange immediate execution','roleId',r_plant,'forumId',f_shift,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',480,'y',200)),
          jsonb_build_object('id','n-mps-7ey','kind','process','label','Execute emergency maintenance work','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',480,'y',280)),
          jsonb_build_object('id','n-mps-6en','kind','process','label','Define work scope','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',480,'y',360)),
          jsonb_build_object('id','n-mps-7en','kind','process','label','Plan labour, parts, tools, permits and duration','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',480,'y',440)),
          jsonb_build_object('id','n-mps-8en','kind','review','label','Confirm production access and operating window','roleId',r_plant,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',480,'y',520)),
          jsonb_build_object('id','n-mps-9en','kind','decision','label','Is the work ready to schedule?','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',480,'y',600)),
          jsonb_build_object('id','n-mps-10nb','kind','process','label','Place work in planning backlog','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',700,'y',520)),
          jsonb_build_object('id','n-mps-11nb','kind','process','label','Resolve planning constraints','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',700,'y',600)),
          jsonb_build_object('id','n-mps-10y','kind','process','label','Add work to the agreed weekly schedule','roleId',r_maint,'forumId',f_weekly_maint,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',700,'y',680)),
          jsonb_build_object('id','n-mps-11y','kind','review','label','Confirm schedule with operations','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',700,'y',760)),
          jsonb_build_object('id','n-mps-12y','kind','process','label','Release work for execution','roleId',r_maint,'forumId',f_p2p,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',700,'y',840)),
          jsonb_build_object('id','n-mps-13y','kind','process','label','Execute maintenance work','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',920,'y',840)),
          jsonb_build_object('id','n-mps-14y','kind','process','label','Record labour, parts, findings and completion status','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',920,'y',920)),
          jsonb_build_object('id','n-mps-15','kind','decision','label','Was additional work identified?','roleId',r_maint,'forumId',f_swp,'systemIds',jsonb_build_array(s_mps,s_dh),'position',jsonb_build_object('x',920,'y',1000)),
          jsonb_build_object('id','n-mps-16y','kind','process','label','Create linked defect or follow-up work request','roleId',r_maint,'forumId',f_shift,'systemIds',jsonb_build_array(s_mps,s_dh),'position',jsonb_build_object('x',1140,'y',920)),
          jsonb_build_object('id','n-mps-16n','kind','decision','label','Is the work technically complete?','roleId',r_maint,'forumId',f_shift,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',1140,'y',1080)),
          jsonb_build_object('id','n-mps-17nr','kind','process','label','Return work for completion','roleId',r_maint,'forumId',f_line,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',1360,'y',1000)),
          jsonb_build_object('id','n-mps-17ny','kind','end','label','Close maintenance work','roleId',r_maint,'forumId',f_shift,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',1360,'y',1160)),
          jsonb_build_object('id','n-mps-18','kind','review','label','Review weekly schedule compliance','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',40,'y',720)),
          jsonb_build_object('id','n-mps-19','kind','review','label','Review backlog, overdue work and planning losses','roleId',r_site,'forumId',f_pdca,'systemIds',jsonb_build_array(s_mps),'position',jsonb_build_object('x',40,'y',820))
        ), 'edges', jsonb_build_array(
          jsonb_build_object('id','e-mps-1','source','n-mps-1','target','n-mps-2'),
          jsonb_build_object('id','e-mps-2','source','n-mps-2','target','n-mps-3'),
          jsonb_build_object('id','e-mps-3','source','n-mps-3','target','n-mps-4n','label','No'),
          jsonb_build_object('id','e-mps-4','source','n-mps-4n','target','n-mps-2'),
          jsonb_build_object('id','e-mps-5','source','n-mps-3','target','n-mps-4y','label','Yes'),
          jsonb_build_object('id','e-mps-6','source','n-mps-4y','target','n-mps-5'),
          jsonb_build_object('id','e-mps-7','source','n-mps-5','target','n-mps-6ey','label','Yes'),
          jsonb_build_object('id','e-mps-8','source','n-mps-6ey','target','n-mps-7ey'),
          jsonb_build_object('id','e-mps-9','source','n-mps-5','target','n-mps-6en','label','No'),
          jsonb_build_object('id','e-mps-10','source','n-mps-6en','target','n-mps-7en'),
          jsonb_build_object('id','e-mps-11','source','n-mps-7en','target','n-mps-8en'),
          jsonb_build_object('id','e-mps-12','source','n-mps-8en','target','n-mps-9en'),
          jsonb_build_object('id','e-mps-13','source','n-mps-9en','target','n-mps-10nb','label','No'),
          jsonb_build_object('id','e-mps-14','source','n-mps-10nb','target','n-mps-11nb'),
          jsonb_build_object('id','e-mps-15','source','n-mps-11nb','target','n-mps-9en'),
          jsonb_build_object('id','e-mps-16','source','n-mps-9en','target','n-mps-10y','label','Yes'),
          jsonb_build_object('id','e-mps-17','source','n-mps-10y','target','n-mps-11y'),
          jsonb_build_object('id','e-mps-18','source','n-mps-11y','target','n-mps-12y'),
          jsonb_build_object('id','e-mps-19','source','n-mps-12y','target','n-mps-13y'),
          jsonb_build_object('id','e-mps-20','source','n-mps-13y','target','n-mps-14y'),
          jsonb_build_object('id','e-mps-21','source','n-mps-14y','target','n-mps-15'),
          jsonb_build_object('id','e-mps-22','source','n-mps-15','target','n-mps-16y','label','Yes'),
          jsonb_build_object('id','e-mps-23','source','n-mps-15','target','n-mps-16n','label','No'),
          jsonb_build_object('id','e-mps-24','source','n-mps-16n','target','n-mps-17nr','label','No'),
          jsonb_build_object('id','e-mps-25','source','n-mps-16n','target','n-mps-17ny','label','Yes'),
          jsonb_build_object('id','e-mps-26','source','n-mps-18','target','n-mps-19')
        ));

  update bms_brain_processes
  set
    name = 'MP&S — Maintenance planning and scheduling',
    description = 'Work demand validation, planning, scheduling, execution and closure.',
    status = 'published',
    flow = flow_mps,
    owner_role_id = r_maint,
    catalog_system_id = s_mps,
    updated_at = now()
  where id = 'a1000003-0001-4000-8000-000000000002';

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      'a1000003-0001-4000-8000-000000000002',
      'MP&S — Maintenance planning and scheduling',
      'Work demand validation, planning, scheduling, execution and closure.',
      'published',
      flow_mps,
      r_maint,
      s_mps
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver from bms_brain_process_versions where process_id = 'a1000003-0001-4000-8000-000000000002';
  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select 'a1000003-0001-4000-8000-000000000002', next_ver, to_jsonb(p.*), 'MP&S — Maintenance planning and scheduling standard'
  from bms_brain_processes p where p.id = 'a1000003-0001-4000-8000-000000000002';

  flow_triggers := jsonb_build_object('nodes', jsonb_build_array(
          jsonb_build_object('id','n-trg-1','kind','start','label','Define trigger questions and conditions','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',40,'y',40)),
          jsonb_build_object('id','n-trg-2','kind','process','label','Configure trigger thresholds and severity levels','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',40,'y',120)),
          jsonb_build_object('id','n-trg-3','kind','process','label','Assign triggers to applicable sites, roles and forums','roleId',r_support,'forumId',f_wds,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',40,'y',200)),
          jsonb_build_object('id','n-trg-4','kind','start','label','Trigger assessment becomes due','description','Trigger: scheduled assessment, business event or threshold check.','roleId',r_operator,'forumId',f_p2p,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',280,'y',40)),
          jsonb_build_object('id','n-trg-5','kind','process','label','Complete trigger questions','roleId',r_operator,'forumId',f_p2p,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',280,'y',120)),
          jsonb_build_object('id','n-trg-6','kind','process','label','Record responses and evidence','roleId',r_operator,'forumId',f_p2p,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',280,'y',200)),
          jsonb_build_object('id','n-trg-7','kind','process','label','Evaluate responses against configured thresholds','description','System evaluates responses against configured thresholds.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',280,'y',280)),
          jsonb_build_object('id','n-trg-8','kind','decision','label','Has a trigger condition been met?','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',280,'y',360)),
          jsonb_build_object('id','n-trg-9n','kind','end','label','Record compliant result','roleId',r_operator,'forumId',f_shift,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',280,'y',460)),
          jsonb_build_object('id','n-trg-9y','kind','process','label','Create trigger event and notify owner','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',500,'y',360)),
          jsonb_build_object('id','n-trg-10','kind','review','label','Review trigger severity and impact','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',500,'y',440)),
          jsonb_build_object('id','n-trg-11','kind','decision','label','Is immediate containment required?','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',500,'y',520)),
          jsonb_build_object('id','n-trg-12y','kind','process','label','Implement immediate containment','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',500,'y',600)),
          jsonb_build_object('id','n-trg-13','kind','decision','label','Is structured problem solving required?','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',720,'y',520)),
          jsonb_build_object('id','n-trg-14n','kind','process','label','Assign local corrective action and due date','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',720,'y',640)),
          jsonb_build_object('id','n-trg-15n','kind','process','label','Complete corrective action','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_triggers),'owner','Action owner','position',jsonb_build_object('x',720,'y',720)),
          jsonb_build_object('id','n-trg-16n','kind','review','label','Verify action effectiveness','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',720,'y',800)),
          jsonb_build_object('id','n-trg-17n','kind','decision','label','Was the action effective?','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',720,'y',880)),
          jsonb_build_object('id','n-trg-18n','kind','end','label','Close trigger event','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',720,'y',960)),
          jsonb_build_object('id','n-trg-14y','kind','subprocess','label','Create linked IPS','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_triggers,s_ips),'subprocessProcessId',p_ips,'position',jsonb_build_object('x',940,'y',440)),
          jsonb_build_object('id','n-trg-15y','kind','process','label','Assign IPS owner','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',940,'y',520)),
          jsonb_build_object('id','n-trg-16y','kind','review','label','Monitor IPS progress','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',940,'y',600)),
          jsonb_build_object('id','n-trg-17y','kind','decision','label','Is the trigger response overdue or critical?','roleId',r_site,'forumId',f_site,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',940,'y',680)),
          jsonb_build_object('id','n-trg-18ey','kind','process','label','Escalate to site leadership','roleId',r_site,'forumId',f_site,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',1160,'y',600)),
          jsonb_build_object('id','n-trg-19ey','kind','review','label','Continue monitoring until resolved','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',1160,'y',680)),
          jsonb_build_object('id','n-trg-18en','kind','review','label','Verify IPS effectiveness','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',1160,'y',760)),
          jsonb_build_object('id','n-trg-19en','kind','end','label','Close trigger event','roleId',r_site,'forumId',f_pdca,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',1160,'y',840)),
          jsonb_build_object('id','n-trg-20','kind','review','label','Review trigger completion and response compliance','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_triggers),'position',jsonb_build_object('x',40,'y',400)),
          jsonb_build_object('id','n-trg-21','kind','review','label','Review repeated triggers and threshold effectiveness','roleId',r_site,'forumId',f_pdca,'systemIds',jsonb_build_array(s_triggers,s_ips),'position',jsonb_build_object('x',40,'y',500))
        ), 'edges', jsonb_build_array(
          jsonb_build_object('id','e-trg-1','source','n-trg-1','target','n-trg-2'),
          jsonb_build_object('id','e-trg-2','source','n-trg-2','target','n-trg-3'),
          jsonb_build_object('id','e-trg-3','source','n-trg-3','target','n-trg-4'),
          jsonb_build_object('id','e-trg-3b','source','n-trg-4','target','n-trg-5'),
          jsonb_build_object('id','e-trg-4','source','n-trg-5','target','n-trg-6'),
          jsonb_build_object('id','e-trg-5','source','n-trg-6','target','n-trg-7'),
          jsonb_build_object('id','e-trg-6','source','n-trg-7','target','n-trg-8'),
          jsonb_build_object('id','e-trg-7','source','n-trg-8','target','n-trg-9n','label','No'),
          jsonb_build_object('id','e-trg-8','source','n-trg-8','target','n-trg-9y','label','Yes'),
          jsonb_build_object('id','e-trg-9','source','n-trg-9y','target','n-trg-10'),
          jsonb_build_object('id','e-trg-10','source','n-trg-10','target','n-trg-11'),
          jsonb_build_object('id','e-trg-11','source','n-trg-11','target','n-trg-12y','label','Yes'),
          jsonb_build_object('id','e-trg-12','source','n-trg-11','target','n-trg-13','label','No'),
          jsonb_build_object('id','e-trg-13','source','n-trg-12y','target','n-trg-13'),
          jsonb_build_object('id','e-trg-14','source','n-trg-13','target','n-trg-14n','label','No'),
          jsonb_build_object('id','e-trg-15','source','n-trg-14n','target','n-trg-15n'),
          jsonb_build_object('id','e-trg-16','source','n-trg-15n','target','n-trg-16n'),
          jsonb_build_object('id','e-trg-17','source','n-trg-16n','target','n-trg-17n'),
          jsonb_build_object('id','e-trg-18','source','n-trg-17n','target','n-trg-18n','label','Yes'),
          jsonb_build_object('id','e-trg-18b','source','n-trg-17n','target','n-trg-14y','label','No'),
          jsonb_build_object('id','e-trg-18c','source','n-trg-14y','target','n-trg-15y'),
          jsonb_build_object('id','e-trg-20','source','n-trg-13','target','n-trg-14y','label','Yes'),
          jsonb_build_object('id','e-trg-21','source','n-trg-15y','target','n-trg-16y'),
          jsonb_build_object('id','e-trg-23','source','n-trg-16y','target','n-trg-17y'),
          jsonb_build_object('id','e-trg-24','source','n-trg-17y','target','n-trg-18ey','label','Yes'),
          jsonb_build_object('id','e-trg-25','source','n-trg-18ey','target','n-trg-19ey'),
          jsonb_build_object('id','e-trg-26','source','n-trg-17y','target','n-trg-18en','label','No'),
          jsonb_build_object('id','e-trg-27','source','n-trg-18en','target','n-trg-19en'),
          jsonb_build_object('id','e-trg-28','source','n-trg-20','target','n-trg-21')
        ));

  update bms_brain_processes
  set
    name = 'Triggers — Threshold and event management',
    description = 'Trigger configuration, assessment, containment, corrective action and IPS linkage.',
    status = 'published',
    flow = flow_triggers,
    owner_role_id = r_support,
    catalog_system_id = s_triggers,
    updated_at = now()
  where id = 'a1000003-0001-4000-8000-000000000003';

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      'a1000003-0001-4000-8000-000000000003',
      'Triggers — Threshold and event management',
      'Trigger configuration, assessment, containment, corrective action and IPS linkage.',
      'published',
      flow_triggers,
      r_support,
      s_triggers
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver from bms_brain_process_versions where process_id = 'a1000003-0001-4000-8000-000000000003';
  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select 'a1000003-0001-4000-8000-000000000003', next_ver, to_jsonb(p.*), 'Triggers — Threshold and event management standard'
  from bms_brain_processes p where p.id = 'a1000003-0001-4000-8000-000000000003';
end;
$$;

select public.bms_brain_update_system_standards();

revoke all on function public.bms_brain_update_system_standards() from public;

notify pgrst, 'reload schema';
