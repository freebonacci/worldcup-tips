// ---------------------------------------------------------------------------
// Snapshot writer — run AFTER recording results (admin_set_winners.sql).
//
// For every round that is now COMPLETE (all its matches have a real winner) it
// captures one snapshot holding the Schwarzies, Ben's, and Combined standings,
// computed with the same scorePlayer engine the app uses, and upserts it into
// round_snapshots keyed on `round`. Incomplete rounds are skipped; re-running
// after a correction updates the affected round's snapshot in place.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = '<service_role key>'
//   node scripts/write-snapshots.mjs
//
// The URL is read from .env (VITE_SUPABASE_URL). The service_role key must be
// supplied via the environment — never commit it. RLS lets only service_role
// write round_snapshots.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { buildGraph } from '../src/lib/bracket.js'
import { buildRoundSnapshots } from '../src/lib/snapshots.js'

function readEnvFile() {
  try {
    return readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .reduce((acc, line) => {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m) acc[m[1]] = m[2]
        return acc
      }, {})
  } catch {
    return {}
  }
}

const fileEnv = readEnvFile()
const url = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!url) {
  console.error('Missing VITE_SUPABASE_URL (set it in .env or the environment).')
  process.exit(1)
}
if (!key) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY in the environment. Writing snapshots ' +
      'requires the service_role key (RLS blocks the anon key).'
  )
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}` }

// Page through a table with Range so we always get the full set (>1,000 rows).
async function fetchAll(table) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' },
    })
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
    const data = await res.json()
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function main() {
  const [matches, leagues, players, picks] = await Promise.all([
    fetchAll('matches'),
    fetchAll('leagues'),
    fetchAll('players'),
    fetchAll('picks'),
  ])
  const graph = buildGraph(matches)

  const snapshots = buildRoundSnapshots({ matches, graph, players, picks, leagues })
  if (snapshots.length === 0) {
    console.log('No complete rounds yet — nothing to snapshot.')
    return
  }

  // Idempotent upsert on the unique `round` column. completed_at is omitted so
  // existing rows keep their original completion time on update.
  const res = await fetch(`${url}/rest/v1/round_snapshots?on_conflict=round`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(snapshots),
  })
  if (!res.ok) throw new Error(`upsert: ${res.status} ${await res.text()}`)

  for (const s of snapshots) {
    const c = s.standings
    console.log(
      `✔ ${s.round}: schwarzies=${c.schwarzies.length} bens=${c.bens.length} combined=${c.combined.length}`
    )
  }
  console.log(`Upserted ${snapshots.length} round snapshot(s).`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
