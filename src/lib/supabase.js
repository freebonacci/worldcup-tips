import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Surfaced in the UI so a missing/placeholder key fails loudly, not silently.
export const supabaseConfigured =
  Boolean(url) &&
  Boolean(anonKey) &&
  anonKey !== 'paste-your-anon-key-here'

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

// Supabase/PostgREST caps every response at a default row limit (1,000). A table
// that grows past that (e.g. picks: 46 players × 32 rows and counting) is
// silently truncated, which breaks cascade resolution for later brackets. This
// pages through the whole table with .range() until a short page comes back, so
// it stays correct no matter how large the table gets.
//
// `build(query)` lets callers tack on .order()/.eq() etc. before pagination.
export async function fetchAll(table, build) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select('*')
    if (build) query = build(query)
    const { data, error } = await query.range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return { data: rows, error: null }
}
