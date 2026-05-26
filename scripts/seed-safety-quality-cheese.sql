-- Safety & Quality KPI tile values for Cheese cell (Line DDS, day_night, today NZ).
-- Run: npx supabase db query --linked --yes -f scripts/seed-safety-quality-cheese.sql

begin;

create or replace function pg_temp.demo_roll(p_key text)
returns integer language sql immutable as $$
  select (abs(hashtextextended(p_key, 0)) % 100)::integer;
$$;

create or replace function pg_temp.demo_kpi_value(p_scoring jsonb, p_in_target boolean, p_key text)
returns numeric language plpgsql immutable as $$
declare
  k text := coalesce(p_scoring->>'kind', 'no_target');
  t numeric;
  j numeric := (pg_temp.demo_roll(p_key || ':j') % 400)::numeric / 100.0;
begin
  case k
    when 'min_red' then
      t := (p_scoring->>'target')::numeric;
      if p_in_target then return t + j; end if;
      return greatest(t - 2 - j, 0);
    when 'max_red' then
      t := (p_scoring->>'target')::numeric;
      if p_in_target then return greatest(t - j, 0); end if;
      return t + 1 + j;
    when 'range_green' then
      if p_in_target then
        return (p_scoring->>'min')::numeric + j;
      end if;
      return (p_scoring->>'max')::numeric + 1 + j;
    when 'symmetric_pct' then
      t := (p_scoring->>'target')::numeric;
      if p_in_target then
        return t + (j - 0.2) * (abs(t) * (p_scoring->>'tolerancePct')::numeric) / 100.0;
      end if;
      return t + 5;
    else
      return j;
  end case;
end;
$$;

do $$
declare
  v_cell_id uuid := 'b3000001-0000-4000-8000-000000000002';
  v_today date := (now() at time zone 'Pacific/Auckland')::date;
  v_shift text := 'day_night';
  kpi_row record;
  v_key text;
  v_val numeric;
begin
  for kpi_row in
    select k.id, k.label, k.scoring
    from public.dds_kpis k
    join public.dds_kpi_groups g on g.id = k.kpi_group_id
    where lower(g.name) in ('safety', 'quality')
      and 'line-dds' = any(k.display_sections)
      and coalesce(k.site_dds_presentation, '') <> 'by_line'
    order by g.sort_order, k.sort_order
  loop
    v_key := v_cell_id::text || ':' || kpi_row.id::text || ':' || v_today::text;
    v_val := pg_temp.demo_kpi_value(kpi_row.scoring, true, v_key);

    insert into public.dds_kpi_cell_entries (
      master_cell_id, kpi_id, plan_date, shift_kind,
      value_numeric, plan24_manual_override
    )
    values (
      v_cell_id, kpi_row.id, v_today, v_shift,
      round(v_val::numeric, 2), true
    )
    on conflict (master_cell_id, kpi_id, plan_date, shift_kind) do update set
      value_numeric = excluded.value_numeric,
      plan24_manual_override = true,
      updated_at = now();
  end loop;

  raise notice 'Safety/Quality KPIs seeded for Cheese cell on %.', v_today;
end;
$$;

drop function if exists pg_temp.demo_kpi_value(jsonb, boolean, text);
drop function if exists pg_temp.demo_roll(text);

commit;
