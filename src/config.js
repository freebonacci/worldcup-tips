// App-level feature flags.

// Gate the bracket builder until all 16 R32 ties have real teams resolved.
//
// TEMPORARILY DISABLED for pre-launch testing: with this false, the cascade
// opens even before the group stage finishes, using the slot labels
// ("Winner Group A", "Runner-up Group B", …) as stand-in team names so the
// flow is fully walkable. Flip back to `true` before launch to require real
// R32 teams first.
export const REQUIRE_R32_RESOLVED = false
