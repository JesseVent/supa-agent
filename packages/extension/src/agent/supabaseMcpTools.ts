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

const MGMT = 'https://api.supabase.com/v1'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function mgmt(
	path: string,
	pat: string,
	opts: Omit<RequestInit, 'headers'> = {}
): Promise<string> {
	const res = await fetch(`${MGMT}${path}`, {
		...opts,
		headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
	})
	const data = await res.json().catch(() => ({ error: res.statusText }))
	if (!res.ok) return `Error ${res.status}: ${JSON.stringify(data)}`
	return JSON.stringify(data, null, 2)
}

async function sqlQuery(ref: string, pat: string, query: string): Promise<string> {
	return mgmt(`/projects/${ref}/database/query`, pat, {
		method: 'POST',
		body: JSON.stringify({ query }),
	})
}

const _keysCache = new Map<string, { anon: string; serviceRole: string }>()

async function getProjectKeys(
	ref: string,
	pat: string
): Promise<{ anon: string; serviceRole: string }> {
	const key = `${ref}:${pat}`
	if (_keysCache.has(key)) return _keysCache.get(key)!
	const res = await fetch(`${MGMT}/projects/${ref}/api-keys`, {
		headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
	})
	if (!res.ok) throw new Error(`Failed to fetch API keys: ${res.status}`)
	const keys = (await res.json()) as { name: string; api_key: string }[]
	const result = {
		anon: keys.find((k) => k.name === 'anon')?.api_key ?? '',
		serviceRole: keys.find((k) => k.name === 'service_role')?.api_key ?? '',
	}
	_keysCache.set(key, result)
	return result
}

async function projectApi(
	ref: string,
	pat: string,
	path: string,
	opts: RequestInit = {}
): Promise<string> {
	const { serviceRole } = await getProjectKeys(ref, pat)
	const res = await fetch(`https://${ref}.supabase.co${path}`, {
		...opts,
		headers: {
			Authorization: `Bearer ${serviceRole}`,
			apikey: serviceRole,
			'Content-Type': 'application/json',
			...((opts.headers as Record<string, string>) ?? {}),
		},
	})
	const data = await res.json().catch(() => ({ error: res.statusText }))
	if (!res.ok) return `Error ${res.status}: ${JSON.stringify(data)}`
	return JSON.stringify(data, null, 2)
}

interface Filter {
	column: string
	operator: string
	value: unknown
}

function buildWhere(filters?: Filter[]): string {
	if (!filters?.length) return ''
	const conditions = filters.map(({ column, operator, value }) => {
		const v =
			value === null
				? 'NULL'
				: Array.isArray(value)
					? `(${(value as unknown[]).map(escVal).join(', ')})`
					: escVal(value)
		if (operator === 'is') return `${column} IS ${v}`
		if (operator === 'in') return `${column} IN ${v}`
		const ops: Record<string, string> = {
			eq: '=',
			neq: '!=',
			gt: '>',
			gte: '>=',
			lt: '<',
			lte: '<=',
			like: 'LIKE',
			ilike: 'ILIKE',
		}
		return `${column} ${ops[operator] ?? operator} ${v}`
	})
	return `WHERE ${conditions.join(' AND ')}`
}

function escVal(v: unknown): string {
	if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`
	if (v === null || v === undefined) return 'NULL'
	if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
	return `'${JSON.stringify(v).replace(/'/g, "''")}'`
}

const filterSchema = z
	.array(
		z.object({
			column: z.string(),
			operator: z.string().describe('eq, neq, gt, gte, lt, lte, like, ilike, is, in'),
			value: z.unknown(),
		})
	)
	.describe('Filter conditions')

// ── Tool factory ─────────────────────────────────────────────────────────────

