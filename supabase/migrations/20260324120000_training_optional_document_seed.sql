-- Optional training document; allow pack with quiz only.
-- Seed default pack + first question for numeric skills that have no questions yet.

alter table public.skill_training_packs alter column document_path drop not null;
alter table public.skill_training_packs alter column document_name drop not null;
alter table public.skill_training_packs alter column document_mime drop not null;

alter table public.skill_training_packs
  drop constraint if exists skill_training_packs_document_size_bytes_check;

alter table public.skill_training_packs
  alter column document_size_bytes drop not null;

alter table public.skill_training_packs
  add constraint skill_training_packs_document_size_bytes_check
  check (
    document_size_bytes is null
    or (document_size_bytes >= 0 and document_size_bytes <= 10485760)
  );

insert into public.skill_training_packs (skill_id, document_path, document_name, document_mime, document_size_bytes, pass_score_percent)
select s.id, null, null, null, 0, 100
from public.skills s
where s.kind = 'numeric'
  and not exists (select 1 from public.skill_training_packs p where p.skill_id = s.id);

insert into public.skill_training_questions (
  skill_id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_option,
  option_count,
  sort_order
)
select
  p.skill_id,
  'Do you understand a theory?',
  'Yes',
  'No',
  '',
  '',
  'A',
  2,
  1
from public.skill_training_packs p
join public.skills s on s.id = p.skill_id and s.kind = 'numeric'
where not exists (select 1 from public.skill_training_questions q where q.skill_id = p.skill_id);
