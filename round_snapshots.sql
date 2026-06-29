-- =============================================================================
-- Round snapshots — historical standings frozen at each round's completion.
-- Run this ONCE in the Supabase SQL editor (Dashboard ▸ SQL ▸ New query).
--
-- One row per round. `standings` holds all three standings for that round:
--   { "schwarzies": [...], "bens": [...], "combined": [...] }
-- each an ordered list of { rank, name, league, total, max, banked, penalty }.
--
-- The unique constraint on `round` makes writes idempotent: re-running the
-- snapshot writer (e.g. after correcting a result) UPDATES the existing row in
-- place rather than inserting a duplicate. Snapshots are produced by
-- scripts/write-snapshots.mjs, which runs the same scorePlayer engine the app
-- uses and upserts via the service_role key.
-- =============================================================================

create table if not exists round_snapshots (
  id           uuid primary key default gen_random_uuid(),
  round        text not null unique,                 -- 'R32' | 'R16' | 'QF' | 'SF' | '3P' | 'F'
  completed_at timestamptz not null default now(),   -- first time this round was captured
  standings    jsonb not null                        -- { schwarzies, bens, combined }
);

-- Row Level Security: public read (so the app can show history), writes only via
-- service_role (which bypasses RLS). No anon insert/update/delete policy exists,
-- so the browser anon key can never write or alter a snapshot.
alter table round_snapshots enable row level security;

create policy "public read round_snapshots"
  on round_snapshots for select using (true);
