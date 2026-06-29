// Plain-node tests for the round-snapshot engine.
// Run with:  node test/snapshots.test.mjs
//
// Builds a synthetic bracket plus players in both leagues (incl. a
// hidden_from_combined entry) and asserts:
//   - an incomplete round produces NO snapshot,
//   - completing R32 produces exactly one R32 snapshot with all three
//     standings (Combined = everyone from both leagues, minus hidden),
//   - changing one R32 winner still yields exactly one R32 snapshot, recomputed.

import { buildGraph, matchesInRound } from '../src/lib/bracket.js'
import {
  buildRoundSnapshots,
  isRoundComplete,
} from '../src/lib/snapshots.js'

let passed = 0
let failed = 0
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else {
    failed++
    console.error(`✗ ${msg}\n   expected ${e}\n   got      ${a}`)
  }
}
function ok(cond, msg) {
  eq(Boolean(cond), true, msg)
}

// --- synthetic bracket (same shape as logic.test.mjs) ---------------------
const PTS = { R32: 1, R16: 2, QF: 4, SF: 8, '3P': 8, F: 8 }
const matches = []
const mk = (id, round, slot_a, slot_b, extra = {}) =>
  matches.push({
    match_id: id,
    round,
    points: PTS[round],
    slot_a,
    slot_b,
    slot_a_label: slot_a,
    slot_b_label: slot_b,
    team_a: null,
    team_b: null,
    winner: null,
    kickoff_time: null,
    ...extra,
  })

for (let i = 0; i < 16; i++) {
  mk(`M${73 + i}`, 'R32', `G${i}a`, `G${i}b`, {
    team_a: `T${i * 2 + 1}`,
    team_b: `T${i * 2 + 2}`,
  })
}
for (let i = 0; i < 8; i++) mk(`M${89 + i}`, 'R16', `W${73 + i * 2}`, `W${74 + i * 2}`)
for (let i = 0; i < 4; i++) mk(`M${97 + i}`, 'QF', `W${89 + i * 2}`, `W${90 + i * 2}`)
mk('M101', 'SF', 'W97', 'W98')
mk('M102', 'SF', 'W99', 'W100')
mk('M103', '3P', 'L101', 'L102')
mk('M104', 'F', 'W101', 'W102')

const graph = buildGraph(matches)

// --- leagues + players ----------------------------------------------------
// Mirror live ids: Schwarzies = 2, Ben's Footy Tipping = 1.
const leagues = [
  { id: 2, name: 'Schwarzies' },
  { id: 1, name: "Ben's Footy Tipping" },
]

// Each player just picks the team_a (lower-numbered) side of every R32 tie, so
// scores differ once results land. One Schwarzies player is hidden_from_combined.
const players = [
  { id: 'p1', name: 'Sch One', league_id: 2, submitted_at: '2026-06-01T00:00:00Z', hidden_from_combined: false },
  { id: 'p2', name: 'Sch Two', league_id: 2, submitted_at: '2026-06-01T00:00:00Z', hidden_from_combined: false },
  { id: 'p3', name: 'Sch Hidden', league_id: 2, submitted_at: '2026-06-01T00:00:00Z', hidden_from_combined: true },
  { id: 'b1', name: 'Ben One', league_id: 1, submitted_at: '2026-06-01T00:00:00Z', hidden_from_combined: false },
  { id: 'b2', name: 'Ben Two', league_id: 1, submitted_at: '2026-06-01T00:00:00Z', hidden_from_combined: false },
]

const r32 = matchesInRound(matches, 'R32')
// p1/b1 pick every team_a; p2/b2 pick every team_b; p3 picks team_a.
const picks = []
for (const m of r32) {
  picks.push({ player_id: 'p1', match_id: m.match_id, predicted_team: m.team_a })
  picks.push({ player_id: 'p2', match_id: m.match_id, predicted_team: m.team_b })
  picks.push({ player_id: 'p3', match_id: m.match_id, predicted_team: m.team_a })
  picks.push({ player_id: 'b1', match_id: m.match_id, predicted_team: m.team_a })
  picks.push({ player_id: 'b2', match_id: m.match_id, predicted_team: m.team_b })
}

const build = () => buildRoundSnapshots({ matches, graph, players, picks, leagues })

// --- 1) incomplete round -> no snapshot -----------------------------------
matches.find((m) => m.match_id === 'M73').winner = 'T1'
ok(!isRoundComplete(matches, 'R32'), 'R32 incomplete with only M73 filled')
eq(build().length, 0, 'no snapshots while R32 incomplete')

// --- 2) complete R32 -> exactly one snapshot, three standings -------------
for (const m of r32) m.winner = m.team_a // every team_a wins
ok(isRoundComplete(matches, 'R32'), 'R32 complete once all M73–M88 filled')

let snaps = build()
eq(snaps.length, 1, 'exactly one snapshot (only R32 complete)')
eq(snaps[0].round, 'R32', 'snapshot is for R32')

const s = snaps[0].standings
ok(s.schwarzies && s.bens && s.combined, 'snapshot has all three standings')
// The Schwarzies league tab shows everyone in the league, incl. the hidden one.
eq(s.schwarzies.length, 3, 'Schwarzies league lists all 3 (incl hidden)')
eq(s.bens.length, 2, "Ben's league lists its 2 players")
// Combined = both leagues minus hidden_from_combined = 5 - 1 = 4.
eq(s.combined.length, 4, 'Combined lists every player from both leagues, minus hidden')
ok(
  !s.combined.some((r) => r.name === 'Sch Hidden'),
  'hidden_from_combined player excluded from Combined'
)
ok(
  s.combined.some((r) => r.league === 'Schwarzies') &&
    s.combined.some((r) => r.league === "Ben's Footy Tipping"),
  'Combined rows carry which league each person is from'
)
// Dense ranking 1..n within each standing.
eq(s.combined.map((r) => r.rank), [1, 2, 3, 4], 'Combined re-ranked densely 1..4')
eq(s.schwarzies.map((r) => r.rank), [1, 2, 3], 'Schwarzies ranked densely 1..3')
// Row shape carries total + max (possible scores) and the rest.
const row = s.combined[0]
ok(
  ['rank', 'name', 'league', 'total', 'max', 'banked', 'penalty'].every(
    (k) => k in row
  ),
  'each row has rank, name, league, total, max, banked, penalty'
)
// team_a swept R32 so the all-team_a pickers banked all 16; team_b pickers 0.
const p1row = s.combined.find((r) => r.name === 'Sch One')
const p2row = s.combined.find((r) => r.name === 'Sch Two')
eq(p1row.total, 16, 'all-team_a picker banked 16 R32 points')
eq(p2row.total, 0, 'all-team_b picker banked 0')
ok(p1row.rank < p2row.rank, 'higher total ranks ahead')

// --- 3) re-run with one winner changed -> still one snapshot, recomputed --
matches.find((m) => m.match_id === 'M73').winner = 'T2' // flip M73 to team_b
snaps = build()
eq(snaps.length, 1, 'still exactly one R32 snapshot after a correction')
const s2 = snaps[0].standings
const p1after = s2.combined.find((r) => r.name === 'Sch One')
const p2after = s2.combined.find((r) => r.name === 'Sch Two')
eq(p1after.total, 15, 'team_a picker now 15 (lost M73)')
eq(p2after.total, 1, 'team_b picker now 1 (won M73)')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
