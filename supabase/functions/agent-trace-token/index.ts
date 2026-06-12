import { SignJWT } from 'npm:jose@5'

// Exchanges a Supabase Management API access token for a short-lived,
// project-scoped JWT usable with Realtime private channels and PostgREST.
//
// Why: the SupaAgent extension and the Supabase DevTool both authenticate with
// account-level Management OAuth (separate DCR client ids) — neither holds a
// project GoTrue session. Pairing is keyed on the *project ref*: the caller's
// token is validated by fetching `GET /v1/projects/{ref}` for THIS project, so
// only principals with Management API access to this project can mint a token.
// All of them share one deterministic auth.uid() (UUIDv5 of the project ref)
// and therefore one private topic agent-trace:{sha256(uid)}.
//
// Note: pairing used to be per platform user (gotrue_id from /v1/profile), but
// that endpoint rejects OAuth tokens ("GET /v1/profile does not support oauth
// access yet"), so the trust boundary is now project membership.
//
// Deploy with --no-verify-jwt (callers have no project JWT yet) and set
//   AGENT_TRACE_JWT_SECRET = the project's legacy JWT secret.
// Caveats:
//   * projects that revoked the legacy secret after migrating to asymmetric
//     signing keys cannot verify these HS256 tokens.
//   * self-hosted / local stacks must set AGENT_TRACE_PROJECT_REF explicitly
//     (SUPABASE_URL only carries the ref on hosted *.supabase.co domains).

const MGMT_API = 'https://api.supabase.com'
const TOKEN_TTL_SECONDS = 60 * 60 // 1 hour
// Fixed RFC 4122 namespace for deriving the trace identity from a project ref.
// Changing it changes every topic + user_id, orphaning persisted history.
const TRACE_UUID_NAMESPACE = 'f4a6b170-1c3e-4dcb-9d6f-2a8e5b7c0d91'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	})
}

function getProjectRef(): string | null {
	const explicit = Deno.env.get('AGENT_TRACE_PROJECT_REF')
	if (explicit) return explicit
	const url = Deno.env.get('SUPABASE_URL')
	if (!url) return null
	const host = new URL(url).hostname
	const match = host.match(/^([a-z0-9]{16,})\.supabase\.(co|in|red)$/)
	return match ? match[1] : null
}

/** RFC 4122 UUIDv5 (SHA-1, name-based). */
async function uuidV5(name: string, namespace: string): Promise<string> {
	const ns = namespace.replaceAll('-', '')
	const nsBytes = new Uint8Array(16)
	for (let i = 0; i < 16; i++) {
		nsBytes[i] = Number.parseInt(ns.slice(i * 2, i * 2 + 2), 16)
	}
	const nameBytes = new TextEncoder().encode(name)
	const data = new Uint8Array(nsBytes.length + nameBytes.length)
	data.set(nsBytes)
	data.set(nameBytes, nsBytes.length)
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', data))
	const b = hash.slice(0, 16)
	b[6] = (b[6] & 0x0f) | 0x50 // version 5
	b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
	const hex = Array.from(b)
		.map((x) => x.toString(16).padStart(2, '0'))
		.join('')
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders })
	}
	if (req.method !== 'POST') {
		return json(405, { error: 'method_not_allowed' })
	}

	const authHeader = req.headers.get('authorization') ?? ''
	if (!authHeader.toLowerCase().startsWith('bearer ')) {
		return json(401, {
			error: 'missing_token',
			message: 'Send the Supabase Management API access token as "Authorization: Bearer <token>".',
		})
	}

	const secret = Deno.env.get('AGENT_TRACE_JWT_SECRET')
	if (!secret) {
		return json(500, {
			error: 'not_configured',
			message:
				'AGENT_TRACE_JWT_SECRET is not set. Run: supabase secrets set AGENT_TRACE_JWT_SECRET="<project legacy JWT secret>".',
		})
	}

	const projectRef = getProjectRef()
	if (!projectRef) {
		return json(500, {
			error: 'not_configured',
			message:
				"Cannot determine this project's ref. Set AGENT_TRACE_PROJECT_REF as a function secret.",
		})
	}

	// Validate the caller's token by proving it grants Management API access to
	// THIS project. Works for both OAuth tokens (sbp_oauth_…) and PATs (sbp_…).
	const projectRes = await fetch(`${MGMT_API}/v1/projects/${projectRef}`, {
		headers: { Authorization: authHeader },
	})
	if (projectRes.status === 401) {
		return json(401, {
			error: 'invalid_management_token',
			message: 'Management API rejected the token (HTTP 401).',
		})
	}
	if (projectRes.status === 403 || projectRes.status === 404) {
		return json(403, {
			error: 'project_not_authorized',
			message: `The token is valid but has no Management API access to project ${projectRef}.`,
		})
	}
	if (!projectRes.ok) {
		return json(502, {
			error: 'upstream_error',
			message: `Management API project lookup failed (HTTP ${projectRes.status}).`,
		})
	}

	const userId = await uuidV5(projectRef, TRACE_UUID_NAMESPACE)

	const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
	const token = await new SignJWT({ role: 'authenticated', project_ref: projectRef })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(userId)
		.setAudience('authenticated')
		.setIssuer('supa-agent-trace')
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(new TextEncoder().encode(secret))

	return json(200, { token, expiresAt, userId })
})
