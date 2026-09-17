-- Inbox so a signed-in phone can send stills to the same user's AI Video Creator session.

create table if not exists public.ai_video_phone_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  file_name text not null default 'phone.jpg',
  created_at timestamptz not null default now()
);

create index if not exists ai_video_phone_inbox_user_id_idx
  on public.ai_video_phone_inbox (user_id, created_at desc);

alter table public.ai_video_phone_inbox enable row level security;

drop policy if exists "ai_video_phone_inbox_select_own" on public.ai_video_phone_inbox;
create policy "ai_video_phone_inbox_select_own"
  on public.ai_video_phone_inbox for select to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "ai_video_phone_inbox_insert_own" on public.ai_video_phone_inbox;
create policy "ai_video_phone_inbox_insert_own"
  on public.ai_video_phone_inbox for insert to authenticated
  with check (public.app_user_can_access_agents() and user_id = auth.uid());

drop policy if exists "ai_video_phone_inbox_delete_own" on public.ai_video_phone_inbox;
create policy "ai_video_phone_inbox_delete_own"
  on public.ai_video_phone_inbox for delete to authenticated
  using (public.app_user_can_access_agents() and user_id = auth.uid());

grant select, insert, delete on public.ai_video_phone_inbox to authenticated;

notify pgrst, 'reload schema';
