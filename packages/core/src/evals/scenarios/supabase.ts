import * as z from 'zod/v4'
import type { SupaAgentTool } from '../../tools'
import { tool } from '../../tools'
import type { EvalScenario } from '../types'

// ─── Mock Supabase MCP Tools ───

const mockMcpTools: Record<string, SupaAgentTool> = {
	list_projects: tool({
		description:
			'List all Supabase projects the user has access to. Returns project_ref, name, region, and status.',
		inputSchema: z.object({}),
		execute: async () =>
			JSON.stringify({
				projects: [
					{
						ref: 'abcdefghijklmnopqrst',
						name: 'My Supabase Project',
						region: 'us-east-1',
						status: 'ACTIVE_HEALTHY',
					},
					{
						ref: 'zyxwvutsrqponmlkjihg',
						name: 'Staging Project',
						region: 'ap-southeast-1',
						status: 'ACTIVE_HEALTHY',
					},
				],
			}),
	}),

	get_project: tool({
		description:
			'Get details about a specific Supabase project by project_ref. Returns name, region, status, database version, and other metadata.',
		inputSchema: z.object({
			project_ref: z.string(),
		}),
		execute: async (_input) =>
			JSON.stringify({
				ref: 'abcdefghijklmnopqrst',
				name: 'My Supabase Project',
				region: 'us-east-1',
				status: 'ACTIVE_HEALTHY',
				created_at: '2024-01-15T10:30:00Z',
				db_version: '15.1.1.78',
			}),
	}),

	list_tables: tool({
		description: 'List all tables in a Supabase project database. Optionally filter by schema.',
		inputSchema: z.object({
			project_ref: z.string(),
			schema: z.string().optional(),
		}),
		execute: async (_input) =>
			JSON.stringify({
				tables: [
					{ schema: 'public', name: 'users', rows: 1247 },
					{ schema: 'public', name: 'orders', rows: 8392 },
					{ schema: 'public', name: 'products', rows: 156 },
					{ schema: 'auth', name: 'users', rows: 1247 },
				],
			}),
	}),

	execute_sql: tool({
		description:
			'Execute a SQL query on a Supabase project database. Returns query results as JSON.',
		inputSchema: z.object({
			project_ref: z.string(),
			query: z.string(),
		}),
		execute: async (input) => {
			if (input.query.toLowerCase().includes('select')) {
				return JSON.stringify({
					rows: [
						{ id: 1, email: 'alice@example.com', created_at: '2024-01-10' },
						{ id: 2, email: 'bob@example.com', created_at: '2024-01-12' },
					],
					rowCount: 2,
				})
			}
			return JSON.stringify({ message: 'Query executed successfully' })
		},
	}),

	get_advisors: tool({
		description:
			'Get security and performance advisors for a Supabase project. Returns recommendations for RLS, indexes, and extensions.',
		inputSchema: z.object({
			project_ref: z.string(),
			limit: z.number().optional(),
		}),
		execute: async (_input) =>
			JSON.stringify({
				advisors: [
					{
						type: 'security',
						severity: 'high',
						message: 'Table "orders" is missing RLS policies',
						remediation: 'Enable RLS and add policies',
					},
					{
						type: 'performance',
						severity: 'medium',
						message: 'Missing index on users(email)',
						remediation: 'CREATE INDEX idx_users_email ON users(email)',
					},
				],
			}),
	}),

	get_publishable_keys: tool({
		description:
			'Get the publishable API keys (anon key) for a Supabase project. These are safe to share with client applications.',
		inputSchema: z.object({
			project_ref: z.string(),
		}),
		execute: async (_input) =>
			JSON.stringify({
				anon_key: 'eyJhbGciOiJIUzI1NiIs...mock',
				publishable_key: 'sb_publishable_abcdefghijklmnopqrst',
			}),
	}),
}

// ─── Supabase Studio Dashboard HTML (simplified) ───
// NOTE: HTML must NOT contain the specific data the user is asking for,
// otherwise the LLM will just read the page instead of using MCP tools.

const studioDashboardHtml = `
[0]<nav>Supabase Studio</nav>
[1]<a>Dashboard</a>
[2]<a>Table Editor</a>
[3]<a>SQL Editor</a>
[4]<a>Auth</a>
[5]<a>Storage</a>
[6]<a>Edge Functions</a>
[7]<a>Database</a>
[8]<main>
	[9]<h1>My Supabase Project</h1>
	[10]<div>Project details not displayed.</div>
	[11]<button>View API Keys</button>
	[12]<button>Database Tables</button>
	[13]<button>Auth Settings</button>
	[14]<button>Storage Settings</button>
[15]</main>
`

