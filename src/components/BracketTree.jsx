import { useMemo } from 'react'
import { Check, X, Clock, Trophy } from 'lucide-react'
import {
  computeParticipants,
  buildBracketLayout,
  BRACKET_COLS,
  teamFlag,
} from '../lib/bracket.js'

// The signature bracket view, drawn as a proper connected bracket.
//
// Layout is derived entirely from the winner-feeder graph (slot codes):
//   - We build a binary tree rooted at the Final; each match's two children are
//     the matches feeding its slot_a / slot_b.
//   - An ordered leaf traversal gives the R32 vertical order, so the two matches
//     whose winners meet are always adjacent (siblings paired).
//   - Each match is centred midway between its two feeder boxes; the vertical
//     gap roughly doubles each round.
//   - SVG connectors join each pair of feeders into the match they feed.
// The third-place match (M103) is a separate small block near the Final.
//
// Used in the review step (no results) and to view anyone's bracket (results).

const COL_LABEL = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: 'Final' }

const ROW = 84 // vertical slot height per R32 leaf
const BOX_W = 170
const BOX_H = 64
const GAP = 56 // horizontal gap between a box and the next column
const COL_W = BOX_W + GAP
const DIMS = { ROW, BOX_W, BOX_H, GAP }

export default function BracketTree({
  matches,
  graph,
  picksByMatch,
  showResult = false,
  correctIds,
  wrongIds,
  lateIds,
}) {
  const participants = computeParticipants(matches, graph, picksByMatch)

  // ---- derive layout from the feeder graph --------------------------------
  const layout = useMemo(
    () => buildBracketLayout(matches, graph, DIMS),
    [matches, graph]
  )

  if (!layout) return null

  // ---- one match box ------------------------------------------------------
  const renderBox = (matchId, cy, col, isThird = false) => {
    const m = graph.byId[matchId]
    if (!m) return null
    const [a, b] = participants[matchId] || [null, null]
    const pick = picksByMatch[matchId]
    const decided = m.winner != null
    const isCorrect = correctIds?.has(matchId)
    const isWrong = wrongIds?.has(matchId)
    const isLate = lateIds?.has(matchId)

    const row = (team, label) => {
      const isPick = pick && team === pick
      const isActualWinner = decided && team && team === m.winner
      let cls =
        'flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[12px] leading-tight'
      if (isPick && showResult && decided) {
        cls += isCorrect
          ? ' bg-pitch-500/25 text-pitch-200 font-semibold ring-1 ring-pitch-400/50'
          : ' bg-red-500/20 text-red-200 font-semibold ring-1 ring-red-400/40'
      } else if (isPick) {
        cls += ' bg-night-600/50 text-white font-semibold ring-1 ring-night-400/50'
      } else {
        cls += ' text-night-300'
      }
      const flag = team ? teamFlag(team) : ''
      return (
        <div className={cls}>
          <span className="inline-flex min-w-0 items-center gap-1">
            {flag && <span className="leading-none">{flag}</span>}
            <span className="truncate">{team || label || 'TBD'}</span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {isActualWinner && (
              <Trophy className="h-3 w-3 text-flame-400" aria-label="winner" />
            )}
            {isPick && showResult && decided && isCorrect && (
              <Check className="h-3.5 w-3.5 text-pitch-300" />
            )}
            {isPick && showResult && decided && isWrong && (
              <X className="h-3.5 w-3.5 text-red-300" />
            )}
          </span>
        </div>
      )
    }

    return (
      <div
        key={matchId}
        className="absolute z-10 flex flex-col rounded-lg border border-white/10 bg-night-900/80 px-1 py-1 shadow-sm backdrop-blur-sm"
        style={{
          left: col * COL_W,
          top: cy - BOX_H / 2,
          width: BOX_W,
          height: BOX_H,
        }}
      >
        <div className="flex h-3.5 items-center justify-between px-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-night-400">
            {isThird ? '3rd place' : matchId}
          </span>
          {isLate && (
            <span
              className="inline-flex items-center text-flame-400"
              title="Submitted after this match kicked off"
            >
              <Clock className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-center gap-0.5">
          {row(a, m.slot_a_label)}
          {row(b, m.slot_b_label)}
        </div>
      </div>
    )
  }

  // ---- connector polylines ------------------------------------------------
  const connectorPaths = layout.connectors.map((c, i) => {
    const childRightX = c.childCol * COL_W + BOX_W
    const parentLeftX = c.parentCol * COL_W
    const midX = (childRightX + parentLeftX) / 2
    const pts = [
      [childRightX, c.childCy],
      [midX, c.childCy],
      [midX, c.parentCy],
      [parentLeftX, c.parentCy],
    ]
    return (
      <polyline
        key={i}
        points={pts.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="rgba(120,140,180,0.45)"
        strokeWidth="1.5"
      />
    )
  })

  return (
    <div className="tree-scroll overflow-x-auto pb-4">
      <div style={{ width: layout.width, minWidth: 'min-content' }}>
        {/* column headers */}
        <div className="relative mb-2 h-5" style={{ width: layout.width }}>
          {BRACKET_COLS.map((round, col) => (
            <div
              key={round}
              className="absolute text-center text-xs font-bold uppercase tracking-wider text-pitch-300"
              style={{ left: col * COL_W, width: BOX_W }}
            >
              {COL_LABEL[round]}
            </div>
          ))}
        </div>

        {/* bracket area */}
        <div
          className="relative"
          style={{ width: layout.width, height: layout.height }}
        >
          <svg
            className="absolute inset-0"
            width={layout.width}
            height={layout.height}
          >
            {connectorPaths}
          </svg>

          {layout.nodes.map((n) => renderBox(n.id, n.cy, n.col))}

          {layout.third &&
            renderBox(layout.third.id, layout.third.cy, layout.third.col, true)}
        </div>
      </div>
    </div>
  )
}
