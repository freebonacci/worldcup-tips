import { useState } from 'react'
import { Trophy, ArrowRight, Lock, Eye } from 'lucide-react'
import { Button, Card } from './ui.jsx'

const fmtDeadline = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short',
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

export default function EntryScreen({
  leagues,
  players,
  isLocked,
  lockoutTime,
  onStartFlow,
  onStandings,
}) {
  const [name, setName] = useState('')
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? null)
  const [notice, setNotice] = useState(null)

  // Names are globally unique across all leagues (case-insensitive).
  const trimmedName = name.trim()
  const nameTaken =
    trimmedName.length > 0 &&
    players.some(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )

  const submit = (e) => {
    e.preventDefault()
    setNotice(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setNotice({ type: 'err', text: 'Please enter your name.' })
      return
    }
    if (!leagueId) {
      setNotice({ type: 'err', text: 'Please choose a league.' })
      return
    }

    if (nameTaken) {
      setNotice({
        type: 'err',
        text: "That name's already taken — try adding a surname or initial.",
      })
      return
    }

    if (isLocked) {
      setNotice({
        type: 'err',
        text: 'Submissions are closed — the knockouts have started. You can still browse standings and brackets.',
      })
      return
    }

    onStartFlow(trimmed, leagueId)
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-8">
      <div className="mb-8 text-center animate-rise">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-flame-400 to-flame-600 shadow-lg shadow-flame-600/30">
          <Trophy className="h-8 w-8 text-night-950" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          World Cup 2026
        </h1>
        <p className="mt-1 text-lg font-semibold text-pitch-300">
          Knockout Bracket Tips
        </p>
        <p className="mx-auto mt-3 max-w-xs text-sm text-night-300">
          Predict every knockout result from the Round of 32 to the Final.
          One bracket each — make it count.
        </p>
      </div>

      {isLocked && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-flame-500/30 bg-flame-500/10 p-3 text-sm text-flame-400">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Submissions are closed. The bracket locked at{' '}
            <strong>{fmtDeadline(lockoutTime)}</strong>. Browse standings &
            brackets below.
          </span>
        </div>
      )}

      <Card className="p-5 animate-rise">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-night-200">
              Your name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sam Carter"
              autoComplete="off"
              aria-invalid={nameTaken}
              className={`w-full rounded-xl border bg-night-950/60 px-4 py-3 text-base text-white placeholder:text-night-400 focus:outline-none focus:ring-2 ${
                nameTaken
                  ? 'border-red-500/50 focus:border-red-400 focus:ring-red-500/30'
                  : 'border-white/10 focus:border-pitch-400 focus:ring-pitch-500/30'
              }`}
            />
            {nameTaken && (
              <p className="mt-1.5 text-xs text-red-300">
                That name's already taken — try adding a surname or initial.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-night-200">
              League
            </label>
            <div className="grid grid-cols-1 gap-2">
              {leagues.map((lg) => (
                <button
                  key={lg.id}
                  type="button"
                  onClick={() => setLeagueId(lg.id)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                    leagueId === lg.id
                      ? 'border-pitch-400 bg-pitch-500/15 text-white ring-1 ring-pitch-400/40'
                      : 'border-white/10 bg-night-950/40 text-night-200 hover:bg-white/5'
                  }`}
                >
                  {lg.name}
                </button>
              ))}
            </div>
          </div>

          {notice && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              <span>{notice.text}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={nameTaken}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-night-400">
          Names are unique across both leagues. Once you submit, view your
          bracket any time from the <strong>Standings</strong> tab.
        </p>
      </Card>

      <div className="mt-5 text-center">
        <Button variant="ghost" onClick={onStandings} className="w-full">
          <Eye className="h-4 w-4" /> View standings &amp; everyone's brackets
        </Button>
      </div>

      {!isLocked && lockoutTime && (
        <p className="mt-6 text-center text-xs text-night-400">
          ⏰ Deadline: <strong>{fmtDeadline(lockoutTime)}</strong> (first R16
          kick-off). Nothing is saved until you confirm — and confirm is final.
        </p>
      )}
    </div>
  )
}
