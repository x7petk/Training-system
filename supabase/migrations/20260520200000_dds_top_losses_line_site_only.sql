-- Top Losses starts at Line DDS (not Shift).

alter table public.dds_tl_entries drop constraint if exists dds_tl_entries_visible_surface_check;
alter table public.dds_tl_entries drop constraint if exists dds_tl_entries_created_on_surface_check;
alter table public.dds_tl_entries drop constraint if exists dds_tl_entries_promoted_from_surface_check;

alter table public.dds_tl_entries
  add constraint dds_tl_entries_visible_surface_check
  check (visible_surface in ('line-dds', 'site-dds'));

alter table public.dds_tl_entries
  add constraint dds_tl_entries_created_on_surface_check
  check (created_on_surface in ('line-dds', 'site-dds'));

alter table public.dds_tl_entries
  add constraint dds_tl_entries_promoted_from_surface_check
  check (promoted_from_surface is null or promoted_from_surface in ('line-dds', 'site-dds'));

alter table public.dds_tl_promotions drop constraint if exists dds_tl_promotions_from_surface_check;
alter table public.dds_tl_promotions drop constraint if exists dds_tl_promotions_to_surface_check;

alter table public.dds_tl_promotions
  add constraint dds_tl_promotions_from_surface_check
  check (from_surface in ('line-dds', 'site-dds'));

alter table public.dds_tl_promotions
  add constraint dds_tl_promotions_to_surface_check
  check (to_surface in ('line-dds', 'site-dds'));

delete from public.dds_tl_entries where visible_surface = 'shift-dds' or created_on_surface = 'shift-dds';

notify pgrst, 'reload schema';
