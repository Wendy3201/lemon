-- Pip Survivors: accounts, the leaderboard and moderation.
--
-- Paste all of this into Supabase > SQL Editor > New query, then press Run.
-- Running it again is safe (and is how an older copy gets the newer parts):
-- it only adds what is missing and refreshes the rules.
--
-- One row per player. Everyone signed in can read the rows of players who are
-- not banned; a player can only change the figures on their own row. Chapter,
-- Power and Collection show the save as it is now, so they go down when a
-- player resets; Endless, Pests, Challenges and Duels never go down when a
-- player sends them. Admins can ban, time out, unban and send gifts, but only
-- through the functions at the bottom, which check that the caller is an admin.
-- The Table Editor and this SQL editor can still change anything.

create table if not exists public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z0-9_]{3,16}$'),
  chapter integer not null default 0 check (chapter between 0 and 1000),
  power bigint not null default 0 check (power between 0 and 1000000000000),
  endless integer not null default 0 check (endless between 0 and 604800),
  kills bigint not null default 0 check (kills between 0 and 1000000000000),
  challenges integer not null default 0 check (challenges between 0 and 1000000),
  collection integer not null default 0 check (collection between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- moderation: admin accounts, and bans (banned_until 'infinity') or timeouts (a time)
alter table public.players add column if not exists admin boolean not null default false;
alter table public.players add column if not exists banned_until timestamptz;
alter table public.players add column if not exists ban_message text;
alter table public.players add column if not exists banned_by uuid references auth.users (id) on delete set null;
-- arena duels won against friends (playing together)
alter table public.players add column if not exists duels integer not null default 0 check (duels between 0 and 1000000);
alter table public.players drop constraint if exists players_ban_message_length;
alter table public.players add constraint players_ban_message_length check (char_length(ban_message) <= 200);

create unique index if not exists players_name_lower on public.players (lower(name));
create index if not exists players_updated_at on public.players (updated_at desc);

-- The admin accounts. To add or remove one later, tick or untick "admin" on its
-- row in the Table Editor (running this script again ticks these ones again).
update public.players set admin = true where lower(name) in ('test', 'owner', 'test2');

-- a new account gets its row straight away, named from the sign-up form
create or replace function public.pip_new_player()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.players (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'player_' || left(replace(new.id::text, '-', ''), 8))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists pip_new_player on auth.users;
create trigger pip_new_player
  after insert on auth.users
  for each row execute function public.pip_new_player();

-- accounts made before this script ran get a row too
insert into public.players (id, name)
select u.id, coalesce(u.raw_user_meta_data ->> 'name', 'player_' || left(replace(u.id::text, '-', ''), 8))
from auth.users u
on conflict do nothing;

-- Endless, Pests, Challenges and Duels sent by a player only ever go up. Chapter,
-- Power and Collection are what the player's save has right now, so they go
-- down too (after a reset, say). updated_at says when a figure last changed,
-- which is what the leaderboard's "This week" and "Today" look at.
create or replace function public.pip_keep_best()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.endless := greatest(new.endless, old.endless);
    new.kills := greatest(new.kills, old.kills);
    new.challenges := greatest(new.challenges, old.challenges);
    new.duels := greatest(new.duels, old.duels);
  end if;
  if row(new.chapter, new.power, new.endless, new.kills, new.challenges, new.collection, new.duels)
     is distinct from row(old.chapter, old.power, old.endless, old.kills, old.challenges, old.collection, old.duels) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists pip_keep_best on public.players;
create trigger pip_keep_best
  before update on public.players
  for each row execute function public.pip_keep_best();

-- is the signed-in account an admin?
create or replace function public.pip_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.admin from public.players p where p.id = (select auth.uid())), false);
$$;

-- who may do what
alter table public.players enable row level security;

drop policy if exists "Signed-in players can see the leaderboard" on public.players;
create policy "Signed-in players can see the leaderboard"
  on public.players for select
  to authenticated
  using (
    banned_until is null
    or banned_until <= now()
    or id = (select auth.uid())
    or (select public.pip_is_admin())
  );

