-- LDR roster: add explicit None state for RAG.

do $e$
begin
  alter type public.ldr_rag_status add value if not exists 'none';
exception
  when duplicate_object then null;
end $e$;
