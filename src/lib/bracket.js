// ---------------------------------------------------------------------------
// Bracket topology helpers.
//
// We never hardcode the bracket shape. Instead we read the 32 `matches` rows
// (with their slot codes) at runtime and derive the feeder graph from the
// codes, so the app stays correct even if the seed changes.
//
// Slot code key:
//   1X     -> Winner of Group X
//   2X     -> Runner-up of Group X
//   3XXXX  -> a third-placed team from one of those groups
//   W##    -> Winner of match ##   (e.g. 'W74')
//   L##    -> Loser of match ##    (e.g. 'L101')
// ---------------------------------------------------------------------------

export const ROUND_LABELS = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  '3P': 'Third-place play-off',
  F: 'Final',
}

export const ROUND_SHORT = {
  R32: 'R32',
  R16: 'R16',
  QF: 'QF',
  SF: 'SF',
  '3P': '3rd',
  F: 'Final',
}

// Dependency order: a match can only be resolved once everything that feeds it
// is resolved. 3P and Final both depend only on the semi-finals.
export const ROUND_RANK = { R32: 0, R16: 1, QF: 2, SF: 3, '3P': 4, F: 5 }

// Parse a slot code into a structured descriptor.
export function parseSlot(code) {
  if (!code) return { kind: 'unknown', code }
  const w = /^W(\d+)$/.exec(code)
  if (w) return { kind: 'winner', ref: `M${w[1]}` }
  const l = /^L(\d+)$/.exec(code)
  if (l) return { kind: 'loser', ref: `M${l[1]}` }
  if (/^1[A-Z]$/.test(code)) return { kind: 'group', code }
  if (/^2[A-Z]$/.test(code)) return { kind: 'group', code }
  if (/^3/.test(code)) return { kind: 'group', code }
  return { kind: 'unknown', code }
}

// Build the feeder graph from the raw match rows.
//   byId          : { matchId -> match }
//   slots         : { matchId -> { a: parsed, b: parsed } }
//   winnerNext    : { matchId -> { match, slot } }  where this match's WINNER goes
//   loserNext     : { matchId -> { match, slot } }  where this match's LOSER goes
export function buildGraph(matches) {
  const byId = {}
  const slots = {}
  const winnerNext = {}
  const loserNext = {}

  for (const m of matches) byId[m.match_id] = m

  for (const m of matches) {
    const a = parseSlot(m.slot_a)
    const b = parseSlot(m.slot_b)
    slots[m.match_id] = { a, b }
    for (const [slotKey, parsed] of [
      ['a', a],
      ['b', b],
    ]) {
      if (parsed.kind === 'winner' && parsed.ref) {
        winnerNext[parsed.ref] = { match: m.match_id, slot: slotKey }
      } else if (parsed.kind === 'loser' && parsed.ref) {
        loserNext[parsed.ref] = { match: m.match_id, slot: slotKey }
      }
    }
  }

  return { byId, slots, winnerNext, loserNext }
}

// Matches in a given round, sorted by id number (M73, M74, ...).
export function matchesInRound(matches, round) {
  return matches
    .filter((m) => m.round === round)
    .sort((a, b) => matchNum(a.match_id) - matchNum(b.match_id))
}

export function matchNum(matchId) {
  const n = /\d+/.exec(matchId || '')
  return n ? parseInt(n[0], 10) : 0
}

// Have all 16 R32 ties been resolved to real teams? Gate for the bracket flow.
export function r32Resolved(matches) {
  const r32 = matches.filter((m) => m.round === 'R32')
  if (r32.length === 0) return false
  return r32.every((m) => m.team_a && m.team_b)
}

// Given a player's winner picks so far (picksByMatch: matchId -> team), compute
// the two participants for EVERY match. R32 participants come from the real
// resolved teams; later rounds cascade from the player's own picks.
//
// Returns { matchId -> [teamA|null, teamB|null] }.
export function computeParticipants(matches, graph, picksByMatch) {
  const participants = {}
  const ordered = [...matches].sort(
    (a, b) => ROUND_RANK[a.round] - ROUND_RANK[b.round]
  )

  const resolveSlot = (parsed, realTeam, fallbackLabel) => {
    // For R32 group slots, use the real resolved team. Before resolution we
    // fall back to the human slot label ("Winner Group A") so the cascade is
    // still walkable (see REQUIRE_R32_RESOLVED in src/config.js).
    if (parsed.kind === 'group') return realTeam || fallbackLabel || null
    if (parsed.kind === 'winner') {
      return picksByMatch[parsed.ref] || null
    }
    if (parsed.kind === 'loser') {
      const pair = participants[parsed.ref]
      const winner = picksByMatch[parsed.ref]
      if (!pair || !winner) return null
      const loser = pair.find((t) => t && t !== winner)
      return loser || null
    }
    return null
  }

  for (const m of ordered) {
    const { a, b } = graph.slots[m.match_id]
    const teamA = resolveSlot(a, m.team_a, m.slot_a_label)
    const teamB = resolveSlot(b, m.team_b, m.slot_b_label)
    participants[m.match_id] = [teamA, teamB]
  }

  return participants
}

// Order of the bracket columns, left to right (3rd place is handled separately).
export const BRACKET_COLS = ['R32', 'R16', 'QF', 'SF', 'F']

