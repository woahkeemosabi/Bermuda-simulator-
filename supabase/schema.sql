-- Bermuda Simulator account + cloud-save schema.
-- Run this in the project's Supabase SQL editor or through the Supabase plugin.

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_profiles_username_format check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$')
);

create unique index if not exists player_profiles_username_lower_unique
  on public.player_profiles (lower(username))
  where username is not null;

create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
alter table public.player_saves enable row level security;

drop policy if exists "players read own profile" on public.player_profiles;
create policy "players read own profile"
  on public.player_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "players insert own profile" on public.player_profiles;
create policy "players insert own profile"
  on public.player_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "players update own profile" on public.player_profiles;
create policy "players update own profile"
  on public.player_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "players read own save" on public.player_saves;
create policy "players read own save"
  on public.player_saves for select
  using (auth.uid() = user_id);

drop policy if exists "players insert own save" on public.player_saves;
create policy "players insert own save"
  on public.player_saves for insert
  with check (auth.uid() = user_id);

drop policy if exists "players update own save" on public.player_saves;
create policy "players update own save"
  on public.player_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep server timestamps/revisions authoritative without requiring elevated client permissions.
create or replace function public.bermuda_touch_save()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then
    new.revision = old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists bermuda_touch_save on public.player_saves;
create trigger bermuda_touch_save
before update on public.player_saves
for each row execute function public.bermuda_touch_save();

create or replace function public.bermuda_touch_profile()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bermuda_touch_profile on public.player_profiles;
create trigger bermuda_touch_profile
before update on public.player_profiles
for each row execute function public.bermuda_touch_profile();
