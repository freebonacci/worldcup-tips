import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import EntryScreen from './EntryScreen.jsx'
import BracketFlow from './BracketFlow.jsx'
import ReviewConfirm from './ReviewConfirm.jsx'

// The pre-submission experience: entry → guided cascade → review → confirm.
// Kept as in-memory state on the "/" route (nothing is saved until Confirm).
// On a successful submit we navigate to the player's shareable bracket route.
export default function Home({
  matches,
  graph,
  leagues,
  players,
  isLocked,
  lockoutTime,
  leagueName,
  reloadPlayers,
  dirtyRef,
}) {
  const navigate = useNavigate()

  const [phase, setPhase] = useState('entry') // entry | flow | review
  const [draftPicks, setDraftPicks] = useState({})
  const [stepIndex, setStepIndex] = useState(0)
  const [pending, setPending] = useState(null) // { name, leagueId }
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Flag unsaved progress so the header can warn before navigating away.
  const hasDraft =
    (phase === 'flow' || phase === 'review') &&
    Object.keys(draftPicks).length > 0
  useEffect(() => {
    dirtyRef.current = hasDraft
    return () => {
      dirtyRef.current = false
    }
  }, [hasDraft, dirtyRef])

  const startFlow = (name, leagueId) => {
    setPending({ name, leagueId })
    setDraftPicks({})
    setStepIndex(0)
    setSubmitError(null)
    setPhase('flow')
  }

  const exitToEntry = () => {
    setDraftPicks({})
    setStepIndex(0)
    setPending(null)
    setSubmitError(null)
    setPhase('entry')
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isLocked)
        throw new Error('Submissions are closed — the deadline passed.')
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
      dirtyRef.current = false
      navigate(`/standings/player/${newPlayer.id}`, { state: { fresh: true } })
    } catch (e) {
      setSubmitError(
        e.message || 'Something went wrong saving your bracket. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'flow' && pending) {
    return (
      <BracketFlow
        matches={matches}
        graph={graph}
        draftPicks={draftPicks}
        setDraftPicks={setDraftPicks}
        playerName={pending.name}
        stepIndex={stepIndex}
        setStepIndex={setStepIndex}
        onReview={() => setPhase('review')}
        onCancel={exitToEntry}
      />
    )
  }

  if (phase === 'review' && pending) {
    return (
      <ReviewConfirm
        matches={matches}
        graph={graph}
        draftPicks={draftPicks}
        playerName={pending.name}
        leagueName={leagueName(pending.leagueId)}
        onConfirm={handleConfirm}
        onBack={() => setPhase('flow')}
        submitting={submitting}
        error={submitError}
      />
    )
  }

  return (
    <EntryScreen
      leagues={leagues}
      players={players}
      isLocked={isLocked}
      lockoutTime={lockoutTime}
      onStartFlow={startFlow}
      onStandings={() => navigate('/standings')}
    />
  )
}
