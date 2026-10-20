-- IdeaBoard initial schema.
-- Run this once in the Supabase dashboard (SQL Editor), or via the Supabase CLI.

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Friend',
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  added_by uuid not null default auth.uid() references public.profiles (id),
  url text not null check (char_length(url) <= 2048),
  title text,
  image_url text,
  source text not null default 'other',
  place_name text,
  note text,
  created_at timestamptz not null default now()
);

create index ideas_group_id_created_at_idx
  on public.ideas (group_id, created_at desc);
create index group_members_user_id_idx on public.group_members (user_id);

-- ------------------------------------------------------ helper functions
-- security definer so policies can check membership without recursing into
-- the group_members policies themselves.

create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = gid and created_by = auth.uid()
  );
$$;

create function public.shares_group_with(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = uid
  );
$$;

-- ---------------------------------------------------------------- triggers

-- Every new auth user gets a profile (display name from their email prefix).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'Friend')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a group becomes its owner-member automatically.
create function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ------------------------------------------------------- invite functions

-- Join a group with its invite code. Returns the group id.
create function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select id into gid from public.groups where invite_code = code;
  if gid is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;

  return gid;
end;
$$;

-- Lets someone holding an invite code see the group name before joining.
create function public.group_name_by_code(code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select name from public.groups where invite_code = code;
$$;

revoke all on function public.join_group_by_code(text) from public, anon;
revoke all on function public.group_name_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.group_name_by_code(text) to authenticated;

-- ------------------------------------------------------ row level security

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.ideas enable row level security;

-- profiles: see yourself and people you share a group with; edit only yourself
create policy "profiles are visible to group mates"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: members can read; creator can read right after insert; owner edits
create policy "members read their groups"
  on public.groups for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());

create policy "signed-in users create groups"
  on public.groups for insert to authenticated
  with check (created_by = auth.uid());

create policy "owners update groups"
  on public.groups for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "owners delete groups"
  on public.groups for delete to authenticated
  using (created_by = auth.uid());

-- group_members: members see each other. Joining goes through
-- join_group_by_code(); there is deliberately no insert policy.
create policy "members see co-members"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy "leave a group, or owner removes a member"
  on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_owner(group_id));

-- ideas: members read and add; authors (or the group owner) delete
create policy "members read ideas"
  on public.ideas for select to authenticated
  using (public.is_group_member(group_id));

create policy "members add ideas"
  on public.ideas for insert to authenticated
  with check (public.is_group_member(group_id) and added_by = auth.uid());

create policy "authors and owners delete ideas"
  on public.ideas for delete to authenticated
  using (added_by = auth.uid() or public.is_group_owner(group_id));

-- ---------------------------------------------------------------- realtime
-- Lets the group page show new tiles as friends add them (RLS still applies).
alter publication supabase_realtime add table public.ideas;
