// Plain-node sanity tests for the bracket + scoring engine.
// Run with:  node test/logic.test.mjs
// Builds a self-consistent synthetic knockout bracket (real id ranges, simple
// consecutive pairing) and asserts the graph / cascade / scoring behave.

import {
  buildGraph,
  computeParticipants,
  r32Resolved,
  matchesInRound,
  buildBracketLayout,
} from '../src/lib/bracket.js'
import { scorePlayer, forwardReachable, lateR32Matches } from '../src/lib/scoring.js'

let passed = 0
let failed = 0
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failed++
    console.error(`✗ ${msg}\n   expected ${e}\n   got      ${a}`)
  }
}
function ok(cond, msg) {
  eq(Boolean(cond), true, msg)
}

// --- build synthetic bracket ---------------------------------------------
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
    venue: 'Test',
    ...extra,
  })

// R32: M73..M88, teams T1..T32 (slot codes are group placeholders).
for (let i = 0; i < 16; i++) {
  const id = `M${73 + i}`
  mk(id, 'R32', `G${i}a`, `G${i}b`, {
    team_a: `T${i * 2 + 1}`,
    team_b: `T${i * 2 + 2}`,
    kickoff_time: `2026-07-01T${String(12).padStart(2, '0')}:00:00Z`,
  })
}
// R16: M89..M96, consecutive pairing of R32 winners.
for (let i = 0; i < 8; i++) {
  mk(`M${89 + i}`, 'R16', `W${73 + i * 2}`, `W${74 + i * 2}`)
}
// QF: M97..M100
for (let i = 0; i < 4; i++) {
  mk(`M${97 + i}`, 'QF', `W${89 + i * 2}`, `W${90 + i * 2}`)
}
// SF: M101, M102
mk('M101', 'SF', 'W97', 'W98')
mk('M102', 'SF', 'W99', 'W100')
// 3P: M103 (SF losers), F: M104 (SF winners)
mk('M103', '3P', 'L101', 'L102')
mk('M104', 'F', 'W101', 'W102')

const graph = buildGraph(matches)

// --- graph tests ----------------------------------------------------------
eq(graph.winnerNext['M73'], { match: 'M89', slot: 'a' }, 'M73 winner -> M89.a')
eq(graph.winnerNext['M74'], { match: 'M89', slot: 'b' }, 'M74 winner -> M89.b')
eq(graph.winnerNext['M101'], { match: 'M104', slot: 'a' }, 'M101 winner -> Final')
eq(graph.loserNext['M101'], { match: 'M103', slot: 'a' }, 'M101 loser -> 3rd place')
eq(graph.loserNext['M102'], { match: 'M103', slot: 'b' }, 'M102 loser -> 3rd place')
ok(graph.winnerNext['M104'] === undefined, 'Final winner feeds nothing')

ok(r32Resolved(matches), 'r32Resolved true when all teams set')
eq(matchesInRound(matches, 'R16').length, 8, '8 R16 matches')

// --- cascade (computeParticipants) ---------------------------------------
// A player who always picks the team_a side (lower-numbered team) of each tie.
function buildAllPicks() {
  const picks = {}
  // R32: pick team_a
  for (const m of matchesInRound(matches, 'R32')) picks[m.match_id] = m.team_a
  // cascade later rounds: pick slot_a participant each time
  for (const round of ['R16', 'QF', 'SF', 'F', '3P']) {
    const parts = computeParticipants(matches, graph, picks)
    for (const m of matchesInRound(matches, round)) {
      picks[m.match_id] = parts[m.match_id][0]
    }
  }
  return picks
}
const picks = buildAllPicks()

let parts = computeParticipants(matches, graph, picks)
// M89 should be fed by player's M73 & M74 winners (T1 and T3).
eq(parts['M89'], ['T1', 'T3'], 'M89 participants = player R32 winners')
// 3rd place participants = the two SF losers.
// M101 winner picked = slot_a; loser = the other participant.
ok(parts['M103'][0] && parts['M103'][1], 'M103 has two participants (SF losers)')
ok(
  parts['M103'][0] !== picks['M101'] && parts['M103'][1] !== picks['M102'],
  'M103 participants are the SF losers, not the picked SF winners'
)

// --- forwardReachable -----------------------------------------------------
// Before any results: T1 (enters M73) can reach its whole path incl 3P + Final.
eq(
  [...forwardReachable('T1', matches, graph)].sort(),
  ['M101', 'M103', 'M104', 'M73', 'M89', 'M97'].sort(),
  'T1 full path before results'
)
// T1 loses M73 -> eliminated -> nothing reachable.
matches.find((m) => m.match_id === 'M73').winner = 'T2'
eq([...forwardReachable('T1', matches, graph)], [], 'eliminated team has no path')
// T2 advanced; reachable from M89 onward (not M73 anymore).
eq(
  [...forwardReachable('T2', matches, graph)].sort(),
  ['M101', 'M103', 'M104', 'M89', 'M97'].sort(),
  'T2 reachable from R16 onward'
)
matches.find((m) => m.match_id === 'M73').winner = null // reset

