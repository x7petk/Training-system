-- Production by-line KPI values for Powder & Cheese cells (all active lines, today NZ, day_night).
-- Run: npx supabase db query --linked --yes -f scripts/seed-production-byline-powder.sql

begin;

create or replace function pg_temp.demo_roll(p_key text)
returns integer language sql immutable as $$
  select (abs(hashtextextended(p_key, 0)) % 100)::integer;
$$;

create or replace function pg_temp.demo_kpi_value(p_scoring jsonb, p_in_target boolean, p_key text)
returns numeric language plpgsql immutable as $$
declare
  k text := coalesce(p_scoring->>'kind', 'no_target');
  t numeric; tmin numeric; tmax numeric; tol numeric;
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
    when 'symmetric_pct' then
      t := (p_scoring->>'target')::numeric;
      tol := (abs(t) * (p_scoring->>'tolerancePct')::numeric) / 100.0;
      if p_in_target then return t + (j - 0.2) * tol; end if;
      return t + tol * (1.5 + j);
    else return j;
  end case;
end;
$$;

do $$
declare
  v_today date := (now() at time zone 'Pacific/Auckland')::date;
  v_shift text := 'day_night';
  cell_rec record;
  ln record;
  prod_kpi record;
  v_key text;
  v_val numeric;
begin
  for cell_rec in
    select c.id, c.name
    from public.master_cells c
    where lower(c.name) like '%powder%'
       or lower(c.name) like '%cheese%'
       or lower(c.name) like '%cream%'
    order by c.sort_order, c.name
  loop
    for ln in
      select id
      from public.dds_cell_lines
      where master_cell_id = cell_rec.id
        and active
      order by sort_order, name
    loop
      for prod_kpi in
        select k.id, k.label, k.scoring
        from public.dds_kpis k
        join public.dds_kpi_groups g on g.id = k.kpi_group_id
        where lower(g.name) = 'production'
          and k.site_dds_presentation = 'by_line'
        order by k.sort_order
      loop
        v_key := cell_rec.id::text || ':' || ln.id::text || ':' || prod_kpi.id::text || ':' || v_today::text;
        v_val := pg_temp.demo_kpi_value(prod_kpi.scoring, true, v_key);

        insert into public.dds_kpi_line_entries (
          master_cell_id, line_id, kpi_id, plan_date, shift_kind, value_numeric
        )
        values (
          cell_rec.id, ln.id, prod_kpi.id, v_today, v_shift, round(v_val::numeric, 2)
        )
        on conflict (line_id, kpi_id, plan_date, shift_kind) do update set
          value_numeric = excluded.value_numeric,
          updated_at = now();
      end loop;
    end loop;

    raise notice 'Production by-line KPIs seeded for % (%)', cell_rec.name, cell_rec.id;
  end loop;
end;
$$;

drop function if exists pg_temp.demo_kpi_value(jsonb, boolean, text);
drop function if exists pg_temp.demo_roll(text);

commit;
