import { AGENT_TRACE_TOPIC_PREFIX } from './constants'

/**
 * SHA-256 hex digest via Web Crypto (available in browsers, workers and Node 20+).
 */
export async function sha256Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input)
	const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

/**
 * Derive the Realtime topic for a pairing scope.
 *
 * The scope id is the shared Supabase platform user id (gotrue_id) when both
 * sides are signed in, or a pre-shared token in fallback mode. It is hashed so
 * the raw id never appears as a public topic name.
 *
 * Must stay byte-identical to the SQL helper `public.agent_trace_topic(uuid)`:
 * 'agent-trace:' || encode(extensions.digest(lower(uid::text), 'sha256'), 'hex')
 */
export async function getChannelName(scopeId: string): Promise<string> {
	const scope = await sha256Hex(scopeId.trim().toLowerCase())
	return `${AGENT_TRACE_TOPIC_PREFIX}${scope}`
}
