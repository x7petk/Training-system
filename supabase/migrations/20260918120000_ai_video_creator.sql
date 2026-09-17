-- AI Video Creator: per-user image-to-video jobs (Sora) plus private media storage.

create or replace function public.app_user_can_access_agents()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_access_agents from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.app_user_can_access_agents() to authenticated;

create table if not exists public.ai_video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  prompt text not null,
  seconds text not null default '8' check (seconds in ('4', '8', '12')),
  size text not null default '1280x720'
    check (size in ('1280x720', '720x1280', '1792x1024', '1024x1792')),
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'completed', 'failed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  openai_video_id text,
  image_path text,
  video_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_video_jobs_user_id_idx
  on public.ai_video_jobs (user_id, created_at desc);

create or replace function public.ai_video_jobs_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ai_video_jobs_touch_updated_at on public.ai_video_jobs;
create trigger ai_video_jobs_touch_updated_at
  before update on public.ai_video_jobs
  for each row execute function public.ai_video_jobs_touch_updated_at();

alter table public.ai_video_jobs enable row level security;

drop policy if exists "ai_video_jobs_select_own" on public.ai_video_jobs;
create policy "ai_video_jobs_select_own"
  on public.ai_video_jobs for select to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "ai_video_jobs_insert_own" on public.ai_video_jobs;
create policy "ai_video_jobs_insert_own"
  on public.ai_video_jobs for insert to authenticated
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "ai_video_jobs_update_own" on public.ai_video_jobs;
create policy "ai_video_jobs_update_own"
  on public.ai_video_jobs for update to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  )
  with check (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

drop policy if exists "ai_video_jobs_delete_own" on public.ai_video_jobs;
create policy "ai_video_jobs_delete_own"
  on public.ai_video_jobs for delete to authenticated
  using (
    public.app_user_can_access_agents()
    and user_id = auth.uid()
  );

grant select, insert, update, delete on public.ai_video_jobs to authenticated;

insert into storage.buckets (id, name, public)
values ('ai-video-creator', 'ai-video-creator', false)
on conflict (id) do nothing;

drop policy if exists "ai_video_creator_storage_select" on storage.objects;
create policy "ai_video_creator_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ai-video-creator'
    and public.app_user_can_access_agents()
    and name like auth.uid()::text || '/%'
  );

drop policy if exists "ai_video_creator_storage_insert" on storage.objects;
create policy "ai_video_creator_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ai-video-creator'
    and public.app_user_can_access_agents()
    and name like auth.uid()::text || '/%'
  );

drop policy if exists "ai_video_creator_storage_update" on storage.objects;
create policy "ai_video_creator_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'ai-video-creator'
    and public.app_user_can_access_agents()
    and name like auth.uid()::text || '/%'
  )
  with check (
    bucket_id = 'ai-video-creator'
    and public.app_user_can_access_agents()
    and name like auth.uid()::text || '/%'
  );

drop policy if exists "ai_video_creator_storage_delete" on storage.objects;
create policy "ai_video_creator_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ai-video-creator'
    and public.app_user_can_access_agents()
    and name like auth.uid()::text || '/%'
  );

notify pgrst, 'reload schema';
