-- Turn off "critical" flag for all template questions (HC + observations).
update public.hc_template_questions set is_critical = false;
update public.sos_template_questions set is_critical = false;
update public.qos_template_questions set is_critical = false;
update public.ppo_template_questions set is_critical = false;
