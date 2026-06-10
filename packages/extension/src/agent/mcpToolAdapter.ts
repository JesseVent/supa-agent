/**
 * Convert JSON Schema (as returned by MCP tools/list) to a Zod schema.
 *
 * This is a focused converter for the schemas used by the Supabase MCP
 * server — it handles strings, numbers, booleans, arrays, objects,
 * enums, unions (anyOf), and optionality. It does NOT aim to be a
 * full JSON Schema → Zod converter.
 */
import type { SupaAgentTool } from '@supa-agent/core'
import { sanitizeUntrusted } from '@supa-agent/core'
import * as z from 'zod/v4'

import type { SupabaseMcpClient } from './SupabaseMcpClient'

export function jsonSchemaToZod(schema: unknown, required = true): z.ZodType {
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
 * MCP tools that mutate project/database state. Blocked unless MCP writes are
 * explicitly enabled by the user.
 */
const DESTRUCTIVE_TOOLS = new Set([
	'apply_migration',
	'delete_secrets',
	'delete_edge_function',
	'delete_branch',
	'pause_project',
	'restore_project',
	'reset_branch',
	'transfer_pgsodium_key',
	'export_vault_secrets',
])

const WRITE_TOOLS = new Set([
	...DESTRUCTIVE_TOOLS,
	'deploy_edge_function',
	'create_project',
	'create_branch',
	'merge_branch',
	'rebase_branch',
	'set_secrets',
	'insert',
	'update',
	'rpc',
])

const DESTRUCTIVE_SQL = /\b(drop|delete|truncate|alter|grant|revoke)\b/i
const WRITE_SQL =
	/\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|replace|merge)\b/i

function readSqlArg(args: unknown): string {
	const a = args as Record<string, unknown> | null
	if (!a) return ''
	return String(a.query ?? a.sql ?? '')
}

/** Classify an MCP call as a write and/or destructive operation. */
export function classifyMcpOp(
	name: string,
	args: unknown
): { write: boolean; destructive: boolean } {
	if (name === 'execute_sql') {
		const sql = readSqlArg(args)
		return { write: WRITE_SQL.test(sql), destructive: DESTRUCTIVE_SQL.test(sql) }
	}
	return { write: WRITE_TOOLS.has(name), destructive: DESTRUCTIVE_TOOLS.has(name) }
}

/** Minimal view of the agent `this` available inside a bound tool execute. */
interface AgentConfirmHost {
	onAskUser?: (question: string, options?: { signal?: AbortSignal }) => Promise<string>
	signal?: AbortSignal
}

/**
 * Convert a list of MCP tool definitions into SupaAgentTool objects.
 *
 * Each tool's execute calls back into the provided SupabaseMcpClient, gated by a
 * code-level safety check that is independent of the system prompt:
 * - Writes/destructive ops are blocked entirely unless `allowWrites` is true.
 * - Destructive ops additionally require an explicit runtime confirmation via the
 *   agent's `onAskUser` callback, even when writes are enabled. This survives a
 *   misconfigured toggle and prompt-injection attempts.
 */
export async function adaptMcpTools(
	client: SupabaseMcpClient,
	opts: { allowWrites?: boolean } = {}
): Promise<Record<string, SupaAgentTool>> {
	const allowWrites = opts.allowWrites ?? false
	const mcpTools = await client.listTools()
	const adapted: Record<string, SupaAgentTool> = {}

	for (const tool of mcpTools) {
		const inputSchema = jsonSchemaToZod(tool.inputSchema, true)
		const name = tool.name

		adapted[name] = {
			description: tool.description ?? '',
			inputSchema,
			// Regular function (not arrow) so `this` is the bound SupaAgentCore at call time.
			execute: async function (this: AgentConfirmHost, args: unknown): Promise<string> {
				const { write, destructive } = classifyMcpOp(name, args)

				if ((write || destructive) && !allowWrites) {
					return `Blocked: "${name}" is a write/destructive operation and MCP writes are disabled. Ask the user to enable "Allow MCP writes" in Settings, or accomplish the task read-only.`
				}

				if (destructive) {
					const ask = this?.onAskUser
					if (typeof ask !== 'function') {
						return `Blocked: destructive operation "${name}" requires explicit user confirmation, which is not available in this context. Call done and ask the user to perform it manually.`
					}
					const answer = await ask(
						`Confirm destructive Supabase operation "${name}"? Reply "yes" to proceed.`,
						{ signal: this?.signal }
					)
					if (!/^\s*(yes|y|confirm)\b/i.test(answer ?? '')) {
						return `Blocked: user did not confirm destructive operation "${name}".`
					}
				}

				const raw = await client.callTool(name, args as Record<string, unknown>)
				return `<mcp_result tool="${name}">\n${sanitizeUntrusted(raw)}\n</mcp_result>`
			},
		}
	}

	return adapted
}
