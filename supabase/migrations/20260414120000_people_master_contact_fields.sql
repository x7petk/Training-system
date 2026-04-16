-- Skill Matrix / shared roster: optional structured name + contact fields (Plan 24 master data uses same rows).

alter table public.people
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists phone text;

comment on column public.people.first_name is 'Given name (master data; optional if display_name is used alone).';
comment on column public.people.last_name is 'Family / second name.';
comment on column public.people.email is 'Work contact email (not necessarily same as auth.users email).';
comment on column public.people.phone is 'Work contact phone.';

-- Split existing display_name into first/last when still blank (best-effort).
update public.people
set
  first_name = coalesce(nullif(trim(first_name), ''), (regexp_match(trim(display_name), '^([^[:space:]]+)'))[1]),
  last_name = coalesce(
    nullif(trim(last_name), ''),
    nullif(trim(regexp_replace(trim(display_name), '^[^[:space:]]+[[:space:]]*', '')), '')
  )
where (first_name is null or trim(first_name) = '')
  and trim(display_name) ~ '[[:space:]]';

-- Sample contact data for common roster names (idempotent; RFC 2606 example.com).
update public.people p
set
  first_name = coalesce(nullif(trim(p.first_name), ''), v.fn),
  last_name = coalesce(nullif(trim(p.last_name), ''), v.ln),
  email = coalesce(nullif(trim(p.email), ''), v.email),
  phone = coalesce(nullif(trim(p.phone), ''), v.phone)
from (
  values
    ('Joel Calnan', 'Joel', 'Calnan', 'joel.calnan@example.com', '+64 21 555 0101'),
    ('Kurtis Ritani', 'Kurtis', 'Ritani', 'kurtis.ritani@example.com', '+64 21 555 0102'),
    ('Colin Hayes', 'Colin', 'Hayes', 'colin.hayes@example.com', '+64 21 555 0103'),
    ('Nigel Yaxley', 'Nigel', 'Yaxley', 'nigel.yaxley@example.com', '+64 21 555 0104'),
    ('Rhett Esmeralda', 'Rhett', 'Esmeralda', 'rhett.esmeralda@example.com', '+64 21 555 0105'),
    ('Sharon Buchanan', 'Sharon', 'Buchanan', 'sharon.buchanan@example.com', '+64 21 555 0106'),
    ('Hayley Luscombe', 'Hayley', 'Luscombe', 'hayley.luscombe@example.com', '+64 21 555 0107'),
    ('Marney Youngman', 'Marney', 'Youngman', 'marney.youngman@example.com', '+64 21 555 0108')
) as v(display_name, fn, ln, email, phone)
where trim(p.display_name) = v.display_name;
