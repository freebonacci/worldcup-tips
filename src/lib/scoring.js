// ---------------------------------------------------------------------------
// Scoring, lateness penalty, and max-possible — all client-side.
//
//   correct pick   = predicted_team === matches.winner  (path-independent)
//   points         = the match's `points` value (R32=1 R16=2 QF=4 SF/3P/F=8)
//   penalty        = 3 points for EACH R32 match that kicked off before the
//                    player's submitted_at (computed from timestamps alone)
//   max_possible   = banked + still_winnable − penalty
//
// still_winnable sums the points of each UNDECIDED match the player picked
// where their team can still actually win it: the team is not eliminated AND
// the match is still forward-reachable on that team's real bracket path.
// ---------------------------------------------------------------------------

import { ROUND_RANK, matchNum } from './bracket.js'

export const PENALTY_PER_LATE_MATCH = 3
export const ROUND_KEYS = ['R32', 'R16', 'QF', 'SF', 'F', '3P']

// R32 entry match for each real team (from resolved team_a/team_b).
function entryByTeam(matches) {
  const map = {}
  for (const m of matches) {
    if (m.round !== 'R32') continue
    if (m.team_a) map[m.team_a] = m.match_id
    if (m.team_b) map[m.team_b] = m.match_id
  }
  return map
}

// Walk a team's real path forward from its R32 entry following actual results.
// Returns the set of match ids the team can STILL reach (i.e. from its current
// live position onward), or an empty set if the team is already eliminated /
// finished. Correctly models the semi-final loser dropping into the 3rd-place
// play-off.
export function forwardReachable(team, matches, graph) {
  const result = new Set()
  if (!team) return result
  const entry = entryByTeam(matches)[team]
  if (!entry) return result

  const byId = graph.byId
  // 1) Find the team's current live position by replaying real results.
  let cur = entry
  while (cur) {
    const m = byId[cur]
    if (!m) return result
    if (m.winner == null) break // undecided -> team is alive here
    if (m.winner === team) {
      const nxt = graph.winnerNext[cur]
      if (!nxt) return result // won the final / 3rd place -> nothing further
      cur = nxt.match
    } else {
      // team lost this match
      const drop = graph.loserNext[cur]
      if (drop) {
        cur = drop.match // semi-final loser -> 3rd-place play-off
      } else {
        return result // eliminated
      }
    }
  }

  // 2) From the live position, collect every match still reachable forward.
  let node = cur
  while (node) {
    result.add(node)
    const drop = graph.loserNext[node] // SF -> 3P branch is also reachable
    if (drop) result.add(drop.match)
    const nxt = graph.winnerNext[node]
    node = nxt ? nxt.match : null
  }
  return result
}

// R32 matches that kicked off before the player submitted (=> late penalty).
export function lateR32Matches(matches, submittedAt) {
  const set = new Set()
  if (!submittedAt) return set
  const sub = new Date(submittedAt).getTime()
  for (const m of matches) {
    if (m.round !== 'R32') continue
    if (!m.kickoff_time) continue
    if (new Date(m.kickoff_time).getTime() < sub) set.add(m.match_id)
  }
  return set
}

// Full score breakdown for one player.
//   picksByMatch : { matchId -> predicted_team }
//   submittedAt  : ISO timestamp string
export function scorePlayer({ matches, graph, picksByMatch, submittedAt }) {
  const byRound = { R32: 0, R16: 0, QF: 0, SF: 0, F: 0, '3P': 0 }
  const correct = new Set()
  const wrong = new Set()
  let banked = 0
  let stillWinnable = 0

  for (const m of matches) {
    const pick = picksByMatch[m.match_id]
    if (!pick) continue
    const pts = m.points || 0

    if (m.winner != null) {
      // decided
      if (pick === m.winner) {
        banked += pts
        byRound[m.round] += pts
        correct.add(m.match_id)
      } else {
        wrong.add(m.match_id)
      }
    } else {
      // undecided -> still winnable if the picked team can still win it
      const reach = forwardReachable(pick, matches, graph)
      if (reach.has(m.match_id)) stillWinnable += pts
    }
  }

  const lateSet = lateR32Matches(matches, submittedAt)
  const penalty = lateSet.size * PENALTY_PER_LATE_MATCH

  const total = banked - penalty
  const maxPossible = banked + stillWinnable - penalty

  return {
    byRound,
    banked,
    stillWinnable,
    penalty,
    lateMatchIds: lateSet,
    total,
    maxPossible,
    correctMatchIds: correct,
    wrongMatchIds: wrong,
  }
}

// Convenience: turn an array of pick rows into a { matchId -> team } map.
export function picksToMap(pickRows) {
  const map = {}
  for (const p of pickRows) map[p.match_id] = p.predicted_team
  return map
}

// Sort comparator for standings: total desc, then max desc, then earliest sub.
export function standingsSort(a, b) {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total
  if (b.score.maxPossible !== a.score.maxPossible)
    return b.score.maxPossible - a.score.maxPossible
  return new Date(a.submitted_at) - new Date(b.submitted_at)
}

export { matchNum, ROUND_RANK }
