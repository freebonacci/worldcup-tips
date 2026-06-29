// ---------------------------------------------------------------------------
// Round snapshots — freeze the three standings at the moment a round completes.
//
// A round is complete once EVERY match in it has a real winner (non-null and
// non-empty — '' is the admin placeholder, not a result). When that happens we
// capture one snapshot per round holding three standings:
//
//   schwarzies — players in the Schwarzies league, ranked among themselves
//   bens       — players in Ben's Footy Tipping, ranked among themselves
//   combined   — EVERY player from both leagues ranked together in one pool
//                (Combined is NOT a league_id; it's the union of both sets,
//                 minus anyone flagged hidden_from_combined, mirroring the live
//                 Combined tab)
//
// All three reuse the existing scorePlayer engine and the live standingsSort
// tiebreak, so a snapshot is exactly what the standings screen would show.
// Rank is dense (1..n) within each standing; Combined re-ranks across the
// merged pool rather than stitching the per-league ranks together.
// ---------------------------------------------------------------------------

import { scorePlayer, picksToMap, standingsSort } from './scoring.js'

// Rounds in the order they complete. Keyed by the matches.round value.
//   R32 = M73–M88, R16 = M89–M96, QF = M97–M100, SF = M101–M102,
//   3P  = M103,    F   = M104.
export const SNAPSHOT_ROUNDS = ['R32', 'R16', 'QF', 'SF', '3P', 'F']

// A real, recorded result — guards against the '' placeholder in the admin SQL.
const hasWinner = (m) => m.winner != null && m.winner !== ''

// True once every match in `round` has a real winner.
export function isRoundComplete(matches, round) {
  const inRound = matches.filter((m) => m.round === round)
  if (inRound.length === 0) return false
  return inRound.every(hasWinner)
}

// Score every player once with the live engine.
function scoreAll({ matches, graph, players, picksByPlayer }) {
  return players.map((p) => {
    const picksByMatch = picksToMap(picksByPlayer[p.id] || [])
    const score = scorePlayer({
      matches,
      graph,
      picksByMatch,
      submittedAt: p.submitted_at,
    })
    return { ...p, score }
  })
}

// Turn a scored subset into the ordered, ranked rows a snapshot stores.
function rankRows(scoredSubset, leagueNameById) {
  return [...scoredSubset].sort(standingsSort).map((p, i) => ({
    rank: i + 1,
    name: p.name,
    league: leagueNameById[p.league_id] || null,
    total: p.score.total,
    max: p.score.maxPossible,
    banked: p.score.banked,
    penalty: p.score.penalty,
  }))
}

// Resolve the two real leagues by name (robust to whichever id they hold).
function resolveLeagues(leagues) {
  let schwarzies = null
  let bens = null
  for (const l of leagues) {
    if (/schwarz/i.test(l.name)) schwarzies = l.id
    else if (/ben/i.test(l.name)) bens = l.id
  }
  return { schwarzies, bens }
}

// Build the three standings for the current results. Pure — no DB, no clock.
export function buildStandings({ matches, graph, players, picksByPlayer, leagues }) {
  const scored = scoreAll({ matches, graph, players, picksByPlayer })
  const leagueNameById = Object.fromEntries(leagues.map((l) => [l.id, l.name]))
  const { schwarzies, bens } = resolveLeagues(leagues)

  return {
    schwarzies: rankRows(
      scored.filter((p) => p.league_id === schwarzies),
      leagueNameById
    ),
    bens: rankRows(
      scored.filter((p) => p.league_id === bens),
      leagueNameById
    ),
    // Combined: union of both leagues, excluding hidden_from_combined — exactly
    // what the live Combined tab shows.
    combined: rankRows(
      scored.filter((p) => !p.hidden_from_combined),
      leagueNameById
    ),
  }
}

// Group pick rows by player_id for scoring.
export function groupPicks(picks) {
  const map = {}
  for (const row of picks) (map[row.player_id] ||= []).push(row)
  return map
}

// Build the snapshot rows to upsert: one per COMPLETE round, each carrying all
// three standings. Incomplete rounds yield nothing. completed_at is left to the
// DB default so re-runs (corrected results) update standings in place without
// rewriting the original completion time.
export function buildRoundSnapshots({ matches, graph, players, picks, leagues }) {
  const picksByPlayer = groupPicks(picks)
  const rows = []
  for (const round of SNAPSHOT_ROUNDS) {
    if (!isRoundComplete(matches, round)) continue
    rows.push({
      round,
      standings: buildStandings({ matches, graph, players, picksByPlayer, leagues }),
    })
  }
  return rows
}
