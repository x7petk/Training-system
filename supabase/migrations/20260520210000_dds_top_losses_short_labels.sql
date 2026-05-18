-- Short labels for root cause and problem solve dropdowns (editable in Admin → Top losses).

update public.dds_tl_problem_solve_options set label = 'IPS' where sort_order = 0;
update public.dds_tl_problem_solve_options set label = 'BDE' where sort_order = 1;
update public.dds_tl_problem_solve_options set label = 'W-W' where sort_order = 2;

update public.dds_tl_root_cause_options set label = 'Man' where sort_order = 0;
update public.dds_tl_root_cause_options set label = 'Mach' where sort_order = 1;
update public.dds_tl_root_cause_options set label = 'Meth' where sort_order = 2;

notify pgrst, 'reload schema';