drop policy if exists "Players can update their own figures" on public.players;
create policy "Players can update their own figures"
  on public.players for update
  to authenticated
  using ((select auth.uid()) = id and (banned_until is null or banned_until <= now()))
  with check ((select auth.uid()) = id);

grant usage on schema public to authenticated;
revoke all on public.players from anon, authenticated;
grant select on public.players to authenticated;
grant update (chapter, power, endless, kills, challenges, collection, duels) on public.players to authenticated;

-- gifts an admin sends, waiting until the player's game picks them up
create table if not exists public.gifts (
  id bigint generated always as identity primary key,
  player uuid not null references public.players (id) on delete cascade,
  kind text not null check (kind in ('item', 'gold', 'gems')),
  item text check (char_length(item) <= 64),
  rarity integer not null default 0 check (rarity between 0 and 20),
  amount bigint not null default 0 check (amount between 0 and 1000000000000),
  message text check (char_length(message) <= 200),
  sent_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists gifts_waiting on public.gifts (player) where claimed_at is null;
alter table public.gifts enable row level security;
revoke all on public.gifts from anon, authenticated;

/* The admin tools. minutes: how long a timeout lasts; 0 or null bans for good. */
create or replace function public.pip_ban(target uuid, minutes integer, message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pip_is_admin() then
    raise exception 'Only admins can do that.';
  end if;
  if target = (select auth.uid()) then
    raise exception 'You cannot ban yourself.';
  end if;
  if exists (select 1 from public.players p where p.id = target and p.admin) then
    raise exception 'Admins cannot be banned.';
  end if;
  update public.players
  set banned_until = case when coalesce(minutes, 0) <= 0 then 'infinity'::timestamptz
                          else now() + make_interval(mins => least(minutes, 525600)) end,
      ban_message = nullif(left(coalesce(message, ''), 200), ''),
      banned_by = (select auth.uid())
  where id = target;
end;
$$;

create or replace function public.pip_unban(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pip_is_admin() then
    raise exception 'Only admins can do that.';
  end if;
  update public.players
  set banned_until = null, ban_message = null, banned_by = null
  where id = target;
end;
$$;

/* kind 'item': item is an item id and rarity its rarity; 'gold' or 'gems': amount */
create or replace function public.pip_give(target uuid, kind text, item text, rarity integer, amount bigint, message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pip_is_admin() then
    raise exception 'Only admins can do that.';
  end if;
  if kind is null or kind not in ('item', 'gold', 'gems') then
    raise exception 'Pick what to give.';
  end if;
  if kind = 'item' and coalesce(item, '') = '' then
    raise exception 'Pick an item.';
  end if;
  if kind <> 'item' and coalesce(amount, 0) <= 0 then
    raise exception 'Pick an amount.';
  end if;
  insert into public.gifts (player, kind, item, rarity, amount, message, sent_by)
  values (
    target,
    kind,
    case when kind = 'item' then item end,
    case when kind = 'item' then greatest(coalesce(rarity, 0), 0) else 0 end,
    case when kind = 'item' then 0 else amount end,
    nullif(left(coalesce(message, ''), 200), ''),
    (select auth.uid())
  );
end;
$$;

/* the player's game picks up its gifts; each one is handed out once */
create or replace function public.pip_claim_gifts()
returns table (kind text, item text, rarity integer, amount bigint, message text)
language sql
security definer
set search_path = ''
as $$
  update public.gifts g
  set claimed_at = now()
  where g.player = (select auth.uid()) and g.claimed_at is null
  returning g.kind, g.item, g.rarity, g.amount, g.message;
$$;

revoke execute on function public.pip_is_admin() from public, anon;
revoke execute on function public.pip_ban(uuid, integer, text) from public, anon;
revoke execute on function public.pip_unban(uuid) from public, anon;
revoke execute on function public.pip_give(uuid, text, text, integer, bigint, text) from public, anon;
revoke execute on function public.pip_claim_gifts() from public, anon;
grant execute on function public.pip_is_admin() to authenticated;
grant execute on function public.pip_ban(uuid, integer, text) to authenticated;
grant execute on function public.pip_unban(uuid) to authenticated;
grant execute on function public.pip_give(uuid, text, text, integer, bigint, text) to authenticated;
grant execute on function public.pip_claim_gifts() to authenticated;
