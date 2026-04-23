-- Quality checks: Pass/Fail only (no numeric limits on template).
-- CL checks: data entry (number/range/text); remove legacy pass_fail rows.

update public.plan24_quality_check_template_tasks
set
  input_kind = 'pass_fail',
  min_value = null,
  max_value = null,
  target_value = null
where
  lower(coalesce(input_kind, '')) <> 'pass_fail'
  or min_value is not null
  or max_value is not null
  or target_value is not null;

update public.plan24_cl_check_template_tasks
set input_kind = 'number'
where lower(coalesce(input_kind, '')) = 'pass_fail';

update public.plan24_cl_check_template_tasks
set input_kind = 'number'
where input_kind is null;
