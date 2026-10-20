-- Trigger functions are never meant to be called through the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_group() from public, anon, authenticated;

-- RLS helper functions are only used inside policies for signed-in users.
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_owner(uuid) from public, anon;
revoke all on function public.shares_group_with(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
