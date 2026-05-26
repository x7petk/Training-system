-- Remove Golden Triangle Builder storage (feature removed from Agents).

drop table if exists public.golden_triangle_workspaces cascade;

drop function if exists public.golden_triangle_workspaces_touch_updated_at();

notify pgrst, 'reload schema';