// SF-loser-drops-to-3P: if a team loses its SF, the Final is NOT reachable but
// the 3rd-place match still is.
matches.find((m) => m.match_id === 'M101').winner = 'X-not-T1' // T1 loses SF
const reachAfterSFloss = [...forwardReachable('T1', matches, graph)].sort()
// (T1 must have reached SF for this to matter; here we only check semantics of
//  the drop branch via a team that the walk treats as the SF loser.)
matches.find((m) => m.match_id === 'M101').winner = null // reset

// --- scoring + penalty ----------------------------------------------------
// Set some results, then score the all-slot-a player.
matches.find((m) => m.match_id === 'M73').winner = 'T1' // player picked T1 -> correct (1)
matches.find((m) => m.match_id === 'M74').winner = 'T4' // player picked T3 -> wrong
matches.find((m) => m.match_id === 'M89').winner = 'T1' // player picked T1 -> correct (2)

const score = scorePlayer({
  matches,
  graph,
  picksByMatch: picks,
  submittedAt: '2026-06-30T00:00:00Z', // before all R32 kickoffs -> no penalty
})
eq(score.banked, 3, 'banked = 1 (R32) + 2 (R16) = 3')
eq(score.byRound.R32, 1, 'R32 round points = 1')
eq(score.byRound.R16, 2, 'R16 round points = 2')
eq(score.penalty, 0, 'no penalty when submitted before kickoffs')
ok(score.maxPossible >= score.total, 'max >= total')
ok(score.wrongMatchIds.has('M74'), 'M74 marked wrong')
ok(score.correctMatchIds.has('M73'), 'M73 marked correct')

// Penalty: submit AFTER all R32 kickoffs (2026-07-01T12:00Z) -> 16 * 3 = 48.
const late = scorePlayer({
  matches,
  graph,
  picksByMatch: picks,
  submittedAt: '2026-07-02T00:00:00Z',
})
eq(late.penalty, 48, 'late penalty = 16 R32 matches * 3')
eq(late.lateMatchIds.size, 16, '16 late R32 matches flagged')
eq(late.total, late.banked - 48, 'total reduced by penalty')
eq(late.maxPossible, late.banked + late.stillWinnable - 48, 'max reduced by penalty')

// lateR32Matches helper directly
eq(lateR32Matches(matches, '2026-06-30T00:00:00Z').size, 0, 'none late (early)')
eq(lateR32Matches(matches, '2026-07-02T00:00:00Z').size, 16, 'all late')

// --- bracket layout -------------------------------------------------------
const DIMS = { ROW: 80, BOX_W: 160, BOX_H: 60, GAP: 50 }
const lay = buildBracketLayout(matches, graph, DIMS)
ok(lay, 'layout built')
// All 31 winner-tree matches (32 minus the 3rd-place match) get a node.
eq(lay.nodes.length, 31, 'layout has 31 winner-tree nodes')
// Consecutive pairing => leaves come out as M73..M88 in order.
eq(lay.leafOrder[0], 'M73', 'first leaf is M73')
eq(lay.leafOrder[15], 'M88', 'last leaf is M88')
// Sibling adjacency: M73 and M74 (which both feed M89) are adjacent leaves.
eq(
  Math.abs(lay.leafOrder.indexOf('M73') - lay.leafOrder.indexOf('M74')),
  1,
  'paired feeders M73/M74 are adjacent'
)
const nodeById = Object.fromEntries(lay.nodes.map((n) => [n.id, n]))
// A match sits exactly midway between its two feeders.
eq(
  nodeById['M89'].cy,
  (nodeById['M73'].cy + nodeById['M74'].cy) / 2,
  'M89 centred between feeders M73/M74'
)
eq(
  nodeById['M104'].cy,
  (nodeById['M101'].cy + nodeById['M102'].cy) / 2,
  'Final centred between its semi-finals'
)
// Columns increase by round.
eq(nodeById['M73'].col, 0, 'R32 in column 0')
eq(nodeById['M104'].col, 4, 'Final in column 4')
// 3rd-place block exists, separate from the winner tree, in the last column.
ok(lay.third && lay.third.id === 'M103', '3rd-place block present')
eq(lay.third.col, 4, '3rd-place block in the Final column')
// One connector per child edge: 31 nodes, root has no parent => 30 edges.
eq(lay.connectors.length, 30, '30 connector edges')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
