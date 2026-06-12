import { SignJWT } from 'npm:jose@5'

// Exchanges a Supabase Management API access token for a short-lived,
// project-scoped JWT usable with Realtime private channels and PostgREST.
//
// Why: the SupaAgent extension and the Supabase DevTool both authenticate with
// account-level Management OAuth (separate DCR client ids) — neither holds a
// project GoTrue session. Pairing is keyed on the *shared platform user id*
// (gotrue_id from /v1/profile), never the client id, so both apps derive the
// same auth.uid() and the same private topic agent-trace:{sha256(user_id)}.
//
// Deploy with --no-verify-jwt (callers have no project JWT yet) and set
//   AGENT_TRACE_JWT_SECRET = the project's legacy JWT secret.
// Caveat: projects that revoked the legacy secret after migrating to
// asymmetric signing keys cannot verify these HS256 tokens.

const PROFILE_URL = 'https://api.supabase.com/v1/profile'
const TOKEN_TTL_SECONDS = 60 * 60 // 1 hour
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

	// Validate the management token by resolving the caller's platform profile.
	const profileRes = await fetch(PROFILE_URL, {
		headers: { Authorization: authHeader },
	})
	if (!profileRes.ok) {
		return json(401, {
			error: 'invalid_management_token',
			message: `Management API rejected the token (HTTP ${profileRes.status}).`,
		})
	}

	const profile = (await profileRes.json()) as { gotrue_id?: string; id?: unknown }
	const userId = profile.gotrue_id
	if (!userId || !UUID_RE.test(userId)) {
		return json(422, {
			error: 'no_user_id',
			message: 'Management profile did not include a UUID gotrue_id; cannot derive auth.uid().',
		})
	}

	const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
	const token = await new SignJWT({ role: 'authenticated' })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(userId)
		.setAudience('authenticated')
		.setIssuer('supa-agent-trace')
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(new TextEncoder().encode(secret))

	return json(200, { token, expiresAt, userId })
})
