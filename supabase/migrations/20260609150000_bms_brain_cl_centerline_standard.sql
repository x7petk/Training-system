-- CL — Centerline management standard (Systems & Tools flow)

insert into public.bms_brain_forums (slug, name, description, color, icon, sort_order)
values (
  'ips-review',
  'IPS Review',
  'Integrated production system review and structured problem-solving checkpoint.',
  '#7c3aed',
  'shield-check',
  8
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

update public.bms_brain_systems
set
  name = 'CL',
  description = 'Centerline management — scheduled checks, deviation handling, escalation, and governance.',
  integrations = 'Plan 24, Shift DDS, Line DDS, WDS, IPS, PDCA'
where slug = 'cl';

create or replace function public.bms_brain_update_cl_centerline_standard()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p_cl uuid := 'a1000002-0001-4000-8000-000000000001';
  p_ips uuid := 'a1000002-0001-4000-8000-000000000002';
  r_operator uuid;
  r_cell uuid;
  r_plant uuid;
  r_site uuid;
  r_support uuid;
  f_swp uuid;
  f_shift uuid;
  f_line uuid;
  f_wds uuid;
  f_pdca uuid;
  f_ips_review uuid;
  s_cl uuid;
  s_ips uuid;
  flow_cl jsonb;
  next_ver int;
begin
  select id into r_operator from bms_brain_roles where slug = 'operator';
  select id into r_cell from bms_brain_roles where slug = 'cell';
  select id into r_plant from bms_brain_roles where slug = 'plant';
  select id into r_site from bms_brain_roles where slug = 'site';
  select id into r_support from bms_brain_roles where slug = 'support';

  select id into f_swp from bms_brain_forums where slug = 'swp';
  select id into f_shift from bms_brain_forums where slug = 'shift-dds';
  select id into f_line from bms_brain_forums where slug = 'line-dds';
  select id into f_wds from bms_brain_forums where slug = 'wds';
  select id into f_pdca from bms_brain_forums where slug = 'pdca';
  select id into f_ips_review from bms_brain_forums where slug = 'ips-review';

  select id into s_cl from bms_brain_systems where slug = 'cl';
  select id into s_ips from bms_brain_systems where slug = 'ips';

  flow_cl := jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object('id','n-cl-1','kind','start','label','Centerline check becomes due','description','Trigger: scheduled check, PftD task or manual request.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','inputs','Plan 24 schedule, PftD task or manual request','outputs','Check ready to perform','position',jsonb_build_object('x',40,'y',40)),
      jsonb_build_object('id','n-cl-2','kind','process','label','Perform centerline check','description','Record actual value, target value, comments and evidence.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','inputs','Centerline standard, check window','outputs','Actual vs target recorded with evidence','position',jsonb_build_object('x',40,'y',140)),
      jsonb_build_object('id','n-cl-3','kind','decision','label','Is the value within the approved centerline?','description','Compare recorded value against approved centerline limits.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','position',jsonb_build_object('x',40,'y',240)),
      jsonb_build_object('id','n-cl-4y','kind','process','label','Record compliant result','description','Confirm the check is within approved limits.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','outputs','Compliant result logged','position',jsonb_build_object('x',40,'y',360)),
      jsonb_build_object('id','n-cl-5y','kind','end','label','Complete centerline check','description','Compliant centerline check closed.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','position',jsonb_build_object('x',40,'y',480)),
      jsonb_build_object('id','n-cl-4n','kind','process','label','Record centerline deviation','description','Record deviation value, impact, evidence and comments.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','outputs','Deviation logged with evidence','position',jsonb_build_object('x',240,'y',240)),
      jsonb_build_object('id','n-cl-5n','kind','decision','label','Can the condition be safely restored immediately?','description','Operator assesses whether the approved setting can be restored now.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','position',jsonb_build_object('x',240,'y',360)),
      jsonb_build_object('id','n-cl-6ry','kind','process','label','Restore the approved setting','description','Return equipment or process to the approved centerline setting.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','outputs','Setting restored','position',jsonb_build_object('x',240,'y',480)),
      jsonb_build_object('id','n-cl-7ry','kind','process','label','Repeat centerline check','description','Re-check after restoration before closing the loop.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','outputs','Updated check result','position',jsonb_build_object('x',240,'y',600)),
      jsonb_build_object('id','n-cl-6rn','kind','process','label','Assign deviation owner','description','Nominate owner for deviation follow-up in Shift DDS.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cl),'owner','Cell team leader','outputs','Deviation owner assigned','position',jsonb_build_object('x',440,'y',360)),
      jsonb_build_object('id','n-cl-7rn','kind','review','label','Review deviation and agree immediate containment','description','Cell reviews deviation, impact and immediate containment actions.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cl),'owner','Cell team leader','outputs','Containment agreed','position',jsonb_build_object('x',440,'y',480)),
      jsonb_build_object('id','n-cl-8','kind','decision','label','Is the deviation critical, recurring or overdue?','description','Plant decides whether deviation requires escalation.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','position',jsonb_build_object('x',640,'y',480)),
      jsonb_build_object('id','n-cl-9n','kind','process','label','Assign corrective action and due date','description','Define corrective action, owner and due date at line level.','roleId',r_cell,'forumId',f_line,'systemIds',jsonb_build_array(s_cl),'owner','Cell team leader','outputs','Corrective action assigned','position',jsonb_build_object('x',640,'y',620)),
      jsonb_build_object('id','n-cl-10n','kind','process','label','Complete corrective action','description','Execute agreed corrective action during operational execution.','roleId',r_cell,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Cell team leader','outputs','Corrective action completed','position',jsonb_build_object('x',640,'y',740)),
      jsonb_build_object('id','n-cl-11n','kind','review','label','Verify that the centerline has been restored','description','Operator verifies restoration against the approved centerline.','roleId',r_operator,'forumId',f_swp,'systemIds',jsonb_build_array(s_cl),'owner','Operator','outputs','Restoration verified','position',jsonb_build_object('x',640,'y',860)),
      jsonb_build_object('id','n-cl-12n','kind','decision','label','Is the centerline restored and stable?','description','Cell confirms deviation can be closed or needs further review.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cl),'owner','Cell team leader','position',jsonb_build_object('x',640,'y',980)),
      jsonb_build_object('id','n-cl-13n','kind','end','label','Close centerline deviation','description','Non-critical deviation closed after corrective action.','roleId',r_cell,'forumId',f_shift,'systemIds',jsonb_build_array(s_cl),'owner','Cell team leader','position',jsonb_build_object('x',640,'y',1100)),
      jsonb_build_object('id','n-cl-9c','kind','process','label','Escalate deviation','description','Escalate critical, recurring or overdue deviation to plant leadership.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','outputs','Deviation escalated','position',jsonb_build_object('x',860,'y',360)),
      jsonb_build_object('id','n-cl-10c','kind','decision','label','Is structured problem solving required?','description','Determine whether linked IPS problem solving is required.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_cl,s_ips),'owner','Plant manager','position',jsonb_build_object('x',860,'y',480)),
      jsonb_build_object('id','n-cl-11cy','kind','subprocess','label','Create linked IPS','description','Open structured IPS case linked to the centerline deviation.','roleId',r_plant,'forumId',f_ips_review,'systemIds',jsonb_build_array(s_cl,s_ips),'owner','Plant manager','outputs','Linked IPS created','subprocessProcessId',p_ips,'position',jsonb_build_object('x',1060,'y',360)),
      jsonb_build_object('id','n-cl-12cy','kind','review','label','Monitor corrective actions','description','Track IPS and CL corrective actions on the weekly board.','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_cl,s_ips),'owner','Plant manager','position',jsonb_build_object('x',1060,'y',480)),
      jsonb_build_object('id','n-cl-13cy','kind','review','label','Verify centerline stability','description','Confirm centerline is restored and stable after IPS actions.','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','position',jsonb_build_object('x',1060,'y',600)),
      jsonb_build_object('id','n-cl-14cy','kind','end','label','Close centerline deviation','description','Escalated deviation closed after IPS-led recovery.','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','position',jsonb_build_object('x',1060,'y',720)),
      jsonb_build_object('id','n-cl-11cn','kind','process','label','Assign corrective action and due date','description','Plant assigns corrective action and due date without IPS.','roleId',r_plant,'forumId',f_line,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','outputs','Corrective action assigned','position',jsonb_build_object('x',860,'y',620)),
      jsonb_build_object('id','n-cl-12cn','kind','review','label','Monitor action completion','description','Monitor corrective action completion on WDS.','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','position',jsonb_build_object('x',860,'y',740)),
      jsonb_build_object('id','n-cl-13cn','kind','review','label','Verify centerline stability','description','Confirm centerline stability after plant-led corrective action.','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','position',jsonb_build_object('x',860,'y',860)),
      jsonb_build_object('id','n-cl-14cn','kind','end','label','Close centerline deviation','description','Escalated deviation closed after plant-led corrective action.','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','position',jsonb_build_object('x',860,'y',980)),
      jsonb_build_object('id','n-cl-15','kind','review','label','Review centerline completion and compliance','description','Periodic review of centerline completion and compliance rates.','roleId',r_plant,'forumId',f_wds,'systemIds',jsonb_build_array(s_cl),'owner','Plant manager','position',jsonb_build_object('x',40,'y',760)),
      jsonb_build_object('id','n-cl-16','kind','review','label','Review recurring deviations and systemic losses','description','Site reviews repeat deviations and systemic losses in PDCA.','roleId',r_site,'forumId',f_pdca,'systemIds',jsonb_build_array(s_cl,s_ips),'owner','Site DDS owner','position',jsonb_build_object('x',40,'y',880)),
      jsonb_build_object('id','n-cl-17','kind','process','label','Update centerline standards where required','description','Support updates centerline standards based on review outcomes.','roleId',r_support,'forumId',f_pdca,'systemIds',jsonb_build_array(s_cl,s_ips),'owner','Support function','outputs','Updated centerline standards','position',jsonb_build_object('x',40,'y',1000))
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id','e-cl-1','source','n-cl-1','target','n-cl-2'),
      jsonb_build_object('id','e-cl-2','source','n-cl-2','target','n-cl-3'),
      jsonb_build_object('id','e-cl-3','source','n-cl-3','target','n-cl-4y','label','Yes'),
      jsonb_build_object('id','e-cl-4','source','n-cl-4y','target','n-cl-5y'),
      jsonb_build_object('id','e-cl-5','source','n-cl-3','target','n-cl-4n','label','No'),
      jsonb_build_object('id','e-cl-6','source','n-cl-4n','target','n-cl-5n'),
      jsonb_build_object('id','e-cl-7','source','n-cl-5n','target','n-cl-6ry','label','Yes'),
      jsonb_build_object('id','e-cl-8','source','n-cl-6ry','target','n-cl-7ry'),
      jsonb_build_object('id','e-cl-9','source','n-cl-7ry','target','n-cl-3'),
      jsonb_build_object('id','e-cl-10','source','n-cl-5n','target','n-cl-6rn','label','No'),
      jsonb_build_object('id','e-cl-11','source','n-cl-6rn','target','n-cl-7rn'),
      jsonb_build_object('id','e-cl-12','source','n-cl-7rn','target','n-cl-8'),
      jsonb_build_object('id','e-cl-13','source','n-cl-8','target','n-cl-9n','label','No'),
      jsonb_build_object('id','e-cl-14','source','n-cl-9n','target','n-cl-10n'),
      jsonb_build_object('id','e-cl-15','source','n-cl-10n','target','n-cl-11n'),
      jsonb_build_object('id','e-cl-16','source','n-cl-11n','target','n-cl-12n'),
      jsonb_build_object('id','e-cl-17','source','n-cl-12n','target','n-cl-13n','label','Yes'),
      jsonb_build_object('id','e-cl-18','source','n-cl-12n','target','n-cl-7rn','label','No'),
      jsonb_build_object('id','e-cl-19','source','n-cl-8','target','n-cl-9c','label','Critical / recurring / overdue'),
      jsonb_build_object('id','e-cl-20','source','n-cl-9c','target','n-cl-10c'),
      jsonb_build_object('id','e-cl-21','source','n-cl-10c','target','n-cl-11cy','label','Yes'),
      jsonb_build_object('id','e-cl-22','source','n-cl-11cy','target','n-cl-12cy'),
      jsonb_build_object('id','e-cl-23','source','n-cl-12cy','target','n-cl-13cy'),
      jsonb_build_object('id','e-cl-24','source','n-cl-13cy','target','n-cl-14cy'),
      jsonb_build_object('id','e-cl-25','source','n-cl-10c','target','n-cl-11cn','label','No'),
      jsonb_build_object('id','e-cl-26','source','n-cl-11cn','target','n-cl-12cn'),
      jsonb_build_object('id','e-cl-27','source','n-cl-12cn','target','n-cl-13cn'),
      jsonb_build_object('id','e-cl-28','source','n-cl-13cn','target','n-cl-14cn'),
      jsonb_build_object('id','e-cl-29','source','n-cl-15','target','n-cl-16'),
      jsonb_build_object('id','e-cl-30','source','n-cl-16','target','n-cl-17')
    )
  );

  update bms_brain_processes
  set
    name = 'CL — Centerline management',
    description = 'Centerline checks, deviation handling, escalation, IPS linkage, and periodic governance.',
    status = 'published',
    flow = flow_cl,
    owner_role_id = r_cell,
    catalog_system_id = s_cl,
    updated_at = now()
  where id = p_cl;

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      p_cl,
      'CL — Centerline management',
      'Centerline checks, deviation handling, escalation, IPS linkage, and periodic governance.',
      'published',
      flow_cl,
      r_cell,
      s_cl
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver
  from bms_brain_process_versions
  where process_id = p_cl;

  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select p_cl, next_ver, to_jsonb(p.*), 'CL centerline management standard'
  from bms_brain_processes p
  where p.id = p_cl;
end;
$$;

select public.bms_brain_update_cl_centerline_standard();

revoke all on function public.bms_brain_update_cl_centerline_standard() from public;

notify pgrst, 'reload schema';
