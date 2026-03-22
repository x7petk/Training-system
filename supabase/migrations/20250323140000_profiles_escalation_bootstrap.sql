-- Allow role changes when there is no JWT (SQL Editor, CLI `db query`, migrations).
-- Otherwise `auth.uid()` is null, the escalation check fails, and every role update is reverted.

create or replace function public.profiles_prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;
