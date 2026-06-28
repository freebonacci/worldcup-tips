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
