-- =============================================================================
-- World Cup 2026 knockout tipping app — schema setup
-- Run this ONCE in the Supabase SQL editor (Dashboard ▸ SQL ▸ New query).
-- The `matches` table already exists and is seeded — this does NOT touch its data.
-- =============================================================================

-- leagues
create table if not exists leagues (
  id serial primary key,
  name text not null unique
);
insert into leagues (name) values ('Schwarzies'), ('Ben''s Footy Tipping')
on conflict (name) do nothing;

-- Rename legacy names if an earlier run created them (safe no-op otherwise).
-- If you already ran setup with the old names, you can run just these two lines.
update leagues set name = 'Schwarzies'         where name = 'Schwarzman Alumni';
update leagues set name = 'Ben''s Footy Tipping' where name = 'Friends & Family';

-- players (one row per person, created at the moment they confirm)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  league_id int not null references leagues(id),
  submitted_at timestamptz not null default now(),  -- their single submission time
  created_at timestamptz not null default now()
);

-- picks (one row per match per player; the whole bracket = 32 rows)
create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id text not null references matches(match_id),
  predicted_team text not null,
  created_at timestamptz not null default now(),
  unique (player_id, match_id)         -- one pick per match; blocks double-insert
);

-- Row Level Security
alter table leagues enable row level security;
alter table players enable row level security;
alter table picks   enable row level security;
alter table matches enable row level security;

-- everyone can read everything (public pool; brackets are meant to be seen)
create policy "public read leagues" on leagues for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read picks"   on picks   for select using (true);
create policy "public read matches" on matches for select using (true);

-- anyone may create their player row and insert picks (no-auth trust model)
create policy "anon insert players" on players for insert with check (true);
create policy "anon insert picks"   on picks   for insert with check (true);

-- NOTE: deliberately NO update/delete policies. With RLS on, that means the anon
-- key cannot update or delete any row. Confirmed picks are therefore immutable at
-- the database level. Results are written later via the service_role key (which
-- bypasses RLS), never from the browser.

-- =============================================================================
-- Atomic submission RPC.
-- The browser calls this instead of doing two separate inserts. A plpgsql
-- function runs in a single transaction, so if any of the 32 pick inserts fails
-- the player row is rolled back too — no orphans possible. It also enforces the
-- deadline and the one-bracket-per-name-per-league rule on the server side.
-- =============================================================================
create or replace function submit_bracket(
  p_name text,
  p_league_id int,
  p_picks jsonb
) returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player players;
  v_deadline timestamptz;
  rec jsonb;
begin
  -- Hard deadline = first R16 kick-off (M90).
  select kickoff_time into v_deadline from matches where match_id = 'M90';
  if v_deadline is not null and now() >= v_deadline then
    raise exception 'Submissions are closed (deadline has passed).';
  end if;

  -- One bracket per name per league.
  if exists (
    select 1 from players
    where lower(name) = lower(p_name) and league_id = p_league_id
  ) then
    raise exception 'A bracket already exists for this name in this league.';
  end if;

  insert into players (name, league_id)
  values (p_name, p_league_id)
  returning * into v_player;

  for rec in select * from jsonb_array_elements(p_picks)
  loop
    insert into picks (player_id, match_id, predicted_team)
    values (v_player.id, rec->>'match_id', rec->>'predicted_team');
  end loop;

  return v_player;
end;
$$;

grant execute on function submit_bracket(text, int, jsonb) to anon;
