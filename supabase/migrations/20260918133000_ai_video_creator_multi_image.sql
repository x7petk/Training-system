-- AI Video Creator: several stills become several Sora scenes, then one joined clip.

alter table public.ai_video_jobs
  add column if not exists image_paths jsonb not null default '[]'::jsonb,
  add column if not exists openai_video_ids jsonb not null default '[]'::jsonb,
  add column if not exists segment_paths jsonb not null default '[]'::jsonb;

update public.ai_video_jobs
set image_paths = jsonb_build_array(image_path)
where image_path is not null
  and image_path <> ''
  and image_paths = '[]'::jsonb;

update public.ai_video_jobs
set openai_video_ids = jsonb_build_array(openai_video_id)
where openai_video_id is not null
  and openai_video_id <> ''
  and openai_video_ids = '[]'::jsonb;

notify pgrst, 'reload schema';
