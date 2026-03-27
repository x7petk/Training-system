-- One standards document per skill, with up to 5 custom pages of blocks.
-- Also remove previously attached training documents and storage objects.

create table if not exists public.skill_training_standards (
  skill_id uuid primary key references public.skill_training_packs (skill_id) on delete cascade,
  title text not null default '',
  pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint training_standards_pages_is_array check (jsonb_typeof(pages) = 'array'),
  constraint training_standards_pages_max_five check (jsonb_array_length(pages) <= 5)
);

grant select, insert, update, delete on public.skill_training_standards to authenticated;
alter table public.skill_training_standards enable row level security;

create policy "training_standards_select_auth"
  on public.skill_training_standards for select to authenticated using (true);

create policy "training_standards_write_admin"
  on public.skill_training_standards for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create or replace function public.training_standards_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists skill_training_standards_touch_updated_at_trg on public.skill_training_standards;
create trigger skill_training_standards_touch_updated_at_trg
  before update on public.skill_training_standards
  for each row
  execute function public.training_standards_touch_updated_at();

insert into storage.buckets (id, name, public)
values ('skill-training-standard-images', 'skill-training-standard-images', false)
on conflict (id) do nothing;

create policy "training_standard_images_read_auth"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'skill-training-standard-images');

create policy "training_standard_images_write_admin"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'skill-training-standard-images' and public.is_app_admin())
  with check (bucket_id = 'skill-training-standard-images' and public.is_app_admin());

-- Cleanup old document attachments per request.
update public.skill_training_packs
set
  document_path = null,
  document_name = null,
  document_mime = null,
  document_size_bytes = 0;