export function createSupabaseMcpTools(config: SupabaseMcpConfig): Record<string, SupabaseTool> {
	const { projectRef: ref, accessToken: pat } = config

	return {
		// ── Database query ──────────────────────────────────────────────────────

		supabase_execute_sql: {
			description: 'Execute a SQL query against the Supabase project database.',
			inputSchema: z.object({ query: z.string().describe('SQL query to execute') }),
			execute: async (input) => sqlQuery(ref, pat, (input as { query: string }).query),
		},

		// ── CRUD ────────────────────────────────────────────────────────────────

		supabase_select: {
			description: 'Query rows from a table with optional filters, columns, order, and limit.',
			inputSchema: z.object({
				table: z.string().describe('Table name, optionally schema-qualified (schema.table)'),
				columns: z.string().optional().describe('Comma-separated columns (default: *)'),
				filters: filterSchema.optional(),
				order_by: z.string().optional().describe('Column to order by'),
				order_dir: z.enum(['ASC', 'DESC']).optional(),
				limit: z.number().int().positive().optional().describe('Max rows (default: 100)'),
			}),
			execute: async (input) => {
				const {
					table,
					columns = '*',
					filters,
					order_by,
					order_dir = 'ASC',
					limit = 100,
				} = input as {
					table: string
					columns?: string
					filters?: Filter[]
					order_by?: string
					order_dir?: string
					limit?: number
				}
				const where = buildWhere(filters)
				const order = order_by ? `ORDER BY ${order_by} ${order_dir}` : ''
				return sqlQuery(
					ref,
					pat,
					`SELECT ${columns} FROM ${table} ${where} ${order} LIMIT ${limit}`
				)
			},
		},

		supabase_insert: {
			description: 'Insert one or more rows into a table and return inserted rows.',
			inputSchema: z.object({
				table: z.string().describe('Table name, optionally schema-qualified'),
				rows: z.array(z.record(z.string(), z.unknown())).describe('Row objects to insert'),
			}),
			execute: async (input) => {
				const { table, rows } = input as { table: string; rows: Record<string, unknown>[] }
				if (!rows.length) return 'Error: no rows provided'
				const cols = Object.keys(rows[0])
				const vals = rows.map((r) => `(${cols.map((c) => escVal(r[c])).join(', ')})`).join(',\n  ')
				return sqlQuery(
					ref,
					pat,
					`INSERT INTO ${table} (${cols.join(', ')}) VALUES\n  ${vals}\nRETURNING *`
				)
			},
		},

		supabase_update: {
			description: 'Update rows matching filters in a table.',
			inputSchema: z.object({
				table: z.string().describe('Table name, optionally schema-qualified'),
				updates: z.record(z.string(), z.unknown()).describe('Fields to update'),
				filters: z
					.array(z.object({ column: z.string(), operator: z.string(), value: z.unknown() }))
					.min(1)
					.describe('At least one filter required'),
			}),
			execute: async (input) => {
				const { table, updates, filters } = input as {
					table: string
					updates: Record<string, unknown>
					filters: Filter[]
				}
				const set = Object.entries(updates)
					.map(([k, v]) => `${k} = ${escVal(v)}`)
					.join(', ')
				return sqlQuery(ref, pat, `UPDATE ${table} SET ${set} ${buildWhere(filters)} RETURNING *`)
			},
		},

		supabase_delete: {
			description: 'Delete rows matching filters from a table.',
			inputSchema: z.object({
				table: z.string().describe('Table name, optionally schema-qualified'),
				filters: z
					.array(z.object({ column: z.string(), operator: z.string(), value: z.unknown() }))
					.min(1)
					.describe('At least one filter required'),
			}),
			execute: async (input) => {
				const { table, filters } = input as { table: string; filters: Filter[] }
				return sqlQuery(ref, pat, `DELETE FROM ${table} ${buildWhere(filters)} RETURNING *`)
			},
		},

		supabase_rpc: {
			description: 'Call a Supabase stored procedure.',
			inputSchema: z.object({
				fn: z.string().describe('Function name, optionally schema-qualified'),
				params: z.record(z.string(), z.unknown()).optional().describe('Function parameters'),
			}),
			execute: async (input) => {
				const { fn, params } = input as { fn: string; params?: Record<string, unknown> }
				const args = params
					? Object.entries(params)
							.map(([k, v]) => `${k} => ${escVal(v)}`)
							.join(', ')
					: ''
				return sqlQuery(ref, pat, `SELECT * FROM ${fn}(${args})`)
			},
		},

		// ── Schema introspection ────────────────────────────────────────────────

		supabase_list_tables: {
			description: 'List tables in the Supabase project database.',
			inputSchema: z.object({
				schema: z
					.string()
					.optional()
					.describe('Schema to filter (default: all non-system schemas)'),
			}),
			execute: async (input) => {
				const { schema } = input as { schema?: string }
				const filter = schema
					? `AND table_schema = '${schema}'`
					: `AND table_schema NOT IN ('pg_catalog','information_schema','pg_toast')`
				return sqlQuery(
					ref,
					pat,
					`SELECT table_schema, table_name, table_type
					 FROM information_schema.tables
					 WHERE true ${filter}
					 ORDER BY table_schema, table_name`
				)
			},
		},

		supabase_list_schemas: {
			description: 'List non-system schemas in the Supabase project database.',
			inputSchema: z.object({}),
			execute: async () =>
				sqlQuery(
					ref,
					pat,
					`SELECT schema_name, schema_owner
					 FROM information_schema.schemata
					 WHERE schema_name NOT LIKE 'pg_%'
					   AND schema_name NOT LIKE 'information_%'
					   AND schema_name NOT IN ('pg_catalog')
					 ORDER BY schema_name`
				),
		},

		supabase_list_policies: {
			description: 'List Row Level Security policies for tables in the database.',
			inputSchema: z.object({
				schema: z.string().optional().describe('Schema to filter (default: public)'),
				table: z.string().optional().describe('Table name to filter'),
			}),
			execute: async (input) => {
				const { schema, table } = input as { schema?: string; table?: string }
				const conditions = [`schemaname = '${schema ?? 'public'}'`]
				if (table) conditions.push(`tablename = '${table}'`)
				return sqlQuery(
					ref,
					pat,
					`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
					 FROM pg_policies
					 WHERE ${conditions.join(' AND ')}
					 ORDER BY tablename, policyname`
				)
			},
		},

		supabase_list_migrations: {
			description: 'List applied database migrations.',
			inputSchema: z.object({}),
			execute: async () =>
				sqlQuery(
					ref,
					pat,
					`SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 50`
				),
		},

		supabase_list_extensions: {
			description: 'List installed Postgres extensions.',
			inputSchema: z.object({}),
			execute: async () =>
				sqlQuery(
					ref,
					pat,
					`SELECT name, default_version, installed_version, comment
					 FROM pg_available_extensions WHERE installed_version IS NOT NULL ORDER BY name`
				),
		},

		// ── Auth ────────────────────────────────────────────────────────────────

		supabase_auth_list_users: {
			description: 'List all users in the project (uses service role key).',
			inputSchema: z.object({
				page: z.number().int().positive().optional(),
				per_page: z.number().int().positive().optional(),
			}),
			execute: async (input) => {
				const { page = 1, per_page = 50 } = input as { page?: number; per_page?: number }
				return projectApi(ref, pat, `/auth/v1/admin/users?page=${page}&per_page=${per_page}`)
			},
		},

		supabase_auth_sign_up: {
			description: 'Create a new user account.',
			inputSchema: z.object({
				email: z.string(),
				password: z.string().min(6),
			}),
			execute: async (input) => {
				const { anon } = await getProjectKeys(ref, pat)
				const { email, password } = input as { email: string; password: string }
				const res = await fetch(`https://${ref}.supabase.co/auth/v1/signup`, {
					method: 'POST',
					headers: { apikey: anon, 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				})
				return JSON.stringify(await res.json(), null, 2)
			},
		},

		supabase_auth_sign_in: {
			description: 'Sign in a user with email and password.',
			inputSchema: z.object({ email: z.string(), password: z.string() }),
			execute: async (input) => {
				const { anon } = await getProjectKeys(ref, pat)
				const { email, password } = input as { email: string; password: string }
				const res = await fetch(`https://${ref}.supabase.co/auth/v1/token?grant_type=password`, {
					method: 'POST',
					headers: { apikey: anon, 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				})
				return JSON.stringify(await res.json(), null, 2)
			},
		},

		// ── Storage ─────────────────────────────────────────────────────────────

		supabase_storage_list_buckets: {
			description: 'List all storage buckets in the project.',
			inputSchema: z.object({}),
			execute: async () => projectApi(ref, pat, '/storage/v1/bucket'),
		},

		supabase_storage_list_files: {
			description: 'List files in a storage bucket at an optional path prefix.',
			inputSchema: z.object({
				bucket: z.string(),
				path: z.string().optional().describe('Path prefix (default: root)'),
				limit: z.number().int().positive().optional(),
			}),
			execute: async (input) => {
				const {
					bucket,
					path = '',
					limit = 100,
				} = input as {
					bucket: string
					path?: string
					limit?: number
				}
				return projectApi(ref, pat, `/storage/v1/object/list/${bucket}`, {
					method: 'POST',
					body: JSON.stringify({ prefix: path, limit }),
				})
			},
		},

		supabase_storage_get_public_url: {
			description: 'Get the public URL for a file in a public storage bucket.',
			inputSchema: z.object({ bucket: z.string(), path: z.string() }),
			execute: async (input) => {
				const { bucket, path } = input as { bucket: string; path: string }
				return JSON.stringify({
					publicUrl: `https://${ref}.supabase.co/storage/v1/object/public/${bucket}/${path}`,
				})
			},
		},

		// ── Project & observability ─────────────────────────────────────────────

		supabase_get_project: {
			description: 'Get project details (status, region, URLs).',
			inputSchema: z.object({}),
			execute: async () => mgmt(`/projects/${ref}`, pat),
		},

		supabase_get_logs: {
			description: 'Fetch recent logs (edge functions, API, auth, storage, postgres).',
			inputSchema: z.object({
				source: z
					.enum(['edge_logs', 'postgres_logs', 'auth_logs', 'storage_logs', 'api_logs'])
					.optional()
					.describe('Log source (default: edge_logs)'),
				limit: z.number().int().positive().optional().describe('Max rows (default: 20)'),
				hours_ago: z.number().positive().optional().describe('Hours back to search (default: 1)'),
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
					`${MGMT}/projects/${ref}/analytics/endpoints/logs.all?iso_timestamp_start=${start}&iso_timestamp_end=${end}&sql=${logSql}`,
					{ headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' } }
				)
				const data = await res.json().catch(() => ({ error: res.statusText }))
				if (!res.ok) return `Error ${res.status}: ${JSON.stringify(data)}`
				return JSON.stringify(data, null, 2)
			},
		},

		supabase_get_advisors: {
			description:
				'Get actionable security and performance recommendations (WARN/ERROR level only).',
			inputSchema: z.object({
				include_info: z
					.boolean()
					.optional()
					.describe('Include INFO-level lints too (default: false, WARN/ERROR only)'),
			}),
			execute: async (input) => {
				const { include_info = false } = input as { include_info?: boolean }
				const [sec, perf] = await Promise.all([
					mgmt(`/projects/${ref}/advisors/security`, pat),
					mgmt(`/projects/${ref}/advisors/performance`, pat),
				])
				const filter = (d: unknown) => {
					const parsed = d as { lints?: { level: string }[] }
					if (!parsed?.lints) return parsed
					return {
						...parsed,
						lints: include_info ? parsed.lints : parsed.lints.filter((l) => l.level !== 'INFO'),
					}
				}
				return JSON.stringify(
					{ security: filter(JSON.parse(sec)), performance: filter(JSON.parse(perf)) },
					null,
					2
				)
			},
		},

		// ── Evals ───────────────────────────────────────────────────────────────

		supabase_list_evals: {
			description:
				'List all active eval test cases. Call at the start of an eval run to get the full task list.',
			inputSchema: z.object({}),
			execute: async () => sqlQuery(ref, pat, `SELECT * FROM public.get_active_evals()`),
		},

		supabase_record_eval_run: {
			description: 'Record the result of one completed eval task.',
			inputSchema: z.object({
				run_id: z.string().describe('UUID shared across all tasks in this eval session'),
				eval_id: z.string().describe('UUID of the eval case from supabase_list_evals'),
				tools_called: z.array(z.string()).describe('Tool names called to complete the task'),
				output: z.string().describe('The final answer or output produced'),
				steps: z.number().int().describe('Number of steps taken'),
				success: z.boolean(),
				duration_ms: z.number().int().optional(),
			}),
			execute: async (input) => {
				const { run_id, eval_id, tools_called, output, steps, success, duration_ms } = input as {
					run_id: string
					eval_id: string
					tools_called: string[]
					output: string
					steps: number
					success: boolean
					duration_ms?: number
				}
				const toolsArr = `ARRAY[${tools_called.map((t) => `'${t}'`).join(',')}]::text[]`
				return sqlQuery(
					ref,
					pat,
					`SELECT public.save_eval_run(
						'${run_id}'::uuid, '${eval_id}'::uuid,
						${toolsArr}, ${escVal(output)}, ${steps}, ${String(success)},
						${duration_ms ?? 'NULL'}
					) as run_record_id`
				)
			},
		},

		supabase_score_eval_run: {
			description: 'Ask the LLM judge to score a recorded eval run result.',
			inputSchema: z.object({
				run_id: z.string().describe('The run_record_id returned by supabase_record_eval_run'),
				eval_id: z.string(),
				task: z.string(),
				expected_tool: z.string(),
				expected_contains: z.array(z.string()),
				tools_called: z.array(z.string()),
				output: z.string(),
				success: z.boolean(),
			}),
			execute: async (input) => {
				const { serviceRole } = await getProjectKeys(ref, pat)
				const res = await fetch(`https://${ref}.supabase.co/functions/v1/eval-scorer`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
					body: JSON.stringify(input),
				})
				const data = await res.json().catch(() => ({ error: res.statusText }))
				if (!res.ok) return `Error ${res.status}: ${JSON.stringify(data)}`
				return JSON.stringify(data, null, 2)
			},
		},

		supabase_get_eval_summary: {
			description: 'Get scored results for a completed eval run session.',
			inputSchema: z.object({
				run_id: z.string().describe('The run_id shared across all tasks in the session'),
			}),
			execute: async (input) => {
				const { run_id } = input as { run_id: string }
				return sqlQuery(
					ref,
					pat,
					`SELECT e.name, e.expected_tool, r.tools_called, r.success,
					        r.score, r.score_reason, r.steps, r.duration_ms
					 FROM evals.agent_eval_runs r
					 JOIN evals.agent_evals e ON e.id = r.eval_id
					 WHERE r.run_id = '${run_id}'::uuid
					 ORDER BY r.created_at`
				)
			},
		},
	}
}
