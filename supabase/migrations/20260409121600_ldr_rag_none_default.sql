-- Set RAG default to none (separate migration after enum value exists).

alter table public.ldr_assignments
  alter column rag_status set default 'none';
