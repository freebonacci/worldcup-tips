// Map leagues to/from the URL slugs used in shareable standings routes.
//   Schwarzies            -> 'schwarzies'  (/standings/schwarzies)
//   Ben's Footy Tipping   -> 'ben'         (/standings/ben)
// The "combined" view (everyone together) uses the bare /standings route.

export const COMBINED = 'combined'

export function leagueSlug(name) {
  if (/schwarz/i.test(name)) return 'schwarzies'
  if (/ben/i.test(name)) return 'ben'
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// All valid tab slugs for the given leagues, plus 'combined'.
export function validTabs(leagues) {
  return [COMBINED, ...leagues.map((l) => leagueSlug(l.name))]
}

// Resolve a slug back to a league object (or null for combined / unknown).
export function leagueForSlug(slug, leagues) {
  if (!slug || slug === COMBINED) return null
  return leagues.find((l) => leagueSlug(l.name) === slug) || null
}
