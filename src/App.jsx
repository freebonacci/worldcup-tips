import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trophy, BarChart3, Home, AlertTriangle } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase.js'
import { buildGraph, r32Resolved } from './lib/bracket.js'
import { scorePlayer, picksToMap } from './lib/scoring.js'
import { Spinner, Button } from './components/ui.jsx'
import EntryScreen from './components/EntryScreen.jsx'
import BracketFlow from './components/BracketFlow.jsx'
import ReviewConfirm from './components/ReviewConfirm.jsx'
import Standings from './components/Standings.jsx'
import PlayerBracket from './components/PlayerBracket.jsx'

export default function App() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)

  const [matches, setMatches] = useState([])
  const [leagues, setLeagues] = useState([])
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])

  // view: entry | flow | review | standings | player
  const [view, setView] = useState('entry')

  // bracket-flow draft state (lives only in React — refresh loses it)
  const [draftPicks, setDraftPicks] = useState({})
  const [stepIndex, setStepIndex] = useState(0)
  const [pending, setPending] = useState(null) // { name, leagueId }

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const [viewing, setViewing] = useState(null) // { player, fresh }

  // ---- data loading ------------------------------------------------------
  const loadAll = useCallback(async () => {
    const [m, l, p, pk] = await Promise.all([
      supabase.from('matches').select('*'),
      supabase.from('leagues').select('*').order('id'),
      supabase.from('players').select('*'),
      supabase.from('picks').select('*'),
    ])
    const firstErr = m.error || l.error || p.error || pk.error
    if (firstErr) throw firstErr
    setMatches(m.data || [])
    setLeagues(l.data || [])
    setPlayers(p.data || [])
    setPicks(pk.data || [])
  }, [])

  const reloadPlayers = useCallback(async () => {
    const [p, pk] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('picks').select('*'),
    ])
    if (!p.error) setPlayers(p.data || [])
    if (!pk.error) setPicks(pk.data || [])
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      setStatus('error')
      setLoadError('NO_CONFIG')
      return
    }
    loadAll()
      .then(() => setStatus('ready'))
      .catch((e) => {
        setStatus('error')
        setLoadError(e.message || 'Failed to load data from Supabase.')
      })
  }, [loadAll])

  // ---- derived -----------------------------------------------------------
  const graph = useMemo(() => buildGraph(matches), [matches])
  const r32Ready = useMemo(() => r32Resolved(matches), [matches])

  const lockoutTime = useMemo(() => {
    const m90 = matches.find((m) => m.match_id === 'M90')
    return m90?.kickoff_time || null
  }, [matches])
  const isLocked = useMemo(() => {
    if (!lockoutTime) return false
    return Date.now() >= new Date(lockoutTime).getTime()
  }, [lockoutTime])

  // Display order for the league picker / standings tabs: Schwarzies first
  // (and therefore the pre-selected default), then the rest by id. Matching on
  // the name keeps this correct regardless of the DB's insertion ids.
  const orderedLeagues = useMemo(() => {
    const rank = (l) => (/schwarz/i.test(l.name) ? 0 : 1)
    return [...leagues].sort((a, b) => rank(a) - rank(b) || a.id - b.id)
  }, [leagues])

  const picksByPlayer = useMemo(() => {
    const map = {}
    for (const row of picks) {
      ;(map[row.player_id] ||= []).push(row)
    }
    return map
  }, [picks])

  const leagueName = (id) => leagues.find((l) => l.id === id)?.name || ''

  // ---- navigation helpers ------------------------------------------------
  const goHome = () => {
    if (
      (view === 'flow' || view === 'review') &&
      Object.keys(draftPicks).length > 0
    ) {
      if (
        !window.confirm(
          'Leave the bracket builder? Your picks are not saved yet and will be lost.'
        )
      )
        return
    }
    setDraftPicks({})
    setStepIndex(0)
    setPending(null)
    setSubmitError(null)
    setView('entry')
  }

  const startFlow = (name, leagueId) => {
    setPending({ name, leagueId })
    setDraftPicks({})
    setStepIndex(0)
    setSubmitError(null)
    setView('flow')
  }

  const openPlayer = (player, fresh = false) => {
    setViewing({ player, fresh })
    setView('player')
  }

  // ---- submission --------------------------------------------------------
  const handleConfirm = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isLocked) throw new Error('Submissions are closed — the deadline passed.')
      if (Object.keys(draftPicks).length !== 32)
        throw new Error('Your bracket is incomplete (need all 32 picks).')

      const dup = players.find(
        (p) => p.name.trim().toLowerCase() === pending.name.trim().toLowerCase()
      )
      if (dup)
        throw new Error(
          "That name's already taken — try adding a surname or initial."
        )

      const p_picks = Object.entries(draftPicks).map(
        ([match_id, predicted_team]) => ({ match_id, predicted_team })
      )

      const { data, error } = await supabase.rpc('submit_bracket', {
        p_name: pending.name,
        p_league_id: pending.leagueId,
        p_picks,
      })
      if (error) throw error

      const newPlayer = Array.isArray(data) ? data[0] : data
      await reloadPlayers()
      setDraftPicks({})
      setStepIndex(0)
      setPending(null)
      openPlayer(newPlayer, true)
    } catch (e) {
      setSubmitError(
        e.message || 'Something went wrong saving your bracket. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ---- render gates ------------------------------------------------------
  if (status === 'loading') {
    return (
      <Shell onHome={goHome} onStandings={null}>
        <Spinner label="Loading the tournament…" />
      </Shell>
    )
  }

  if (status === 'error') {
    return (
      <Shell onHome={null} onStandings={null}>
        <ConfigError reason={loadError} />
      </Shell>
    )
  }

  // viewing-player score (computed against that player's picks)
  let viewScore = null
  let viewPicksMap = null
  if (view === 'player' && viewing) {
    viewPicksMap = picksToMap(picksByPlayer[viewing.player.id] || [])
    viewScore = scorePlayer({
      matches,
      graph,
      picksByMatch: viewPicksMap,
      submittedAt: viewing.player.submitted_at,
    })
  }

  return (
    <Shell
      onHome={goHome}
      onStandings={() => {
        if (
          (view === 'flow' || view === 'review') &&
          Object.keys(draftPicks).length > 0
        ) {
          if (
            !window.confirm(
              'Leave the bracket builder? Your unsaved picks will be lost.'
            )
          )
            return
        }
        setView('standings')
      }}
      activeView={view}
    >
      {view === 'entry' && (
        <EntryScreen
          leagues={orderedLeagues}
          players={players}
          isLocked={isLocked}
          r32Ready={r32Ready}
          lockoutTime={lockoutTime}
          onStartFlow={startFlow}
          onStandings={() => setView('standings')}
        />
      )}

      {view === 'flow' && pending && (
        <BracketFlow
          matches={matches}
          graph={graph}
          draftPicks={draftPicks}
          setDraftPicks={setDraftPicks}
          playerName={pending.name}
          stepIndex={stepIndex}
          setStepIndex={setStepIndex}
          onReview={() => setView('review')}
          onCancel={goHome}
        />
      )}

      {view === 'review' && pending && (
        <ReviewConfirm
          matches={matches}
          graph={graph}
          draftPicks={draftPicks}
          playerName={pending.name}
          leagueName={leagueName(pending.leagueId)}
          onConfirm={handleConfirm}
          onBack={() => setView('flow')}
          submitting={submitting}
          error={submitError}
        />
      )}

      {view === 'standings' && (
        <Standings
          matches={matches}
          graph={graph}
          leagues={orderedLeagues}
          players={players}
          picksByPlayer={picksByPlayer}
          onViewPlayer={(p) => openPlayer(p, false)}
        />
      )}

      {view === 'player' && viewing && (
        <PlayerBracket
          player={viewing.player}
          leagueName={leagueName(viewing.player.league_id)}
          matches={matches}
          graph={graph}
          picksByMatch={viewPicksMap}
          score={viewScore}
          isOwnFreshSubmit={viewing.fresh}
          onBack={() => setView('standings')}
        />
      )}
    </Shell>
  )
}

// ---- shared chrome -------------------------------------------------------
function Shell({ children, onHome, onStandings, activeView }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button
            onClick={onHome || undefined}
            disabled={!onHome}
            className="flex items-center gap-2 disabled:opacity-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-flame-400 to-flame-600">
              <Trophy className="h-4 w-4 text-night-950" />
            </span>
            <span className="text-sm font-black tracking-tight text-white">
              WC26 Tips
            </span>
          </button>
          <nav className="flex items-center gap-1">
            {onHome && (
              <button
                onClick={onHome}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  activeView === 'entry'
                    ? 'bg-white/10 text-white'
                    : 'text-night-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Home className="mr-1 inline h-4 w-4" />
                Home
              </button>
            )}
            {onStandings && (
              <button
                onClick={onStandings}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  activeView === 'standings'
                    ? 'bg-white/10 text-white'
                    : 'text-night-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <BarChart3 className="mr-1 inline h-4 w-4" />
                Standings
              </button>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

function ConfigError({ reason }) {
  const noConfig = reason === 'NO_CONFIG'
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
        <div className="mb-2 flex items-center gap-2 text-red-200">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-lg font-bold">
            {noConfig ? 'Supabase not configured' : 'Could not load data'}
          </h2>
        </div>
        {noConfig ? (
          <div className="space-y-2 text-sm text-red-100/90">
            <p>
              Add your Supabase anon key to <code>.env</code> and restart{' '}
              <code>npm run dev</code>:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-night-950/70 p-3 text-xs text-night-100">
{`VITE_SUPABASE_URL=https://ycfnpvwintoadppxyfdo.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-red-100/90">
            <p>{reason}</p>
            <p className="text-red-100/70">
              Have you run <code>supabase_setup.sql</code> in the Supabase SQL
              editor? The app needs the <code>leagues</code>, <code>players</code>{' '}
              and <code>picks</code> tables plus read policies.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
