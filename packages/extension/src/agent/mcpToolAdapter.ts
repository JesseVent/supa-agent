/**
 * Convert JSON Schema (as returned by MCP tools/list) to a Zod schema.
 *
 * This is a focused converter for the schemas used by the Supabase MCP
 * server — it handles strings, numbers, booleans, arrays, objects,
 * enums, unions (anyOf), and optionality. It does NOT aim to be a
 * full JSON Schema → Zod converter.
 */
import type { SupaAgentTool } from '@supa-agent/core'
import * as z from 'zod/v4'

import type { SupabaseMcpClient } from './SupabaseMcpClient'

function jsonSchemaToZod(schema: unknown, required = true): z.ZodType {
	if (schema === null || schema === undefined) {
		return z.any()
	}

	const s = schema as Record<string, unknown>

	// Handle anyOf / oneOf as z.union
	const anyOf = (s.anyOf ?? s.oneOf) as Record<string, unknown>[] | undefined
	if (anyOf?.length) {
		const variants = anyOf.map((v) => jsonSchemaToZod(v, true))
		let type: z.ZodType = z.union(variants as [z.ZodType, z.ZodType, ...z.ZodType[]])
		type = applyMeta(type, s)
		return required ? type : type.optional()
	}

	// Handle enum
	const enumValues = s.enum as (string | number)[] | undefined
	if (enumValues?.length && s.type === 'string') {
		let type: z.ZodType = z.enum(enumValues as [string, ...string[]])
		type = applyMeta(type, s)
		return required ? type : type.optional()
	}

	let type: z.ZodType

	switch (s.type) {
		case 'string':
			type = z.string()
			break
		case 'number':
		case 'integer':
			type = z.number()
			break
		case 'boolean':
			type = z.boolean()
			break
		case 'array': {
			const itemSchema = jsonSchemaToZod(s.items, true)
			type = z.array(itemSchema)
			break
		}
		case 'object': {
			const props = (s.properties ?? {}) as Record<string, unknown>
			const requiredKeys = new Set((s.required as string[]) ?? [])
			const shape: Record<string, z.ZodType> = {}
			for (const [key, val] of Object.entries(props)) {
				shape[key] = jsonSchemaToZod(val, requiredKeys.has(key))
			}
			type = z.object(shape)
			break
		}
		case 'null':
			type = z.null()
			break
		default:
			// Unknown / composite type — fall back to z.any()
			type = z.any()
			break
	}

	type = applyMeta(type, s)

	if (s.nullable === true) {
		type = z.union([type, z.null()])
	}

	return required ? type : type.optional()
}

function applyMeta(zodType: z.ZodType, schema: Record<string, unknown>): z.ZodType {
	if (typeof schema.description === 'string') {
		zodType = zodType.describe(schema.description)
	}
	if (schema.default !== undefined) {
		// zod/v4 .default() is not available on all types; guard it
		try {
			zodType = (zodType as any).default(schema.default)
		} catch {
			// ignore if the type doesn't support .default()
		}
	}
	return zodType
}

/**
 * Convert a list of MCP tool definitions into SupaAgentTool objects.
 *
 * Each tool's execute function calls back into the provided SupabaseMcpClient.
 */
export async function adaptMcpTools(
	client: SupabaseMcpClient
): Promise<Record<string, SupaAgentTool>> {
	const mcpTools = await client.listTools()
	const adapted: Record<string, SupaAgentTool> = {}

	for (const tool of mcpTools) {
		const inputSchema = jsonSchemaToZod(tool.inputSchema, true)
		const name = tool.name

		adapted[name] = {
			description: tool.description ?? '',
			inputSchema,
			execute: async (args: unknown): Promise<string> =>
				client.callTool(name, args as Record<string, unknown>),
		}
	}

	return adapted
}

/**
 * Pick only the MCP tool names that are relevant for a given task.
 *
 * Uses a simple keyword heuristic matched against the tool name.
 */
