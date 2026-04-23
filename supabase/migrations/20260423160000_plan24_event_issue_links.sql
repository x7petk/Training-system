alter table public.plan24_events
  add column if not exists linked_issue_kind text,
  add column if not exists linked_issue_id uuid,
  add column if not exists linked_issue_created_at timestamptz;

create index if not exists plan24_events_linked_issue_idx
  on public.plan24_events (linked_issue_kind, linked_issue_id)
  where linked_issue_id is not null and deleted_at is null;
