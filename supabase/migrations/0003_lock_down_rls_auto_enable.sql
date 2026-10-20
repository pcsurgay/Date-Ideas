-- rls_auto_enable() is an event-trigger function created by Supabase; it must
-- not be callable through the REST API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
