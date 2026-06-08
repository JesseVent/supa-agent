import { createClient } from 'jsr:@supabase/supabase-js@2'

// Returns decrypted vault secrets for migration purposes.
// Caller must present the project's service_role key as Bearer token.
// Agent-only admin tool — no CORS headers (never called from a browser page).
Deno.serve(async (req: Request) => {
	if (req.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	// Verify caller presents the service_role key — this is an admin-only endpoint
	const authHeader = req.headers.get('Authorization') ?? ''
	const bearerToken = authHeader.replace(/^Bearer\s+/i, '')
	const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

	if (!bearerToken || bearerToken !== serviceRoleKey) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
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

	return new Response(JSON.stringify({ secrets, count: secrets.length }), {
		headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
	})
})
