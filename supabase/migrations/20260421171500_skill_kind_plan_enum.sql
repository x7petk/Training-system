do $$
begin
  alter type public.skill_kind add value if not exists 'plan';
exception
  when duplicate_object then null;
end
$$;
