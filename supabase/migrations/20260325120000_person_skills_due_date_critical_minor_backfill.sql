-- Backfill due_date for required (non-extra) person_skills where gap is critical or minor
-- and due_date is null. Matches web gapLogic (numeric + certification critical).
-- Each row gets a deterministic date between 2026-05-01 and 2026-09-30 (inclusive).

with role_req as (
  select
    pr.person_id,
    rsr.skill_id,
    max(rsr.required_level)::smallint as required_level
  from public.person_roles pr
  join public.role_skill_requirements rsr on rsr.role_id = pr.role_id
  group by pr.person_id, rsr.skill_id
),
targets as (
  select
    ps.person_id,
    ps.skill_id,
    date '2026-05-01' + d.off as new_due
  from public.person_skills ps
  join public.skills sk on sk.id = ps.skill_id
  join role_req rr on rr.person_id = ps.person_id and rr.skill_id = ps.skill_id
  cross join lateral (
    select
      mod(
        case
          when hx.v < 0 then hx.v + 4294967296::bigint
          else hx.v
        end,
        153
      )::integer as off
    from (
      select ('x' || substring(md5(ps.person_id::text || ps.skill_id::text), 1, 8))::bit(32)::bigint as v
    ) hx
  ) d
  where ps.due_date is null
    and ps.is_extra is false
    and (
      (
        sk.kind = 'numeric'
        and (
          ps.actual_level is null
          or (ps.actual_level - rr.required_level) <= -2
          or (ps.actual_level - rr.required_level) = -1
        )
      )
      or (
        sk.kind = 'certification'
        and rr.required_level >= 1
        and (ps.actual_level is null or ps.actual_level < 1)
      )
    )
)
update public.person_skills ps
set due_date = t.new_due
from targets t
where ps.person_id = t.person_id
  and ps.skill_id = t.skill_id;
