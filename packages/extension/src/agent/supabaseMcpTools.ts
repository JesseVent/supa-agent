import * as z from 'zod/v4'

interface SupabaseMcpConfig {
	projectRef: string
	accessToken: string
}

interface SupabaseTool {
	description: string
	inputSchema: z.ZodType
	execute: (input: unknown) => Promise<string>
}

const BASE = 'https://api.supabase.com/v1'

async function mgmt(
	path: string,
	accessToken: string,
	opts: Omit<RequestInit, 'headers'> = {}
): Promise<string> {
	const res = await fetch(`${BASE}${path}`, {
		...opts,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
	})
	const data = await res.json().catch(() => ({ error: res.statusText }))
	if (!res.ok) return `Error ${res.status}: ${JSON.stringify(data)}`
	return JSON.stringify(data, null, 2)
}

export function createSupabaseMcpTools(config: SupabaseMcpConfig): Record<string, SupabaseTool> {
	const { projectRef: ref, accessToken } = config

	return {
		supabase_execute_sql: {
			description:
				'Execute a SQL query against the Supabase project database and return the results.',
			inputSchema: z.object({
				query: z.string().describe('SQL query to execute'),
			}),
			execute: async (input) => {
				const { query } = input as { query: string }
				return mgmt(`/projects/${ref}/database/query`, accessToken, {
					method: 'POST',
					body: JSON.stringify({ query }),
				})
			},
		},

		supabase_list_tables: {
			description: 'List tables in the Supabase project database.',
			inputSchema: z.object({
				schema: z.string().optional().describe('Schema name to filter by (default: all schemas)'),
			}),
			execute: async (input) => {
				const { schema } = input as { schema?: string }
				const qs = schema ? `?included_schemas=${schema}` : ''
				return mgmt(`/projects/${ref}/pg-meta/v1/tables${qs}`, accessToken)
			},
		},

		supabase_list_migrations: {
			description: 'List applied database migrations for the Supabase project.',
			inputSchema: z.object({}),
			execute: async () => mgmt(`/projects/${ref}/pg-meta/v1/migrations`, accessToken),
		},

		supabase_list_extensions: {
			description: 'List installed Postgres extensions in the Supabase project.',
			inputSchema: z.object({}),
			execute: async () => mgmt(`/projects/${ref}/pg-meta/v1/extensions`, accessToken),
		},

		supabase_get_logs: {
			description: 'Fetch recent logs from the Supabase project.',
			inputSchema: z.object({
				product: z
					.enum(['api', 'database', 'auth', 'storage', 'edge_functions'])
					.optional()
					.describe('Log source to filter (default: api)'),
				limit: z.number().int().positive().optional().describe('Max log lines (default: 100)'),
			}),
			execute: async (input) => {
				const { product = 'api', limit = 100 } = input as {
					product?: string
					limit?: number
				}
				return mgmt(`/projects/${ref}/logs?product=${product}&limit=${limit}`, accessToken)
			},
		},

		supabase_get_project: {
			description: 'Get details about the Supabase project (status, region, plan, URLs).',
			inputSchema: z.object({}),
			execute: async () => mgmt(`/projects/${ref}`, accessToken),
		},

		supabase_get_advisors: {
			description: 'Get security and performance advisor recommendations for the Supabase project.',
			inputSchema: z.object({}),
			execute: async () => mgmt(`/projects/${ref}/advisors`, accessToken),
		},
	}
}
