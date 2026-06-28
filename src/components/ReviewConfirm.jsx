import { useState } from 'react'
import { ChevronLeft, Lock, AlertTriangle, Loader2 } from 'lucide-react'
import BracketTree from './BracketTree.jsx'
import { Button, Card } from './ui.jsx'

export default function ReviewConfirm({
  matches,
  graph,
  draftPicks,
  playerName,
  leagueName,
  onConfirm,
  onBack,
  submitting,
  error,
}) {
  const [ack, setAck] = useState(false)
  const pickCount = Object.keys(draftPicks).length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-40 pt-4">
      <button
        onClick={onBack}
        disabled={submitting}
        className="mb-3 inline-flex items-center gap-1 text-sm text-night-300 hover:text-white disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" /> Back to editing
      </button>

      <h2 className="text-2xl font-black text-white">Review your bracket</h2>
      <p className="mt-1 text-sm text-night-300">
        <span className="font-semibold text-white">{playerName}</span> ·{' '}
        {leagueName} · {pickCount}/32 picks. Have one last look — once you confirm
        it's locked forever.
      </p>

      <Card className="mt-4 p-3">
        <BracketTree
          matches={matches}
          graph={graph}
          picksByMatch={draftPicks}
          showResult={false}
        />
      </Card>

      <div className="safe-bottom fixed inset-x-0 bottom-0 border-t border-white/10 bg-night-950/90 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          {error && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <label className="mb-2 flex items-start gap-2 text-xs text-night-200">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-pitch-500"
            />
            <span>
              I understand this is my <strong>single, final</strong> submission
              and cannot be changed after I confirm.
            </span>
          </label>
          <div className="flex gap-3">
            <Button
              variant="subtle"
              onClick={onBack}
              disabled={submitting}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              variant="flame"
              onClick={onConfirm}
              disabled={!ack || submitting || pickCount !== 32}
              className="flex-[2]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Confirm &amp; lock in
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
