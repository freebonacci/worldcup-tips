import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import {
  ROUND_LABELS,
  matchesInRound,
  computeParticipants,
  teamFlag,
} from '../lib/bracket.js'
import { Button } from './ui.jsx'

const STEPS = ['R32', 'R16', 'QF', 'SF', 'F', '3P']

// Remove any downstream picks that are no longer valid participants (e.g. the
// user went back and changed an earlier winner). Runs to a fixpoint.
function pruneInvalid(matches, graph, picks) {
  let next = { ...picks }
  for (let i = 0; i < STEPS.length; i++) {
    const participants = computeParticipants(matches, graph, next)
    let changed = false
    for (const m of matches) {
      const p = next[m.match_id]
      if (!p) continue
      const pair = participants[m.match_id] || []
      if (!pair.includes(p)) {
        delete next[m.match_id]
        changed = true
      }
    }
    if (!changed) break
  }
  return next
}

export default function BracketFlow({
  matches,
  graph,
  draftPicks,
  setDraftPicks,
  playerName,
  stepIndex,
  setStepIndex,
  onReview,
  onCancel,
}) {
  const round = STEPS[stepIndex]
  const roundMatches = useMemo(
    () => matchesInRound(matches, round),
    [matches, round]
  )
  const participants = useMemo(
    () => computeParticipants(matches, graph, draftPicks),
    [matches, graph, draftPicks]
  )

  const pickedInRound = roundMatches.filter(
    (m) => draftPicks[m.match_id]
  ).length
  const allPicked = pickedInRound === roundMatches.length

  const choose = (matchId, team) => {
    setDraftPicks((prev) => pruneInvalid(matches, graph, { ...prev, [matchId]: team }))
  }

  const next = () => {
    if (!allPicked) return
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1)
    else onReview()
  }
  const back = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
    else onCancel()
  }

  const isLast = stepIndex === STEPS.length - 1

  return (
    <div className="mx-auto max-w-md px-4 pb-40 pt-4">
      {/* progress */}
      <div className="mb-1 flex items-center justify-between text-xs text-night-300">
        <span className="font-semibold text-night-200">{playerName}'s bracket</span>
        <span>
          Step {stepIndex + 1} / {STEPS.length}
        </span>
      </div>
      <div className="mb-4 flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition ${
              i < stepIndex
                ? 'bg-pitch-500'
                : i === stepIndex
                  ? 'bg-pitch-400'
                  : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <div className="mb-4">
        <h2 className="text-2xl font-black text-white">{ROUND_LABELS[round]}</h2>
        <p className="text-sm text-night-300">
          {round === '3P'
            ? 'Your two semi-final losers play off for third — pick the winner.'
            : round === 'R32'
              ? 'Tap the team you think wins each tie.'
              : 'Built from your own picks. Tap each winner.'}{' '}
          <span className="font-semibold text-pitch-300">
            {pickedInRound}/{roundMatches.length} picked
          </span>
        </p>
      </div>

      <div className="space-y-3">
        {roundMatches.map((m) => {
          const [a, b] = participants[m.match_id] || [null, null]
          const pick = draftPicks[m.match_id]
          return (
            <div
              key={m.match_id}
              className="animate-pop-in rounded-2xl border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-night-400">
                  {m.match_id}
                </span>
                {m.venue && (
                  <span className="truncate text-[11px] text-night-400">
                    {m.venue}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  [a, m.slot_a_label],
                  [b, m.slot_b_label],
                ].map(([team, label], idx) => {
                  const selected = pick && team === pick
                  const disabled = !team
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={disabled}
                      onClick={() => choose(m.match_id, team)}
                      className={`relative flex min-h-[58px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40 ${
                        selected
                          ? 'border-pitch-400 bg-pitch-500/20 text-white ring-2 ring-pitch-400/50'
                          : 'border-white/10 bg-night-950/50 text-night-100 hover:bg-white/5'
                      }`}
                    >
                      {team && (
                        <span className="text-xl leading-none">
                          {teamFlag(team)}
                        </span>
                      )}
                      <span className="min-w-0 leading-tight">
                        {team || (
                          <span className="italic text-night-400">
                            {label || 'TBD'}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-pitch-400 text-night-950">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* sticky nav */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 border-t border-white/10 bg-night-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Button variant="subtle" onClick={back} className="flex-1">
            <ChevronLeft className="h-4 w-4" />
            {stepIndex === 0 ? 'Exit' : 'Back'}
          </Button>
          <Button
            variant={isLast ? 'flame' : 'primary'}
            onClick={next}
            disabled={!allPicked}
            className="flex-[2]"
          >
            {isLast ? 'Review bracket' : 'Next round'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