const studioTableEditorHtml = `
[0]<nav>Supabase Studio</nav>
[1]<a>Dashboard</a>
[2]<a>Table Editor</a>
[3]<a>SQL Editor</a>
[4]<a>Auth</a>
[5]<a>Storage</a>
[6]<main>
	[7]<h1>Table Editor</h1>
	[8]<div>No tables displayed.</div>
	[9]<button>New Table</button>
[10]</main>
`

const studioSqlEditorHtml = `
[0]<nav>Supabase Studio</nav>
[1]<a>Dashboard</a>
[2]<a>Table Editor</a>
[3]<a>SQL Editor</a>
[4]<a>Auth</a>
[5]<main>
	[6]<h1>SQL Editor</h1>
	[7]<textarea>New query</textarea>
	[8]<button>Run</button>
	[9]<div>Results will appear here</div>
[10]</main>
`

// ─── Eval Scenarios ───

/**
 * Scenarios testing whether the agent prefers MCP tools over browser navigation
 * when querying Supabase project information.
 */
export const supabaseMcpScenarios: EvalScenario[] = [
	{
		name: 'prefer-mcp-list-projects-over-dashboard',
		task: 'What Supabase projects do I have?',
		url: 'https://supabase.com/dashboard/projects',
		title: 'Supabase Dashboard',
		html: '[0]<nav>Supabase</nav>\n[1]<h1>Projects</h1>\n[2]<div>No projects displayed.</div>',
		customTools: mockMcpTools,
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			if (first.action?.name === 'list_projects') {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected list_projects (MCP tool), got ${first.action?.name}. Agent should use MCP tools instead of browser navigation for project queries.`,
			}
		},
	},
	{
		name: 'prefer-mcp-get-project-over-clicking',
		task: 'Get the status of my project "abcdefghijklmnopqrst"',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst',
		title: 'Project Dashboard',
		html: studioDashboardHtml,
		customTools: mockMcpTools,
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			// Accept get_project directly, or list_projects (which also returns status)
			if (
				first.action?.name === 'get_project' &&
				first.action?.input?.project_ref === 'abcdefghijklmnopqrst'
			) {
				return { pass: true }
			}
			if (first.action?.name === 'list_projects') {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected get_project or list_projects (MCP tool), got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
	{
		name: 'prefer-mcp-execute-sql-over-sql-editor',
		task: 'How many users are in my project abcdefghijklmnopqrst?',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/editor',
		title: 'SQL Editor',
		html: studioSqlEditorHtml,
		customTools: mockMcpTools,
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			// Must use an MCP tool, NOT the SQL Editor UI
			const mcpTools = ['execute_sql', 'list_tables']
			if (mcpTools.includes(first.action?.name)) {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected execute_sql or list_tables (MCP tool), got ${first.action?.name}. Agent should use MCP tools for database queries instead of the SQL Editor UI.`,
			}
		},
	},
	{
		name: 'prefer-mcp-list-tables-over-table-editor',
		task: 'List all tables in project abcdefghijklmnopqrst',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/editor',
		title: 'Table Editor',
		html: studioTableEditorHtml,
		customTools: mockMcpTools,
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			// Accept list_tables directly, or execute_sql (which can also list tables)
			if (
				first.action?.name === 'list_tables' &&
				first.action?.input?.project_ref === 'abcdefghijklmnopqrst'
			) {
				return { pass: true }
			}
			if (
				first.action?.name === 'execute_sql' &&
				first.action?.input?.project_ref === 'abcdefghijklmnopqrst'
			) {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected list_tables or execute_sql (MCP tool), got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
	{
		name: 'prefer-mcp-get-advisors-over-security-tab',
		task: 'Check security advisors for project abcdefghijklmnopqrst',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/database/security',
		title: 'Database Security',
		html: '[0]<nav>Supabase</nav>\n[1]<h1>Security</h1>\n[2]<div>Security status not displayed.</div>',
		customTools: mockMcpTools,
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			if (
				first.action?.name === 'get_advisors' &&
				first.action?.input?.project_ref === 'abcdefghijklmnopqrst'
			) {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected get_advisors with ref "abcdefghijklmnopqrst", got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
	{
		name: 'prefer-mcp-get-keys-over-clicking-view-keys',
		task: 'Get the API keys for project abcdefghijklmnopqrst',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/settings/api',
		title: 'API Settings',
		html: '[0]<nav>Supabase</nav>\n[1]<h1>API Settings</h1>\n[2]<div>Project URL: https://abcdefghijklmnopqrst.supabase.co</div>\n[3]<div>API keys not displayed.</div>',
		customTools: mockMcpTools,
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			// Allow get_publishable_keys within first 3 steps (agent may explore first)
			for (let i = 0; i < Math.min(3, steps.length); i++) {
				const step = steps[i] as any
				if (
					step.action?.name === 'get_publishable_keys' &&
					step.action?.input?.project_ref === 'abcdefghijklmnopqrst'
				) {
					return { pass: true }
				}
			}
			const first = steps[0] as any
			return {
				pass: false,
				message: `Expected get_publishable_keys within first 3 steps, got ${first?.action?.name} with ${JSON.stringify(first?.action?.input)}`,
			}
		},
	},
	{
		name: 'navigate-studio-to-sql-editor',
		task: 'Open the SQL Editor in Supabase Studio',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst',
		title: 'Project Dashboard',
		html: studioDashboardHtml,
		customTools: mockMcpTools,
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			// The SQL Editor tab is index 3 in the nav
			if (
				first.action?.name === 'click_element_by_index' &&
				first.action?.input?.index === 3
			) {
				return { pass: true }
			}
			// Or go_to_url is also acceptable
			if (first.action?.name === 'go_to_url') {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected click_element_by_index(3) or go_to_url, got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
]

/**
 * Deterministic Supabase MCP scenarios using pre-defined LLM responses.
 */
export const deterministicSupabaseScenarios: EvalScenario[] = [
	{
		name: 'det-mcp-list-projects',
		task: 'What Supabase projects do I have?',
		url: 'https://supabase.com/dashboard/projects',
		html: '[0]<h1>Projects</h1>',
		customTools: mockMcpTools,
		mockLlmResponses: [
			{
				tool: 'list_projects',
				args: {},
				reflection: {
					evaluation_previous_goal: '',
					memory: 'Need to list Supabase projects',
					next_goal: 'Call list_projects MCP tool',
				},
			},
			{
				tool: 'done',
				args: {
					text: 'You have 2 projects: My Supabase Project (us-east-1) and Staging Project (ap-southeast-1)',
					success: true,
				},
				reflection: {
					evaluation_previous_goal: 'Successfully listed projects via MCP',
					memory: 'Found 2 projects',
					next_goal: 'Report results to user',
				},
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 2) {
				return { pass: false, message: `Expected 2 steps, got ${steps.length}` }
			}
			const first = steps[0] as any
			if (first.action?.name !== 'list_projects') {
				return {
					pass: false,
					message: `Expected list_projects, got ${first.action?.name}`,
				}
			}
			return { pass: true }
		},
	},
	{
		name: 'det-mcp-execute-sql',
		task: 'Run a query to get users from project abcdefghijklmnopqrst',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/editor',
		html: studioSqlEditorHtml,
		customTools: mockMcpTools,
		mockLlmResponses: [
			{
				tool: 'execute_sql',
				args: {
					project_ref: 'abcdefghijklmnopqrst',
					query: 'SELECT * FROM users LIMIT 10',
				},
			},
			{
				tool: 'done',
				args: {
					text: 'Found 2 users: alice@example.com and bob@example.com',
					success: true,
				},
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 2) {
				return { pass: false, message: `Expected 2 steps, got ${steps.length}` }
			}
			const first = steps[0] as any
			if (first.action?.name !== 'execute_sql') {
				return {
					pass: false,
					message: `Expected execute_sql, got ${first.action?.name}`,
				}
			}
			return { pass: true }
		},
	},
	{
		name: 'det-navigate-studio-dashboard-to-tables',
		task: 'Navigate to the Table Editor in Supabase Studio',
		url: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst',
		html: studioDashboardHtml,
		customTools: mockMcpTools,
		mockLlmResponses: [
			{
				tool: 'click_element_by_index',
				args: { index: 2 },
			},
			{
				tool: 'done',
				args: { text: 'Navigated to Table Editor', success: true },
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 2) {
				return { pass: false, message: `Expected 2 steps, got ${steps.length}` }
			}
			const first = steps[0] as any
			if (first.action?.name !== 'click_element_by_index') {
				return {
					pass: false,
					message: `Expected click_element_by_index, got ${first.action?.name}`,
				}
			}
			return { pass: true }
		},
	},
]
