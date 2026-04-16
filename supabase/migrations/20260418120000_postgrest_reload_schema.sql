-- If standard_url columns were added manually or PostgREST still reports "schema cache" errors, this nudges a reload.
notify pgrst, 'reload schema';
