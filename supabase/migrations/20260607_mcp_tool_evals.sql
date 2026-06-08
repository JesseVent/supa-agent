-- Eval cases for the expanded MCP tool suite (41 tools)
-- Covers: explain_query, project_mgmt, edge_functions, secrets, migration, schema DDL, types

insert into evals.agent_evals (name, task, expected_tool, expected_contains, tags) values

-- ── explain_query ─────────────────────────────────────────────────────────────

('explain_active_evals_query',
 'Run EXPLAIN ANALYZE on: SELECT * FROM evals.agent_evals WHERE active = true',
 'supabase_explain_query',
 array['Filter', 'actual time'],
 array['sql', 'explain', 'performance']),

('explain_join_query',
 'Explain the execution plan for this query and identify whether an index is used: SELECT r.*, e.name FROM evals.agent_eval_runs r JOIN evals.agent_evals e ON e.id = r.eval_id WHERE r.success = true LIMIT 10',
 'supabase_explain_query',
 array['Join', 'Limit'],
 array['sql', 'explain', 'index']),

-- ── project management ───────────────────────────────────────────────────────

('list_organizations',
 'List all Supabase organizations I have access to.',
 'supabase_list_organizations',
 array['id', 'name'],
 array['project_mgmt', 'organizations']),

('list_all_projects',
 'List all my Supabase projects showing their name, ref, and region.',
 'supabase_list_projects',
 array['id', 'region'],
 array['project_mgmt', 'projects']),

('get_project_url',
 'What is the REST API URL for the current Supabase project?',
 'supabase_get_project_url',
 array['supabase.co'],
 array['project_mgmt', 'config']),

('get_publishable_key',
 'Get the anon (publishable) API key for this Supabase project.',
 'supabase_get_publishable_key',
 array['anon_key'],
 array['project_mgmt', 'config']),

-- ── schema DDL ───────────────────────────────────────────────────────────────

('apply_idempotent_column',
 'Add a nullable text column called "eval_notes" to evals.eval_scratch if it does not already exist. Use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.',
 'supabase_apply_migration',
 array['eval_scratch'],
 array['schema', 'ddl', 'migration']),

('apply_create_index',
 'Create an index on evals.eval_scratch(name) if it does not already exist.',
 'supabase_apply_migration',
 array['eval_scratch', 'name'],
 array['schema', 'ddl', 'index']),

-- ── TypeScript types ──────────────────────────────────────────────────────────

('generate_types_public',
 'Generate TypeScript type definitions for the public schema of this project.',
 'supabase_generate_typescript_types',
 array['export type', 'Database'],
 array['schema', 'typescript', 'types']),

('generate_types_evals',
 'Generate TypeScript types for the evals schema so I can use them in my app.',
 'supabase_generate_typescript_types',
 array['Tables', 'evals'],
 array['schema', 'typescript', 'types']),

-- ── edge functions ────────────────────────────────────────────────────────────

('list_edge_functions',
 'List all edge functions deployed to this Supabase project.',
 'supabase_list_edge_functions',
 array['slug', 'name'],
 array['edge_functions']),

('get_skill_router_function',
 'Get the metadata for the edge function with slug "skill-router".',
 'supabase_get_edge_function',
 array['skill-router'],
 array['edge_functions']),

('deploy_test_edge_function',
 E'Deploy an edge function with slug "eval-test-fn" and this Deno source:\nDeno.serve(() => new Response(JSON.stringify({ ok: true, source: "eval" }), { headers: { "Content-Type": "application/json" } }))',
 'supabase_deploy_edge_function',
 array['eval-test-fn'],
 array['edge_functions', 'write']),

('delete_test_edge_function',
 'Delete the edge function with slug "eval-test-fn" from this project.',
 'supabase_delete_edge_function',
 array['eval-test-fn'],
 array['edge_functions', 'write', 'cleanup']),

-- ── secrets ───────────────────────────────────────────────────────────────────

('list_secrets',
 'List all secrets (environment variable names) configured for this project.',
 'supabase_list_secrets',
 array['name'],
 array['secrets']),

('set_test_secret',
 'Set a secret named EVAL_TEST_SECRET with the value "eval-placeholder-42" on this project.',
 'supabase_set_secrets',
 array['EVAL_TEST_SECRET'],
 array['secrets', 'write']),

('delete_test_secret',
 'Delete the secret named EVAL_TEST_SECRET from this project.',
 'supabase_delete_secrets',
 array['EVAL_TEST_SECRET'],
 array['secrets', 'write', 'cleanup']),

-- ── migration commands (pure computation — no side effects) ───────────────────

('generate_migration_commands',
 'Generate the exact pg_dump and psql commands to migrate the current project to the eu-west-2 region. Source ref: abcdefghijklmnop, source region: us-east-1, target region: eu-west-2, use password: example-pass-123.',
 'supabase_get_migration_commands',
 array['supabase db dump', 'psql', 'eu-west-2', 'abcdefghijklmnop'],
 array['migration', 'commands']),

('generate_migration_commands_us_west',
 'I need to move my project from us-east-1 to us-west-2. Generate the migration shell commands. Project ref: abcdefghijklmnop, password: example-pass-123.',
 'supabase_get_migration_commands',
 array['supabase db dump', 'us-west-2'],
 array['migration', 'commands']),

-- ── project_ref cross-project routing ────────────────────────────────────────
-- These test that the agent uses project_ref when operating on a second project

('execute_sql_on_target_project',
 'Count the number of tables in the public schema of project ref "xxxxxxxxxxxxxxxx" (not the default project).',
 'supabase_execute_sql',
 array['table_name', 'information_schema'],
 array['sql', 'cross_project']),

('apply_migration_on_target_project',
 'On project ref "xxxxxxxxxxxxxxxx", create a table called migration_test (id uuid primary key default gen_random_uuid(), migrated_at timestamptz default now()) if it does not exist.',
 'supabase_apply_migration',
 array['migration_test'],
 array['schema', 'ddl', 'cross_project'])

on conflict (name) do nothing;
