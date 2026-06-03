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

async function sql(ref: string, accessToken: string, query: string): Promise<string> {
	return mgmt(`/projects/${ref}/database/query`, accessToken, {
		method: 'POST',
		body: JSON.stringify({ query }),
	})
}

export function createSupabaseMcpTools(config: SupabaseMcpConfig): Record<string, SupabaseTool> {
	const { projectRef: ref, accessToken } = config

	return {
		supabase_execute_sql: {
			description: 'Execute a SQL query against the Supabase project database.',
			inputSchema: z.object({
				query: z.string().describe('SQL query to execute'),
			}),
			execute: async (input) => {
				const { query } = input as { query: string }
				return sql(ref, accessToken, query)
			},
		},

		supabase_list_tables: {
			description: 'List tables in the Supabase project database.',
			inputSchema: z.object({
				schema: z
					.string()
					.optional()
					.describe('Schema to filter by (default: all non-system schemas)'),
			}),
			execute: async (input) => {
				const { schema } = input as { schema?: string }
				const schemaFilter = schema
					? `AND table_schema = '${schema}'`
					: `AND table_schema NOT IN ('pg_catalog', 'information_schema')`
				return sql(
					ref,
					accessToken,
					`SELECT table_schema, table_name, table_type
					 FROM information_schema.tables
					 WHERE true ${schemaFilter}
					 ORDER BY table_schema, table_name`
				)
			},
		},

		supabase_list_migrations: {
			description: 'List applied database migrations for the Supabase project.',
			inputSchema: z.object({}),
			execute: async () =>
				sql(
					ref,
					accessToken,
					`SELECT version, name, statements
					 FROM supabase_migrations.schema_migrations
					 ORDER BY version DESC
					 LIMIT 50`
				),
		},

		supabase_list_extensions: {
			description: 'List installed Postgres extensions in the Supabase project.',
			inputSchema: z.object({}),
			execute: async () =>
				sql(
					ref,
					accessToken,
					`SELECT name, default_version, installed_version, comment
					 FROM pg_available_extensions
					 WHERE installed_version IS NOT NULL
					 ORDER BY name`
				),
		},

		supabase_get_logs: {
			description: 'Fetch recent logs from the Supabase project (edge functions, API, etc.).',
			inputSchema: z.object({
				source: z
					.enum(['edge_logs', 'postgres_logs', 'auth_logs', 'storage_logs', 'api_logs'])
					.optional()
					.describe('Log table to query (default: edge_logs)'),
				limit: z.number().int().positive().optional().describe('Max rows (default: 20)'),
				hours_ago: z
					.number()
					.positive()
					.optional()
					.describe('How many hours back to look (default: 1)'),
			}),
			execute: async (input) => {
				const {
					source = 'edge_logs',
					limit = 20,
					hours_ago = 1,
				} = input as {
					source?: string
					limit?: number
					hours_ago?: number
				}
				const end = new Date().toISOString()
				const start = new Date(Date.now() - hours_ago * 3600 * 1000).toISOString()
				const logSql = encodeURIComponent(
					`select timestamp, event_message from ${source} limit ${limit}`
				)
				const res = await fetch(
					`${BASE}/projects/${ref}/analytics/endpoints/logs.all?iso_timestamp_start=${start}&iso_timestamp_end=${end}&sql=${logSql}`,
					{
						headers: {
							Authorization: `Bearer ${accessToken}`,
							'Content-Type': 'application/json',
						},
					}
				)
				const data = await res.json().catch(() => ({ error: res.statusText }))
				if (!res.ok) return `Error ${res.status}: ${JSON.stringify(data)}`
				return JSON.stringify(data, null, 2)
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
			execute: async () => {
				const [sec, perf] = await Promise.all([
					mgmt(`/projects/${ref}/advisors/security`, accessToken),
					mgmt(`/projects/${ref}/advisors/performance`, accessToken),
				])
				return JSON.stringify({ security: JSON.parse(sec), performance: JSON.parse(perf) }, null, 2)
			},
		},
	}
}