export function selectMcpToolsForTask(
	task: string,
	allTools: Record<string, SupaAgentTool>
): Record<string, SupaAgentTool> {
	const t = task.toLowerCase()
	const selected: Record<string, SupaAgentTool> = {}

	const keywords: Record<string, string[]> = {
		execute_sql: [
			'sql',
			'query',
			'select',
			'insert',
			'update',
			'delete',
			'schema',
			'table',
			'column',
			'database',
			'row',
			'rows',
			'run query',
			'execute query',
			'list tables',
			'describe table',
		],
		explain_query: ['explain', 'slow', 'performance', 'index', 'plan', 'cost'],
		select: ['select', 'query', 'fetch', 'get rows', 'find', 'lookup'],
		insert: ['insert', 'add row', 'create row', 'new record'],
		update: ['update', 'modify', 'change', 'set column'],
		delete: ['delete', 'remove', 'drop row'],
		rpc: ['rpc', 'function', 'stored procedure', 'call'],
		list_tables: ['list tables', 'show tables', 'what tables', 'tables in', 'schema'],
		list_schemas: ['schemas', 'list schemas', 'database schemas'],
		list_policies: ['rls', 'policy', 'policies', 'row level security'],
		list_migrations: ['migrations', 'migration', 'schema history'],
		list_extensions: ['extensions', 'extension', 'postgis', 'pgvector'],
		auth_list_users: ['users', 'auth users', 'list users'],
		auth_sign_up: ['sign up', 'create user', 'register user'],
		auth_sign_in: ['sign in', 'login', 'authenticate user'],
		storage_list_buckets: ['buckets', 'storage buckets', 'list buckets'],
		storage_list_files: ['files', 'storage files', 'list files'],
		storage_get_public_url: ['public url', 'file url', 'storage url'],
		get_project: ['project details', 'project info', 'project status'],
		get_logs: ['logs', 'error logs', 'debug', 'trace', 'edge logs', 'postgres logs'],
		get_advisors: [
			'advisors',
			'lint',
			'security check',
			'performance check',
			'recommendations',
		],
		list_evals: ['evals', 'tests', 'benchmarks'],
		record_eval_run: ['record eval', 'save eval', 'eval result'],
		score_eval_run: ['score eval', 'grade eval', 'eval judge'],
		get_eval_summary: ['eval summary', 'eval results', 'eval report'],
		list_organizations: ['organizations', 'orgs', 'list orgs'],
		list_projects: ['projects', 'list projects', 'all projects'],
		create_project: ['create project', 'new project', 'spin up'],
		pause_project: ['pause project', 'stop project'],
		restore_project: ['restore project', 'unpause'],
		get_project_url: ['project url', 'api url', 'connection url'],
		get_publishable_keys: ['api key', 'anon key', 'publishable key'],
		apply_migration: ['migration', 'ddl', 'create table', 'alter table', 'schema change'],
		generate_typescript_types: ['typescript types', 'generate types', 'type definitions'],
		list_edge_functions: ['edge functions', 'list functions', 'serverless functions'],
		get_edge_function: ['edge function', 'function details'],
		deploy_edge_function: ['deploy function', 'update function', 'edge function code'],
		delete_edge_function: ['delete function', 'remove function'],
		list_secrets: ['secrets', 'env vars', 'environment variables'],
		set_secrets: ['set secrets', 'add secrets', 'env var'],
		delete_secrets: ['delete secrets', 'remove secrets'],
		transfer_pgsodium_key: ['pgsodium', 'encryption key', 'vault key', 'migrate encryption'],
		get_migration_commands: ['migration commands', 'pg_dump', 'dump', 'restore'],
		export_vault_secrets: ['vault secrets', 'export vault', 'column encryption'],
	}

	for (const [toolName, tool] of Object.entries(allTools)) {
		const toolKeywords = keywords[toolName]
		if (!toolKeywords) {
			// No heuristic — include if the task mentions "supabase" or the tool name
			if (t.includes('supabase') || t.includes(toolName.replace(/_/g, ' '))) {
				selected[toolName] = tool
			}
			continue
		}

		if (toolKeywords.some((kw) => t.includes(kw))) {
			selected[toolName] = tool
		}
	}

	// Always include a few core diagnostic tools
	const alwaysInclude = ['get_project', 'list_tables']
	for (const name of alwaysInclude) {
		if (allTools[name] && !selected[name]) {
			selected[name] = allTools[name]
		}
	}

	// If nothing matched, return all tools so the model can choose
	return Object.keys(selected).length > 0 ? selected : allTools
}
