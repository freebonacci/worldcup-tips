import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
} from 'react-router-dom'
import { Trophy, BarChart3, Home as HomeIcon, AlertTriangle } from 'lucide-react'
import { supabase, supabaseConfigured, fetchAll } from './lib/supabase.js'
import { buildGraph } from './lib/bracket.js'
import { scorePlayer, picksToMap } from './lib/scoring.js'
import { validTabs, COMBINED } from './lib/leagues.js'
import { Spinner, Button } from './components/ui.jsx'
import Home from './components/Home.jsx'
import Standings from './components/Standings.jsx'
import PlayerBracket from './components/PlayerBracket.jsx'

// React Router basename derived from Vite's base ('/worldcup-tips/' in prod,
// '/' in dev). Strip the trailing slash for the router.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)

  const [matches, setMatches] = useState([])
  const [leagues, setLeagues] = useState([])
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])

  // Set true by the bracket builder while there are unsaved picks, so header
  // navigation can warn before discarding them.
  const dirtyRef = useRef(false)

  // ---- data loading ------------------------------------------------------
  const loadAll = useCallback(async () => {
    const [m, l, p, pk] = await Promise.all([
      fetchAll('matches'),
      supabase.from('leagues').select('*').order('id'),
      fetchAll('players'),
      fetchAll('picks'),
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
      fetchAll('players'),
      fetchAll('picks'),
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

  const lockoutTime = useMemo(() => {
    const m90 = matches.find((m) => m.match_id === 'M90')
    return m90?.kickoff_time || null
  }, [matches])
  const isLocked = useMemo(() => {
    if (!lockoutTime) return false
    return Date.now() >= new Date(lockoutTime).getTime()
  }, [lockoutTime])

  // League picker / standings tab order: Schwarzies first (and default).
  const orderedLeagues = useMemo(() => {
    const rank = (l) => (/schwarz/i.test(l.name) ? 0 : 1)
    return [...leagues].sort((a, b) => rank(a) - rank(b) || a.id - b.id)
  }, [leagues])

  const picksByPlayer = useMemo(() => {
    const map = {}
    for (const row of picks) (map[row.player_id] ||= []).push(row)
    return map
  }, [picks])

  const leagueName = useCallback(
    (id) => leagues.find((l) => l.id === id)?.name || '',
    [leagues]
  )

  const confirmLeave = useCallback(
    () =>
      !dirtyRef.current ||
      window.confirm(
        'Leave the bracket builder? Your unsaved picks will be lost.'
      ),
    []
  )

  return (
    <BrowserRouter basename={BASENAME}>
      <Shell confirmLeave={confirmLeave}>
        {status === 'loading' && <Spinner label="Loading the tournament…" />}
        {status === 'error' && <ConfigError reason={loadError} />}
        {status === 'ready' && (
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  matches={matches}
                  graph={graph}
                  leagues={orderedLeagues}
                  players={players}
                  isLocked={isLocked}
                  lockoutTime={lockoutTime}
                  leagueName={leagueName}
                  reloadPlayers={reloadPlayers}
                  dirtyRef={dirtyRef}
                />
              }
            />
            <Route
              path="/standings/player/:id"
              element={
                <PlayerRoute
                  matches={matches}
                  graph={graph}
                  players={players}
                  picksByPlayer={picksByPlayer}
                  leagueName={leagueName}
                />
              }
            />
            <Route
              path="/standings"
              element={
                <StandingsRoute
                  matches={matches}
                  graph={graph}
                  leagues={orderedLeagues}
                  players={players}
                  picksByPlayer={picksByPlayer}
                />
              }
            />
            <Route
              path="/standings/:tab"
              element={
                <StandingsRoute
                  matches={matches}
                  graph={graph}
                  leagues={orderedLeagues}
                  players={players}
                  picksByPlayer={picksByPlayer}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Shell>
    </BrowserRouter>
  )
}

// ---- standings route wrapper (URL <-> tab) -------------------------------
function StandingsRoute({ matches, graph, leagues, players, picksByPlayer }) {
  const { tab } = useParams()
  const navigate = useNavigate()
  const known = validTabs(leagues)
  const activeTab = tab || COMBINED

  if (tab && !known.includes(tab)) {
    return <Navigate to="/standings" replace />
  }

  return (
    <Standings
      matches={matches}
      graph={graph}
      leagues={leagues}
      players={players}
      picksByPlayer={picksByPlayer}
      activeTab={activeTab}
      onSelectTab={(slug) =>
        navigate(slug === COMBINED ? '/standings' : `/standings/${slug}`)
      }
      onViewPlayer={(p) => navigate(`/standings/player/${p.id}`)}
    />
  )
}

// ---- player bracket route wrapper ----------------------------------------
function PlayerRoute({ matches, graph, players, picksByPlayer, leagueName }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const player = players.find((p) => p.id === id)
  if (!player) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-night-200">Bracket not found.</p>
        <div className="mt-4">
          <Button variant="ghost" onClick={() => navigate('/standings')}>
            Back to standings
          </Button>
        </div>
      </div>
    )
  }

  const picksByMatch = picksToMap(picksByPlayer[player.id] || [])
  const score = scorePlayer({
    matches,
    graph,
    picksByMatch,
    submittedAt: player.submitted_at,
  })

  return (
    <PlayerBracket
      player={player}
      leagueName={leagueName(player.league_id)}
      matches={matches}
      graph={graph}
      picksByMatch={picksByMatch}
      score={score}
      isOwnFreshSubmit={location.state?.fresh === true}
      onBack={() => navigate('/standings')}
    />
  )
}

// ---- shared chrome -------------------------------------------------------
function Shell({ children, confirmLeave }) {
  const navigate = useNavigate()
  const location = useLocation()

  const go = (path) => {
    if (confirmLeave()) navigate(path)
  }

  const onHome = location.pathname === '/'
  const onStandings = location.pathname.startsWith('/standings')

  const navBtn = (active) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      active
        ? 'bg-white/10 text-white'
        : 'text-night-300 hover:bg-white/5 hover:text-white'
    }`

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button
            onClick={() => go('/')}
            className="flex items-center gap-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-flame-400 to-flame-600">
              <Trophy className="h-4 w-4 text-night-950" />
            </span>
            <span className="text-sm font-black tracking-tight text-white">
              WC26 Tips
            </span>
          </button>
          <nav className="flex items-center gap-1">
            <button onClick={() => go('/')} className={navBtn(onHome)}>
              <HomeIcon className="mr-1 inline h-4 w-4" />
              Home
            </button>
            <button
              onClick={() => go('/standings')}
              className={navBtn(onStandings)}
            >
              <BarChart3 className="mr-1 inline h-4 w-4" />
              Standings
            </button>
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