// Compute a connected-bracket layout purely from the winner-feeder graph.
//
// Builds a binary tree rooted at the Final (each match's children are the two
// matches feeding its slots), orders R32 by leaf traversal so paired siblings
// are adjacent, and centres every match midway between its two feeders. Returns
// absolutely-positioned nodes + connector polylines for rendering.
//
// dims: { ROW, BOX_W, BOX_H, GAP }
export function buildBracketLayout(matches, graph, dims) {
  const { ROW, BOX_W, BOX_H, GAP } = dims
  const COL_W = BOX_W + GAP

  const finalMatch = matches.find((m) => m.round === 'F')
  if (!finalMatch) return null

  const build = (id) => {
    const s = graph.slots[id]
    const aRef = s?.a?.kind === 'winner' ? s.a.ref : null
    const bRef = s?.b?.kind === 'winner' ? s.b.ref : null
    const children = []
    if (aRef && graph.byId[aRef]) children.push(build(aRef))
    if (bRef && graph.byId[bRef]) children.push(build(bRef))
    return { id, children }
  }
  const root = build(finalMatch.match_id)

  // Ordered leaves (R32) — slot_a feeder first => sits on top.
  const leaves = []
  const collect = (n) =>
    n.children.length ? n.children.forEach(collect) : leaves.push(n.id)
  collect(root)
  const numLeaves = leaves.length || 1
  const leafIndex = {}
  leaves.forEach((id, i) => (leafIndex[id] = i))

  // Vertical centre: leaves by slot, internal nodes midway between children.
  const assign = (n) => {
    if (!n.children.length) {
      n.cy = leafIndex[n.id] * ROW + ROW / 2
      return n.cy
    }
    const cs = n.children.map(assign)
    n.cy = (Math.min(...cs) + Math.max(...cs)) / 2
    return n.cy
  }
  assign(root)

  const nodes = []
  const connectors = []
  const walk = (n) => {
    const m = graph.byId[n.id]
    const col = BRACKET_COLS.indexOf(m.round)
    nodes.push({ id: n.id, col, cy: n.cy })
    for (const c of n.children) {
      const cm = graph.byId[c.id]
      const childCol = BRACKET_COLS.indexOf(cm.round)
      connectors.push({
        childCol,
        childCy: c.cy,
        parentCol: col,
        parentCy: n.cy,
      })
      walk(c)
    }
  }
  walk(root)

  const maxCol = BRACKET_COLS.length - 1
  const width = (maxCol + 1) * COL_W - GAP + 8
  let height = numLeaves * ROW

  const thirdMatch = matches.find((m) => m.round === '3P')
  let third = null
  if (thirdMatch) {
    const finalNode = nodes.find((nn) => nn.id === finalMatch.match_id)
    const ty = (finalNode?.cy ?? height / 2) + BOX_H + 70
    third = { id: thirdMatch.match_id, col: maxCol, cy: ty }
    height = Math.max(height, ty + BOX_H / 2 + 12)
  }

  return { nodes, connectors, third, width, height, leafOrder: leaves, COL_W }
}

// --- Flags ----------------------------------------------------------------
// Best-effort country -> flag emoji. The exact strings come from whatever the
// admin types into matches.team_a/team_b, so we normalise generously and just
// omit the flag if we don't recognise the name.
const FLAGS = {
  argentina: '🇦🇷', australia: '🇦🇺', austria: '🇦🇹', belgium: '🇧🇪',
  brazil: '🇧🇷', cameroon: '🇨🇲', canada: '🇨🇦', chile: '🇨🇱',
  colombia: '🇨🇴', 'costa rica': '🇨🇷', croatia: '🇭🇷', denmark: '🇩🇰',
  ecuador: '🇪🇨', egypt: '🇪🇬', england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', france: '🇫🇷',
  germany: '🇩🇪', ghana: '🇬🇭', greece: '🇬🇷', iran: '🇮🇷',
  'ivory coast': '🇨🇮', "cote d'ivoire": '🇨🇮', italy: '🇮🇹', jamaica: '🇯🇲',
  japan: '🇯🇵', mexico: '🇲🇽', morocco: '🇲🇦', netherlands: '🇳🇱',
  'new zealand': '🇳🇿', nigeria: '🇳🇬', norway: '🇳🇴', panama: '🇵🇦',
  paraguay: '🇵🇾', peru: '🇵🇪', poland: '🇵🇱', portugal: '🇵🇹',
  qatar: '🇶🇦', 'saudi arabia': '🇸🇦', scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', senegal: '🇸🇳',
  serbia: '🇷🇸', 'south africa': '🇿🇦', 'south korea': '🇰🇷', 'korea republic': '🇰🇷',
  spain: '🇪🇸', sweden: '🇸🇪', switzerland: '🇨🇭', tunisia: '🇹🇳',
  turkey: '🇹🇷', türkiye: '🇹🇷', 'united states': '🇺🇸', usa: '🇺🇸',
  uruguay: '🇺🇾', wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', algeria: '🇩🇿', 'dr congo': '🇨🇩',
  honduras: '🇭🇳', 'el salvador': '🇸🇻', jordan: '🇯🇴', uzbekistan: '🇺🇿',
  'cape verde': '🇨🇻', 'cabo verde': '🇨🇻', 'czech republic': '🇨🇿', czechia: '🇨🇿',
  ukraine: '🇺🇦', romania: '🇷🇴', hungary: '🇭🇺', slovenia: '🇸🇮',
  slovakia: '🇸🇰', 'new caledonia': '🇳🇨', curacao: '🇨🇼', 'curaçao': '🇨🇼',
  haiti: '🇭🇹', 'bolivia': '🇧🇴', 'iraq': '🇮🇶', 'united arab emirates': '🇦🇪',
  bahrain: '🇧🇭', oman: '🇴🇲',
}

export function teamFlag(name) {
  if (!name) return ''
  return FLAGS[name.trim().toLowerCase()] || ''
}
