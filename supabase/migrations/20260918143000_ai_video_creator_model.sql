-- Store which Sora model generated each clip.

alter table public.ai_video_jobs
  add column if not exists model text not null default 'sora-2';

alter table public.ai_video_jobs drop constraint if exists ai_video_jobs_model_check;
alter table public.ai_video_jobs
  add constraint ai_video_jobs_model_check check (model in ('sora-2', 'sora-2-pro'));

notify pgrst, 'reload schema';
