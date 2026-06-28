-- =============================================================================
-- ADMIN — resolve the Round of 32 (run when the group stage finishes).
--
-- Fill in the real team names for both slots of each R32 tie (M73–M88), then run
-- the whole file in the Supabase SQL editor. The bracket builder unlocks for
-- players ONLY once every one of these 16 ties has BOTH team_a and team_b set.
--
-- Use the exact same spelling everywhere (it must match matches.winner later and
-- the flags map in the app). Tip: check matches.slot_a_label / slot_b_label to
-- see which group slot each blank refers to before you fill it in.
-- =============================================================================

update matches set team_a = '', team_b = '' where match_id = 'M73';
update matches set team_a = '', team_b = '' where match_id = 'M74';
update matches set team_a = '', team_b = '' where match_id = 'M75';
update matches set team_a = '', team_b = '' where match_id = 'M76';
update matches set team_a = '', team_b = '' where match_id = 'M77';
update matches set team_a = '', team_b = '' where match_id = 'M78';
update matches set team_a = '', team_b = '' where match_id = 'M79';
update matches set team_a = '', team_b = '' where match_id = 'M80';
update matches set team_a = '', team_b = '' where match_id = 'M81';
update matches set team_a = '', team_b = '' where match_id = 'M82';
update matches set team_a = '', team_b = '' where match_id = 'M83';
update matches set team_a = '', team_b = '' where match_id = 'M84';
update matches set team_a = '', team_b = '' where match_id = 'M85';
update matches set team_a = '', team_b = '' where match_id = 'M86';
update matches set team_a = '', team_b = '' where match_id = 'M87';
update matches set team_a = '', team_b = '' where match_id = 'M88';

-- Sanity check — should return 16 rows, all with both teams filled:
-- select match_id, slot_a_label, team_a, slot_b_label, team_b
-- from matches where round = 'R32' order by match_id;
