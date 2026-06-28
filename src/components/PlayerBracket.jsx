import { ChevronLeft, Clock, Lock } from 'lucide-react'
import BracketTree from './BracketTree.jsx'
import { Card } from './ui.jsx'

const fmt = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    })
  } catch {
    return iso
  }
}

function Stat({ label, value, tone }) {
  const tones = {
    total: 'text-pitch-300',
    max: 'text-flame-400',
    pen: 'text-red-300',
    plain: 'text-white',
  }
  return (
    <div className="flex flex-col items-center rounded-xl bg-white/[0.04] px-3 py-2">
      <span className={`text-2xl font-black ${tones[tone] || tones.plain}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-night-400">
        {label}
      </span>
    </div>
  )
}

export default function PlayerBracket({
  player,
  leagueName,
  matches,
  graph,
  picksByMatch,
  score,
  isOwnFreshSubmit = false,
  onBack,
}) {
  const lateCount = score?.lateMatchIds?.size || 0

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-4">
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm text-night-300 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      {isOwnFreshSubmit && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-pitch-400/30 bg-pitch-500/10 p-3 text-sm text-pitch-200">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            Locked in! Your bracket is saved and can't be changed. Good luck.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black text-white">{player.name}</h2>
          <p className="text-sm text-night-300">
            {leagueName} · submitted {fmt(player.submitted_at)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Stat label="Total" value={score.total} tone="total" />
        <Stat label="Max" value={score.maxPossible} tone="max" />
        <Stat label="Banked" value={score.banked} tone="plain" />
        <Stat
          label="Penalty"
          value={score.penalty ? `−${score.penalty}` : '0'}
          tone="pen"
        />
        <Stat label="Picks" value="32" tone="plain" />
      </div>

      {lateCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-flame-400">
          <Clock className="h-3.5 w-3.5" />
          Submitted after {lateCount} Round-of-32{' '}
          {lateCount === 1 ? 'match' : 'matches'} kicked off (−3 each). Those ties
          are flagged below.
        </p>
      )}

      <Card className="mt-4 p-3">
        <BracketTree
          matches={matches}
          graph={graph}
          picksByMatch={picksByMatch}
          showResult={true}
          correctIds={score.correctMatchIds}
          wrongIds={score.wrongMatchIds}
          deadIds={score.deadMatchIds}
          lateIds={score.lateMatchIds}
        />
      </Card>

      <div className="mt-3 flex flex-wrap gap-3 px-1 text-xs text-night-300">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-pitch-500/40 ring-1 ring-pitch-400/50" />
          Correct
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-red-500/30 ring-1 ring-red-400/40" />
          Wrong
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-night-600/60 ring-1 ring-night-400/50" />
          Pick (undecided)
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-flame-400" /> Late submission
        </span>
      </div>
    </div>
  )
}
