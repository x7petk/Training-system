-- UI no longer calls this RPC (PostgREST schema cache / deploy drift); move uses table writes.
drop function if exists public.plan24_move_check_event(uuid, timestamptz, timestamptz, text);
