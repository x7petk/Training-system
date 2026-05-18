-- Which DDS process pages list a given dds_action (Line / Plant / Site).
-- Null or empty array = legacy: visible on all DDS action lists.

alter table public.plan24_events
  add column if not exists dds_display_surfaces text[] null;

comment on column public.plan24_events.dds_display_surfaces is
  'For event_type dds_action: DDS process surfaces that list this row (line-dds, plant-dds, site-dds). Null or empty = all surfaces (legacy).';

alter table public.plan24_events
  drop constraint if exists plan24_events_dds_display_surfaces_allowed;

alter table public.plan24_events
  add constraint plan24_events_dds_display_surfaces_allowed
  check (
    dds_display_surfaces is null
    or cardinality(dds_display_surfaces) = 0
    or (
      dds_display_surfaces <@ array['line-dds', 'plant-dds', 'site-dds']::text[]
      and cardinality(dds_display_surfaces) > 0
    )
  );
