-- Pip Survivors: accounts, the leaderboard, moderation and trading.
--
-- Paste all of this into Supabase > SQL Editor > New query, then press Run.
-- Running it again is safe (and is how an older copy gets the newer parts):
-- it only adds what is missing and refreshes the rules.
--
-- One row per player. Everyone signed in can read the rows of players who are
-- not banned; a player can only change the figures on their own row. Chapter,
-- Power and Collection show the save as it is now, so they go down when a
-- player resets; Endless, Pests, Challenges and Duels never go down when a
-- player sends them. Admins can ban, time out, unban, send gifts, take things
-- away, change the banner, look at a player's inventory and see who is online,
-- but only through the functions and rules below, which check that the caller
-- is an admin. Trades go through the server too, which holds both offers so nobody
-- can swap theirs at the last moment. The Table Editor and this SQL editor can
-- still change anything.

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

-- What an admin takes away from a player (gold, gems or gear), waiting until
-- the player's game picks it up: straight away if they are playing, or the
-- next time they open the game. amount 0 means all of it (every copy of an
-- item). A separate table from gifts, so a game too old to know about takes
-- leaves them waiting instead of mistaking them for gifts.
create table if not exists public.takes (
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

create index if not exists takes_waiting on public.takes (player) where claimed_at is null;
alter table public.takes enable row level security;
revoke all on public.takes from anon, authenticated;

-- The banner: the strip of text above the game's top bar, which an admin
-- changes from the admin menu (Settings). One row at most. No row, or no
-- message, means the game shows the text written in index.html; an empty
-- message hides the strip. Anyone can read it; only pip_set_banner changes it.
create table if not exists public.banner (
  id integer primary key default 1 check (id = 1),
  message text check (char_length(message) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.banner enable row level security;

drop policy if exists "Everyone can read the banner" on public.banner;
create policy "Everyone can read the banner"
  on public.banner for select
  to anon, authenticated
  using (true);

grant usage on schema public to anon;
revoke all on public.banner from anon, authenticated;
grant select (id, message, updated_at) on public.banner to anon, authenticated;

-- What each player owns (gear, pets, gold, gems), as their game last sent it,
-- so an admin can look. A player can read their own; admins can read anyone's.
-- The size limit keeps a giant made-up inventory from ever being stored.
create table if not exists public.inventories (
  player uuid primary key references public.players (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint inventories_size check (octet_length(data::text) <= 200000)
);

alter table public.inventories enable row level security;

drop policy if exists "Admins can see inventories" on public.inventories;
create policy "Admins can see inventories"
  on public.inventories for select
  to authenticated
  using (player = (select auth.uid()) or (select public.pip_is_admin()));

revoke all on public.inventories from anon, authenticated;
grant select on public.inventories to authenticated;

-- Trades between two players. Each side's offer lives here, not in the
-- players' games: changing an offer takes back both acceptances, once both
-- have accepted the trade is locked (no more changes), and three seconds
-- after that it is done. Each game then picks up what it got, once.
-- status: waiting (for the second player), open, locked, done or cancelled.
create table if not exists public.trades (
  id bigint generated always as identity primary key,
  code text not null check (code ~ '^[A-Z2-9]{6}$'),
  a uuid not null references public.players (id) on delete cascade,
  b uuid references public.players (id) on delete cascade,
  a_name text not null default '',
  b_name text not null default '',
  a_offer jsonb not null default '{}'::jsonb,
  b_offer jsonb not null default '{}'::jsonb,
  a_ok boolean not null default false,
  b_ok boolean not null default false,
  version integer not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'open', 'locked', 'done', 'cancelled')),
  reason text not null default '',
  locked_at timestamptz,
  done_at timestamptz,
  a_seen timestamptz not null default now(),
  b_seen timestamptz,
  a_got timestamptz,
  b_got timestamptz,
  created_at timestamptz not null default now(),
  constraint trades_offer_size check (octet_length(a_offer::text) <= 8000 and octet_length(b_offer::text) <= 8000)
);

create unique index if not exists trades_live_code on public.trades (code) where status in ('waiting', 'open', 'locked');
create index if not exists trades_by_a on public.trades (a, status);
create index if not exists trades_by_b on public.trades (b, status);
alter table public.trades enable row level security;
revoke all on public.trades from anon, authenticated;

-- One-off proofs that a game belongs to an admin account. In co-op and the
-- arena, an admin who joined someone else's room sends one to the room
-- maker's game, which asks the server whether it is real before it lets
-- that player's dev menu change anything.
create table if not exists public.dev_tokens (
  token uuid primary key default gen_random_uuid(),
  player uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.dev_tokens enable row level security;
revoke all on public.dev_tokens from anon, authenticated;

-- Who has the game open. Each signed-in game says so about every 45 seconds
-- (and what it is doing), and says when it closes. Only admins can see it,
-- through pip_presence; a game not heard from for 2 minutes counts as offline.
create table if not exists public.presence (
  player uuid primary key references public.players (id) on delete cascade,
  seen_at timestamptz not null default now(),
  open boolean not null default true,
  doing text not null default '' check (char_length(doing) <= 20)
);

alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

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

/* Take something away. kind 'item': item is an item id, rarity its rarity and
   amount how many copies; 'gold' or 'gems': amount. amount 0 takes all of it. */
create or replace function public.pip_take(target uuid, kind text, item text, rarity integer, amount bigint, message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pip_is_admin() then
    raise exception 'Only admins can do that.';
  end if;
  if not exists (select 1 from public.players p where p.id = target) then
    raise exception 'That player has gone.';
  end if;
  if kind is null or kind not in ('item', 'gold', 'gems') then
    raise exception 'Pick what to take.';
  end if;
  if kind = 'item' and coalesce(item, '') !~ '^[a-z0-9_]{1,40}$' then
    raise exception 'Pick an item.';
  end if;
  if coalesce(amount, 0) < 0 then
    raise exception 'Pick an amount.';
  end if;
  insert into public.takes (player, kind, item, rarity, amount, message, sent_by)
  values (
    target,
    kind,
    case when kind = 'item' then item end,
    case when kind = 'item' then least(greatest(coalesce(rarity, 0), 0), 20) else 0 end,
    least(coalesce(amount, 0), 1000000000000),
    nullif(left(coalesce(message, ''), 200), ''),
    (select auth.uid())
  );
end;
$$;

/* the player's game picks up what is to be taken away; each one is handed out once */
create or replace function public.pip_claim_takes()
returns table (kind text, item text, rarity integer, amount bigint, message text)
language sql
security definer
set search_path = ''
as $$
  update public.takes t
  set claimed_at = now()
  where t.player = (select auth.uid()) and t.claimed_at is null
  returning t.kind, t.item, t.rarity, t.amount, t.message;
$$;

/* For admins: what is still waiting to be taken from a player (their game has not picked it up). */
create or replace function public.pip_takes_waiting(target uuid)
returns table (id bigint, kind text, item text, rarity integer, amount bigint, message text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.kind, t.item, t.rarity, t.amount, t.message, t.created_at
  from public.takes t
  where t.player = target and t.claimed_at is null and public.pip_is_admin()
  order by t.created_at;
$$;

/* For admins: call off a take the player's game has not picked up yet. */
create or replace function public.pip_take_cancel(take_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pip_is_admin() then
    raise exception 'Only admins can do that.';
  end if;
  delete from public.takes where id = take_id and claimed_at is null;
  if not found then
    raise exception 'Too late: their game has already picked that up.';
  end if;
end;
$$;

/* new_text: what the banner says ('' hides it); null goes back to the text in index.html */
create or replace function public.pip_set_banner(new_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pip_is_admin() then
    raise exception 'Only admins can do that.';
  end if;
  insert into public.banner (id, message, updated_at, updated_by)
  values (1, left(btrim(new_text), 200), now(), (select auth.uid()))
  on conflict (id) do update
    set message = excluded.message, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end;
$$;

/* a player's game keeps its copy of the inventory up to date */
create or replace function public.pip_put_inventory(inv jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Log in first.';
  end if;
  if inv is null or jsonb_typeof(inv) <> 'object' then
    raise exception 'That is not an inventory.';
  end if;
  if octet_length(inv::text) > 200000 then
    raise exception 'That inventory is too big to keep.';
  end if;
  insert into public.inventories (player, data, updated_at)
  values ((select auth.uid()), inv, now())
  on conflict (player) do update set data = excluded.data, updated_at = excluded.updated_at;
end;
$$;

/* This player's game is open (here true) or closing (false), and what it is
   doing: 'menus', 'battle', 'co-op', 'duel' or 'trading'. */
create or replace function public.pip_seen(here boolean, doing text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;
  insert into public.presence (player, seen_at, open, doing)
  values ((select auth.uid()), now(), coalesce(here, true), left(coalesce(doing, ''), 20))
  on conflict (player) do update set seen_at = excluded.seen_at, open = excluded.open, doing = excluded.doing;
end;
$$;

/* For admins: who is online now, and how many seconds since each game was
   last heard from (counted by the server's clock, not the players'). */
create or replace function public.pip_presence()
returns table (player uuid, online boolean, doing text, seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.player,
         s.open and s.seen_at > now() - interval '2 minutes',
         s.doing,
         greatest(0, floor(extract(epoch from now() - s.seen_at)))::integer
  from public.presence s
  where public.pip_is_admin();
$$;

/* ------------------------------------------------------------- trading */

/* An offer as the server keeps it: at most 20 items and 6 pets, each with
   only the fields the game reads, and gold and gems as whole numbers.
   Anything else in what was sent is dropped; a broken offer is refused. */
create or replace function public.pip_trade_clean(offer jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  items jsonb := '[]'::jsonb;
  pets jsonb := '[]'::jsonb;
  x jsonb;
  gold numeric := 0;
  gems numeric := 0;
begin
  if offer is null or jsonb_typeof(offer) <> 'object' then
    raise exception 'That offer is not one the game can read.';
  end if;
  if jsonb_typeof(offer -> 'items') = 'array' then
    if jsonb_array_length(offer -> 'items') > 20 then
      raise exception 'At most 20 items in one trade.';
    end if;
    for x in select value from jsonb_array_elements(offer -> 'items') loop
      if jsonb_typeof(x) is distinct from 'object'
         or coalesce(x ->> 'id', '') !~ '^[a-z0-9_]{1,40}$'
         or jsonb_typeof(x -> 'r') is distinct from 'number'
         or jsonb_typeof(x -> 'u') is distinct from 'number' then
        raise exception 'That offer is not one the game can read.';
      end if;
      items := items || jsonb_build_array(jsonb_build_object(
        'id', x ->> 'id',
        'r', least(greatest(floor((x ->> 'r')::numeric), 0), 20)::integer,
        'u', least(greatest(floor((x ->> 'u')::numeric), 0), 1000000000000)::bigint
      ));
    end loop;
  end if;
  if jsonb_typeof(offer -> 'pets') = 'array' then
    if jsonb_array_length(offer -> 'pets') > 6 then
      raise exception 'At most 6 pets in one trade.';
    end if;
    for x in select value from jsonb_array_elements(offer -> 'pets') loop
      if jsonb_typeof(x) is distinct from 'object'
         or coalesce(x ->> 'sp', '') !~ '^[a-z0-9_]{1,40}$'
         or jsonb_typeof(x -> 'r') is distinct from 'number'
         or jsonb_typeof(x -> 'lv') is distinct from 'number'
         or jsonb_typeof(x -> 'u') is distinct from 'number' then
        raise exception 'That offer is not one the game can read.';
      end if;
      pets := pets || jsonb_build_array(jsonb_build_object(
        'sp', x ->> 'sp',
        'r', least(greatest(floor((x ->> 'r')::numeric), 0), 20)::integer,
        'lv', least(greatest(floor((x ->> 'lv')::numeric), 1), 1000)::integer,
        'u', least(greatest(floor((x ->> 'u')::numeric), 0), 1000000000000)::bigint
      ));
    end loop;
  end if;
  if jsonb_typeof(offer -> 'gold') = 'number' then
    gold := least(greatest(floor((offer ->> 'gold')::numeric), 0), 1000000000000);
  end if;
  if jsonb_typeof(offer -> 'gems') = 'number' then
    gems := least(greatest(floor((offer ->> 'gems')::numeric), 0), 1000000000);
  end if;
  return jsonb_build_object('items', items, 'pets', pets, 'gold', gold::bigint, 'gems', gems::bigint);
end;
$$;

/* nothing in it at all */
create or replace function public.pip_trade_empty(offer jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_array_length(offer -> 'items'), 0) = 0
     and coalesce(jsonb_array_length(offer -> 'pets'), 0) = 0
     and coalesce((offer ->> 'gold')::numeric, 0) = 0
     and coalesce((offer ->> 'gems')::numeric, 0) = 0;
$$;

/* A trade as one of its two players sees it: "mine" is what they give and
   "theirs" what they get. `now` is the server's clock, for the countdown. */
create or replace function public.pip_trade_view(t public.trades, me uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'code', t.code,
    'status', t.status,
    'reason', t.reason,
    'version', t.version,
    'side', case when t.a = me then 'a' else 'b' end,
    'mine', case when t.a = me then t.a_offer else t.b_offer end,
    'theirs', case when t.a = me then t.b_offer else t.a_offer end,
    'my_ok', case when t.a = me then t.a_ok else t.b_ok end,
    'their_ok', case when t.a = me then t.b_ok else t.a_ok end,
    'their_name', case when t.a = me then t.b_name else t.a_name end,
    'locked_at', t.locked_at,
    'got', case when t.a = me then t.a_got is not null else t.b_got is not null end,
    'now', now()
  );
$$;

/* Tidying up after a player: locked trades whose three seconds are up are
   done, trades everyone has walked away from are called off, and old
   finished ones are cleared out. */
create or replace function public.pip_trade_tidy(me uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trades
  set status = 'done', done_at = now()
  where (a = me or b = me) and status = 'locked' and locked_at <= now() - interval '3 seconds';
  update public.trades
  set status = 'cancelled', reason = 'left'
  where (a = me or b = me) and status in ('waiting', 'open')
    and greatest(a_seen, coalesce(b_seen, a_seen)) < now() - interval '2 minutes';
  delete from public.trades
  where created_at < now() - interval '30 days'
    and (status = 'cancelled' or (status = 'done' and a_got is not null and b_got is not null));
end;
$$;

/* the player's name, if they may trade (signed in and not banned) */
create or replace function public.pip_trader_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.name from public.players p
  where p.id = (select auth.uid()) and (p.banned_until is null or p.banned_until <= now());
$$;

/* Start a trade: a new code for a friend to type in. Any other trade this
   player has open (not locked) is called off. */
create or replace function public.pip_trade_open()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_name text := public.pip_trader_name();
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  tries integer := 0;
  t public.trades;
begin
  if me is null or my_name is null then
    raise exception 'Log in to trade.';
  end if;
  perform public.pip_trade_tidy(me);
  update public.trades
  set status = 'cancelled', reason = 'replaced'
  where (a = me or b = me) and status in ('waiting', 'open');
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(letters, 1 + floor(random() * length(letters))::integer, 1);
    end loop;
    exit when not exists (
      select 1 from public.trades x where x.code = new_code and x.status in ('waiting', 'open', 'locked')
    );
    tries := tries + 1;
    if tries > 20 then
      raise exception 'Could not make a trade code. Try again.';
    end if;
  end loop;
  insert into public.trades (code, a, a_name) values (new_code, me, my_name) returning * into t;
  return public.pip_trade_view(t, me);
end;
$$;

/* Join a friend's trade with its code. */
create or replace function public.pip_trade_join(join_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_name text := public.pip_trader_name();
  t public.trades;
begin
  if me is null or my_name is null then
    raise exception 'Log in to trade.';
  end if;
  perform public.pip_trade_tidy(me);
  select * into t from public.trades x
  where x.code = upper(btrim(coalesce(join_code, ''))) and x.status = 'waiting'
  for update;
  if not found then
    raise exception 'No trade is waiting with that code. Check it and try again.';
  end if;
  if t.a = me then
    raise exception 'That is your own trade code: give it to your friend.';
  end if;
  update public.trades
  set status = 'cancelled', reason = 'replaced'
  where (a = me or b = me) and status in ('waiting', 'open') and id <> t.id;
  update public.trades
  set b = me, b_name = my_name, b_seen = now(), status = 'open', version = version + 1
  where id = t.id
  returning * into t;
  return public.pip_trade_view(t, me);
end;
$$;

/* How the trade stands now. Asked about once a second by both games: it also
   notices a player who has gone, and finishes a locked trade once its three
   seconds are up. */
create or replace function public.pip_trade_state(trade_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t public.trades;
begin
  select * into t from public.trades x where x.id = trade_id and (x.a = me or x.b = me) for update;
  if not found then
    raise exception 'That trade has gone.';
  end if;
  if t.a = me then
    update public.trades set a_seen = now() where id = t.id returning * into t;
  else
    update public.trades set b_seen = now() where id = t.id returning * into t;
  end if;
  if t.status = 'open' and (case when t.a = me then t.b_seen else t.a_seen end) < now() - interval '20 seconds' then
    update public.trades set status = 'cancelled', reason = 'left' where id = t.id returning * into t;
  elsif t.status = 'waiting' and t.created_at < now() - interval '30 minutes' then
    update public.trades set status = 'cancelled', reason = 'expired' where id = t.id returning * into t;
  elsif t.status = 'locked' and t.locked_at <= now() - interval '3 seconds' then
    update public.trades set status = 'done', done_at = now() where id = t.id returning * into t;
  end if;
  return public.pip_trade_view(t, me);
end;
$$;

/* Change what this player gives. Both acceptances are taken back, and a
   locked trade cannot be changed at all. */
create or replace function public.pip_trade_offer(trade_id bigint, offer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  clean jsonb := public.pip_trade_clean(offer);
  t public.trades;
begin
  select * into t from public.trades x where x.id = trade_id and (x.a = me or x.b = me) for update;
  if not found then
    raise exception 'That trade has gone.';
  end if;
  if t.status = 'locked' then
    raise exception 'The trade is locked because you both accepted. Press Stop to change it.';
  end if;
  if t.status <> 'open' then
    raise exception 'That trade is over.';
  end if;
  if clean = (case when t.a = me then t.a_offer else t.b_offer end) then
    return public.pip_trade_view(t, me);
  end if;
  if t.a = me then
    update public.trades
    set a_offer = clean, a_ok = false, b_ok = false, version = version + 1, a_seen = now()
    where id = t.id returning * into t;
  else
    update public.trades
    set b_offer = clean, a_ok = false, b_ok = false, version = version + 1, b_seen = now()
    where id = t.id returning * into t;
  end if;
  return public.pip_trade_view(t, me);
end;
$$;

/* Accept (ok true) or take it back (ok false). seen_version is the version
   of the trade the player was looking at: if either offer changed since, the
   accept is refused. When both have accepted, the trade locks; taking it back
   in the three seconds after that ("Stop") unlocks it again. */
create or replace function public.pip_trade_accept(trade_id bigint, seen_version integer, ok boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t public.trades;
begin
  select * into t from public.trades x where x.id = trade_id and (x.a = me or x.b = me) for update;
  if not found then
    raise exception 'That trade has gone.';
  end if;
  if t.status = 'locked' then
    if t.locked_at <= now() - interval '3 seconds' then
      update public.trades set status = 'done', done_at = now() where id = t.id returning * into t;
    elsif not coalesce(ok, false) then
      update public.trades
      set status = 'open', locked_at = null, a_ok = false, b_ok = false, version = version + 1
      where id = t.id returning * into t;
    end if;
    return public.pip_trade_view(t, me);
  end if;
  if t.status <> 'open' then
    raise exception 'That trade is over.';
  end if;
  if coalesce(ok, false) then
    if t.version <> seen_version then
      raise exception 'The offer just changed. Have a look, then accept again.';
    end if;
    if public.pip_trade_empty(t.a_offer) and public.pip_trade_empty(t.b_offer) then
      raise exception 'Put something in the trade first.';
    end if;
  end if;
  if t.a = me then
    update public.trades set a_ok = coalesce(ok, false), a_seen = now() where id = t.id returning * into t;
  else
    update public.trades set b_ok = coalesce(ok, false), b_seen = now() where id = t.id returning * into t;
  end if;
  if t.a_ok and t.b_ok then
    update public.trades set status = 'locked', locked_at = now() where id = t.id returning * into t;
  end if;
  return public.pip_trade_view(t, me);
end;
$$;

/* Walk away from a trade. Too late once a locked trade's three seconds are up:
   then it is done instead. */
create or replace function public.pip_trade_cancel(trade_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t public.trades;
begin
  select * into t from public.trades x where x.id = trade_id and (x.a = me or x.b = me) for update;
  if not found then
    raise exception 'That trade has gone.';
  end if;
  if t.status = 'locked' and t.locked_at <= now() - interval '3 seconds' then
    update public.trades set status = 'done', done_at = now() where id = t.id returning * into t;
  elsif t.status in ('waiting', 'open', 'locked') then
    update public.trades
    set status = 'cancelled', reason = case when t.a = me then 'a_left' else 'b_left' end
    where id = t.id returning * into t;
  end if;
  return public.pip_trade_view(t, me);
end;
$$;

/* The player's game has put what it got into its save. */
create or replace function public.pip_trade_got(trade_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trades set a_got = coalesce(a_got, now())
  where id = trade_id and a = (select auth.uid()) and status = 'done';
  update public.trades set b_got = coalesce(b_got, now())
  where id = trade_id and b = (select auth.uid()) and status = 'done';
end;
$$;

/* Finished trades this player's game has not picked up yet (after closing
   the game during the countdown, say). */
create or replace function public.pip_trade_pending()
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  t public.trades;
begin
  if me is null then
    return;
  end if;
  perform public.pip_trade_tidy(me);
  for t in
    select * from public.trades x
    where x.status = 'done' and ((x.a = me and x.a_got is null) or (x.b = me and x.b_got is null))
    order by x.done_at
  loop
    return next public.pip_trade_view(t, me);
  end loop;
end;
$$;

/* ------------------------------------ admin dev tools in co-op and the arena */

/* A proof, for the room maker's game, that this game belongs to an admin account. */
create or replace function public.pip_dev_token()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
begin
  if not public.pip_is_admin() then
    raise exception 'Only admins can do that.';
  end if;
  delete from public.dev_tokens where created_at < now() - interval '1 day';
  insert into public.dev_tokens (player) values ((select auth.uid())) returning token into made;
  return made;
end;
$$;

/* Is this a proof an admin account made in the last twelve hours? */
create or replace function public.pip_dev_check(check_token uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dev_tokens d join public.players p on p.id = d.player
    where d.token = check_token and d.created_at > now() - interval '12 hours' and p.admin
  );
$$;

revoke execute on function public.pip_is_admin() from public, anon;
revoke execute on function public.pip_ban(uuid, integer, text) from public, anon;
revoke execute on function public.pip_unban(uuid) from public, anon;
revoke execute on function public.pip_give(uuid, text, text, integer, bigint, text) from public, anon;
revoke execute on function public.pip_claim_gifts() from public, anon;
revoke execute on function public.pip_set_banner(text) from public, anon;
revoke execute on function public.pip_put_inventory(jsonb) from public, anon;
revoke execute on function public.pip_trade_open() from public, anon;
revoke execute on function public.pip_trade_join(text) from public, anon;
revoke execute on function public.pip_trade_state(bigint) from public, anon;
revoke execute on function public.pip_trade_offer(bigint, jsonb) from public, anon;
revoke execute on function public.pip_trade_accept(bigint, integer, boolean) from public, anon;
revoke execute on function public.pip_trade_cancel(bigint) from public, anon;
revoke execute on function public.pip_trade_got(bigint) from public, anon;
revoke execute on function public.pip_trade_pending() from public, anon;
revoke execute on function public.pip_dev_token() from public, anon;
revoke execute on function public.pip_dev_check(uuid) from public, anon;
revoke execute on function public.pip_seen(boolean, text) from public, anon;
revoke execute on function public.pip_take(uuid, text, text, integer, bigint, text) from public, anon;
revoke execute on function public.pip_claim_takes() from public, anon;
revoke execute on function public.pip_takes_waiting(uuid) from public, anon;
revoke execute on function public.pip_take_cancel(bigint) from public, anon;
revoke execute on function public.pip_presence() from public, anon;
-- the helpers behind the trades are only for the functions above
revoke execute on function public.pip_trade_clean(jsonb) from public, anon, authenticated;
revoke execute on function public.pip_trade_empty(jsonb) from public, anon, authenticated;
revoke execute on function public.pip_trade_view(public.trades, uuid) from public, anon, authenticated;
revoke execute on function public.pip_trade_tidy(uuid) from public, anon, authenticated;
revoke execute on function public.pip_trader_name() from public, anon, authenticated;
grant execute on function public.pip_is_admin() to authenticated;
grant execute on function public.pip_ban(uuid, integer, text) to authenticated;
grant execute on function public.pip_unban(uuid) to authenticated;
grant execute on function public.pip_give(uuid, text, text, integer, bigint, text) to authenticated;
grant execute on function public.pip_claim_gifts() to authenticated;
grant execute on function public.pip_set_banner(text) to authenticated;
grant execute on function public.pip_put_inventory(jsonb) to authenticated;
grant execute on function public.pip_trade_open() to authenticated;
grant execute on function public.pip_trade_join(text) to authenticated;
grant execute on function public.pip_trade_state(bigint) to authenticated;
grant execute on function public.pip_trade_offer(bigint, jsonb) to authenticated;
grant execute on function public.pip_trade_accept(bigint, integer, boolean) to authenticated;
grant execute on function public.pip_trade_cancel(bigint) to authenticated;
grant execute on function public.pip_trade_got(bigint) to authenticated;
grant execute on function public.pip_trade_pending() to authenticated;
grant execute on function public.pip_dev_token() to authenticated;
grant execute on function public.pip_dev_check(uuid) to authenticated;
grant execute on function public.pip_seen(boolean, text) to authenticated;
grant execute on function public.pip_take(uuid, text, text, integer, bigint, text) to authenticated;
grant execute on function public.pip_claim_takes() to authenticated;
grant execute on function public.pip_takes_waiting(uuid) to authenticated;
grant execute on function public.pip_take_cancel(bigint) to authenticated;
grant execute on function public.pip_presence() to authenticated;
