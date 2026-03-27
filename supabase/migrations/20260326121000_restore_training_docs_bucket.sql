insert into storage.buckets (id, name, public)
values ('skill-training-docs', 'skill-training-docs', false)
on conflict (id) do nothing;
