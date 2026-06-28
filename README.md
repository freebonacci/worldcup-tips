# World Cup 2026 — Knockout Tips

A mobile-first prediction pool for the WC2026 knockout bracket (Round of 32 → Final).
React + Vite + Tailwind, talking directly to Supabase. All scoring, penalties and
standings are computed client-side.

## Setup

1. **Install** (already done if `node_modules` exists):
   ```
   npm install
   ```
2. **Add your Supabase anon key** to `.env` (gitignored — never commit it):
   ```
   VITE_SUPABASE_URL=https://ycfnpvwintoadppxyfdo.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon key>
   ```
3. **Create the tables.** Open the Supabase SQL editor and run **`supabase_setup.sql`**
   once. It creates `leagues`, `players`, `picks`, enables RLS + read policies, and
   adds the atomic `submit_bracket` RPC. (It does **not** touch the seeded `matches`.)
4. **Run it:**
   ```
   npm run dev
   ```
   Open http://localhost:5173.

## How scoring works

- A pick is correct iff your team for a match equals `matches.winner` (path-independent).
- Points: R32 = 1, R16 = 2, QF = 4, SF / 3rd / Final = 8. Perfect bracket = **80**.
- **Lateness penalty:** −3 for each R32 match that kicked off before you submitted.
  Reduces both your total and your max-possible.
- **Max possible** = banked + still-winnable − penalty, where still-winnable counts
  undecided matches your picked team can still reach on its real bracket path.
- **Lockout:** no new submissions after the first R16 kick-off (M90). Read live from
  the DB, not hardcoded.
- Submissions are **single and final** — enforced by RLS (no update/delete policies)
  and the atomic `submit_bracket` RPC.

## Admin (you run these in the Supabase SQL editor)

- **`admin_resolve_r32.sql`** — fill in real teams for M73–M88 once the group stage
  finishes. The bracket builder unlocks only when all 16 R32 ties have both teams set.
- **`admin_set_winners.sql`** — set `matches.winner` as games finish. Everything else
  recomputes automatically. (Seam left for a future service_role script.)

## Logic tests

```
node test/logic.test.mjs
```
Validates the feeder graph, the cascade, the SF-loser→3rd-place drop, max-possible
reachability and the lateness penalty against a synthetic bracket.

## Deployment (later)

Wired up last — see the build-order step 8. `npm run build` produces `dist/`;
`base: './'` in `vite.config.js` keeps it working under a GitHub Pages subpath.
