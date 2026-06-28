import { useMemo } from 'react'
import { ChevronRight, Trophy } from 'lucide-react'
import { scorePlayer, picksToMap, standingsSort } from '../lib/scoring.js'
import { leagueSlug, leagueForSlug, COMBINED } from '../lib/leagues.js'

const ROUND_COLS = [
  { key: 'R32', label: 'R32' },
  { key: 'R16', label: 'R16' },
  { key: 'QF', label: 'QF' },
  { key: 'SF', label: 'SF' },
  { key: 'F', label: 'Fin' },
  { key: '3P', label: '3rd' },
]

const medal = (rank) =>
  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''

// Tabs are URL-driven: `activeTab` is a slug ('schwarzies' / 'ben') or 'combined'.
// Clicking a tab calls onSelectTab(slug) which the route wrapper turns into a
// navigation, so the URL always reflects the visible tab and vice-versa.
export default function Standings({
  matches,
  graph,
  leagues,
  players,
  picksByPlayer,
  activeTab = COMBINED,
  onSelectTab,
  onViewPlayer,
}) {
  // Score everyone once.
  const scored = useMemo(() => {
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
  }, [players, picksByPlayer, matches, graph])

  const activeLeague = leagueForSlug(activeTab, leagues)

  const rows = useMemo(() => {
    // Combined hides players flagged hidden_from_combined; the individual league
    // tabs always show everyone, flagged or not.
    const filtered = activeLeague
      ? scored.filter((p) => p.league_id === activeLeague.id)
      : scored.filter((p) => !p.hidden_from_combined)
    return [...filtered].sort(standingsSort)
  }, [scored, activeLeague])

  const tabs = [
    ...leagues.map((l) => ({ slug: leagueSlug(l.name), name: l.name })),
    { slug: COMBINED, name: 'Combined' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-3 pb-16 pt-4">
      <div className="mb-4 flex items-center gap-2 px-1">
        <Trophy className="h-6 w-6 text-flame-400" />
        <h2 className="text-2xl font-black text-white">Standings</h2>
      </div>

      {/* tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.slug}
            onClick={() => onSelectTab?.(t.slug)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === t.slug
                ? 'bg-pitch-500 text-night-950'
                : 'bg-white/5 text-night-200 hover:bg-white/10'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-night-300">
          No brackets submitted in this league yet.
        </div>
      ) : (
        <div className="tree-scroll overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-night-300">
                <th className="sticky left-0 z-10 bg-[#0d1426] px-2 py-3 text-left font-semibold">
                  #
                </th>
                <th className="sticky left-8 z-10 bg-[#0d1426] px-2 py-3 text-left font-semibold">
                  Player
                </th>
                {ROUND_COLS.map((c) => (
                  <th key={c.key} className="px-2 py-3 text-center font-semibold">
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-3 text-center font-semibold text-red-300">
                  Pen
                </th>
                <th className="px-3 py-3 text-center font-bold text-pitch-300">
                  Total
                </th>
                <th className="px-3 py-3 text-center font-bold text-flame-400">
                  Max
                </th>
                <th className="px-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const rank = i + 1
                return (
                  <tr
                    key={p.id}
                    onClick={() => onViewPlayer?.(p)}
                    className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="sticky left-0 z-10 bg-[#0d1426] px-2 py-3 text-night-300">
                      {medal(rank) || rank}
                    </td>
                    <td className="sticky left-8 z-10 max-w-[8rem] truncate bg-[#0d1426] px-2 py-3 font-semibold text-white">
                      {p.name}
                    </td>
                    {ROUND_COLS.map((c) => (
                      <td
                        key={c.key}
                        className="px-2 py-3 text-center text-night-200"
                      >
                        {p.score.byRound[c.key] || (
                          <span className="text-night-500">·</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-3 text-center text-red-300">
                      {p.score.penalty ? `−${p.score.penalty}` : '·'}
                    </td>
                    <td className="px-3 py-3 text-center text-lg font-black text-pitch-300">
                      {p.score.total}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-flame-400">
                      {p.score.maxPossible}
                    </td>
                    <td className="px-1 text-night-500">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 px-1 text-xs text-night-400">
        Tap any player to see their full bracket. <strong>Total</strong> = banked
        points − late penalty. <strong>Max</strong> = the most they can still
        reach. <strong>Penalty</strong> = −3 points per Round-of-32 match that had
        already kicked off before the player submitted their bracket. Recomputed
        live from results.
      </p>
    </div>
  )
}
