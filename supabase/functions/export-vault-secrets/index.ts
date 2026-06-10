import { createClient } from 'jsr:@supabase/supabase-js@2'

// Returns decrypted vault secrets for migration purposes.
// Caller must present the project's service_role key as Bearer token.
// Agent-only admin tool — no CORS headers (never called from a browser page).
//
// Security hardening (T-04):
//  1. Rejects publishable/anon keys (sb_publishable_ prefix or non-JWT anon key format).
//  2. Rate-limits to 1 successful call per minute per IP.
//  3. Writes an audit row on every successful export.

/** Simple in-process rate limiter: IP → last successful call timestamp (ms). */
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 60_000 // 1 call per minute per IP

/**
 * Heuristic: Supabase publishable keys start with "sb_publishable_".
 * Legacy anon JWT keys are long (~200 chars) but contain "anon" in their payload.
 * We explicitly block both patterns and only allow the service_role key match.
 */
function looksLikePublishableKey(token: string): boolean {
	return token.startsWith('sb_publishable_') || token.startsWith('sb_anon_')
}

function getCallerIp(req: Request): string {
	return (
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		req.headers.get('x-real-ip') ??
		'unknown'
	)
}

Deno.serve(async (req: Request) => {
	if (req.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const authHeader = req.headers.get('Authorization') ?? ''
	const bearerToken = authHeader.replace(/^Bearer\s+/i, '')
	const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

	// Reject before timing comparison if it looks like a publishable/anon key.
	if (looksLikePublishableKey(bearerToken)) {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	if (!bearerToken || bearerToken !== serviceRoleKey) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	// Per-IP rate limit: 1 successful call per minute.
	const callerIp = getCallerIp(req)
	const lastCall = rateLimitMap.get(callerIp) ?? 0
	const now = Date.now()
	if (now - lastCall < RATE_LIMIT_MS) {
		const retryAfterSecs = Math.ceil((RATE_LIMIT_MS - (now - lastCall)) / 1000)
		return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(retryAfterSecs),
			},
		})
	}

	const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, {
		auth: { persistSession: false },
	})

	const { data, error } = await supabase
		.schema('vault')
		.from('decrypted_secrets')
		.select('name, decrypted_secret, description')
		.order('name')

	if (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
		})
	}

	// Rename field for clarity in the migration payload
	const secrets = (data ?? []).map((row) => ({
		name: row.name,
		value: row.decrypted_secret,
		description: row.description ?? '',
	}))

	// Update rate limit tracker AFTER successful fetch.
	rateLimitMap.set(callerIp, Date.now())

	// Write audit row (fire-and-forget — don't fail the response if this fails).
	supabase
		.from('vault_secret_exports')
		.insert({ caller_ip: callerIp, secret_count: secrets.length })
		.then(({ error: auditErr }) => {
			if (auditErr) console.warn('[export-vault-secrets] Audit insert failed:', auditErr.message)
		})

	return new Response(JSON.stringify({ secrets, count: secrets.length }), {
		headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
	})
})
