-- =============================================================================
-- ADMIN — record results as matches finish.
--
-- Set `winner` to the team that actually won each match. Scoring, penalties,
-- standings and "max possible" all recompute automatically in the app from
-- these winners + timestamps — nothing else to enter.
--
-- The winner string MUST exactly match the team name you used (same spelling as
-- team_a / team_b and the players' predicted_team). Run only the lines you need.
--
-- NOTE: with RLS enabled, the browser anon key CANNOT write these. Run this in
-- the Supabase SQL editor (it uses the privileged session), or later via a
-- service_role script. Do NOT expose the service_role key in the web app.
-- =============================================================================

-- Round of 32 (1 pt each)
update matches set winner = '' where match_id = 'M73';
update matches set winner = '' where match_id = 'M74';
update matches set winner = '' where match_id = 'M75';
update matches set winner = '' where match_id = 'M76';
update matches set winner = '' where match_id = 'M77';
update matches set winner = '' where match_id = 'M78';
update matches set winner = '' where match_id = 'M79';
update matches set winner = '' where match_id = 'M80';
update matches set winner = '' where match_id = 'M81';
update matches set winner = '' where match_id = 'M82';
update matches set winner = '' where match_id = 'M83';
update matches set winner = '' where match_id = 'M84';
update matches set winner = '' where match_id = 'M85';
update matches set winner = '' where match_id = 'M86';
update matches set winner = '' where match_id = 'M87';
update matches set winner = '' where match_id = 'M88';

-- Round of 16 (2 pts each)
update matches set winner = '' where match_id = 'M89';
update matches set winner = '' where match_id = 'M90';
update matches set winner = '' where match_id = 'M91';
update matches set winner = '' where match_id = 'M92';
update matches set winner = '' where match_id = 'M93';
update matches set winner = '' where match_id = 'M94';
update matches set winner = '' where match_id = 'M95';
update matches set winner = '' where match_id = 'M96';

-- Quarter-finals (4 pts each)
update matches set winner = '' where match_id = 'M97';
update matches set winner = '' where match_id = 'M98';
update matches set winner = '' where match_id = 'M99';
update matches set winner = '' where match_id = 'M100';

-- Semi-finals (8 pts each)
update matches set winner = '' where match_id = 'M101';
update matches set winner = '' where match_id = 'M102';

-- Third-place play-off (8 pts) and Final (8 pts)
update matches set winner = '' where match_id = 'M103';
update matches set winner = '' where match_id = 'M104';

-- Check standings inputs:
-- select match_id, round, points, team_a, team_b, winner
-- from matches order by match_id;
