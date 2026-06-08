-- Fix get_performance_advisors eval: original task told agent to call
-- index_advisor(null) which errors (requires a real query string).
-- Correct tool is supabase_get_advisors (Mgmt API /advisors/performance).
UPDATE evals.agent_evals
SET
  task             = 'Show me the current performance and security advisory lints for this Supabase project. I want WARN and ERROR level issues only.',
  expected_tool    = 'supabase_get_advisors',
  expected_contains = ARRAY['performance', 'lints'],
  tags             = ARRAY['observability', 'advisors', 'performance']
WHERE name = 'get_performance_advisors';
