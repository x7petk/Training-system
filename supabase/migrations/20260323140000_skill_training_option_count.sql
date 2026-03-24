-- Per-question number of answer choices (2–4). Existing rows default to 4.

alter table public.skill_training_questions
  add column if not exists option_count smallint not null default 4;

update public.skill_training_questions set option_count = 4 where option_count is null;

alter table public.skill_training_questions
  drop constraint if exists skill_training_questions_option_count_check;

alter table public.skill_training_questions
  add constraint skill_training_questions_option_count_check
  check (option_count >= 2 and option_count <= 4);

alter table public.skill_training_questions
  drop constraint if exists skill_training_questions_correct_matches_count_check;

alter table public.skill_training_questions
  add constraint skill_training_questions_correct_matches_count_check
  check (
    (option_count = 2 and correct_option in ('A', 'B'))
    or (option_count = 3 and correct_option in ('A', 'B', 'C'))
    or (option_count = 4 and correct_option in ('A', 'B', 'C', 'D'))
  );
