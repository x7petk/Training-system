-- Skill self-training packs for operator 1 -> 2 progression.

create table if not exists public.skill_training_packs (
  skill_id uuid primary key references public.skills on delete cascade,
  document_path text not null unique,
  document_name text not null,
  document_mime text not null,
  document_size_bytes int not null check (document_size_bytes > 0 and document_size_bytes <= 10485760),
  pass_score_percent int not null check (pass_score_percent >= 1 and pass_score_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.skill_training_questions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skill_training_packs (skill_id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  sort_order smallint not null check (sort_order >= 1 and sort_order <= 10),
  created_at timestamptz not null default now(),
  unique (skill_id, sort_order)
);

create table if not exists public.skill_training_attempts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  score_percent int not null check (score_percent >= 0 and score_percent <= 100),
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists skill_training_attempts_person_id_idx on public.skill_training_attempts (person_id, created_at desc);
create index if not exists skill_training_attempts_skill_id_idx on public.skill_training_attempts (skill_id, created_at desc);

create or replace function public.training_pack_numeric_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.skill_kind;
begin
  select s.kind into k from public.skills s where s.id = new.skill_id;
  if k is null then
    raise exception 'Skill not found for training pack';
  end if;
  if k <> 'numeric' then
    raise exception 'Training pack is allowed only for numeric skills';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists skill_training_packs_numeric_only_trg on public.skill_training_packs;
create trigger skill_training_packs_numeric_only_trg
  before insert or update on public.skill_training_packs
  for each row
  execute function public.training_pack_numeric_only();

grant select, insert, update, delete on public.skill_training_packs to authenticated;
grant select, insert, update, delete on public.skill_training_questions to authenticated;
grant select, insert on public.skill_training_attempts to authenticated;

alter table public.skill_training_packs enable row level security;
alter table public.skill_training_questions enable row level security;
alter table public.skill_training_attempts enable row level security;

create policy "training_packs_select_auth"
  on public.skill_training_packs for select to authenticated using (true);

create policy "training_packs_write_admin"
  on public.skill_training_packs for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "training_questions_select_auth"
  on public.skill_training_questions for select to authenticated using (true);

create policy "training_questions_write_admin"
  on public.skill_training_questions for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "training_attempts_select_own_or_admin"
  on public.skill_training_attempts
  for select
  to authenticated
  using (
    public.is_app_admin()
    or public.is_app_assessor()
    or exists (
      select 1
      from public.people p
      where p.id = person_id and p.user_id = auth.uid()
    )
  );

create policy "training_attempts_insert_own_or_staff"
  on public.skill_training_attempts
  for insert
  to authenticated
  with check (
    public.is_app_admin()
    or public.is_app_assessor()
    or exists (
      select 1
      from public.people p
      where p.id = person_id and p.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('skill-training-docs', 'skill-training-docs', false)
on conflict (id) do nothing;

create policy "training_docs_read_auth"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'skill-training-docs');

create policy "training_docs_write_admin"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'skill-training-docs' and public.is_app_admin())
  with check (bucket_id = 'skill-training-docs' and public.is_app_admin());
