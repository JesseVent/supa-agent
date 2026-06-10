// Supabase Management API OAuth for browser extensions (DCR + PKCE).
// Registers its own OAuth client at runtime via RFC 7591 — no pre-registered
// app, no client secret. Runs entirely in the extension (background service
// worker or sidepanel — both expose crypto.subtle and chrome.identity).

const MGMT_API = 'https://api.supabase.com'

const DEFAULT_SCOPES =
	'projects:read projects:write organizations:read database:read database:write analytics:read secrets:read edge_functions:read edge_functions:write environment:read environment:write storage:read'

// ── PKCE ─────────────────────────────────────────────────────────────────────

export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
	const array = new Uint8Array(32)
	crypto.getRandomValues(array)
	const codeVerifier = btoa(String.fromCharCode(...array))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')

	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
	const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')

	return { codeVerifier, codeChallenge }
}

// ── Redirect URI (MV3-friendly) ──────────────────────────────────────────────

/**
 * Stable extension URL for the OAuth callback. Chrome's launchWebAuthFlow
 * intercepts this and hands the `?code=…` back to us as the redirect URL.
 */
export function getRedirectUri(): string {
	return chrome.identity.getRedirectURL('supabase')
}

// ── Dynamic Client Registration (RFC 7591) ───────────────────────────────────

export interface DynamicClient {
	client_id: string
	client_secret: string
	client_id_issued_at?: number
}

/**
 * Register a new public OAuth client for this extension. The result is cached
 * in chrome.storage so we only register once per browser install — the
 * service worker can be killed and restarted at any time in MV3, so the
 * client_id must persist.
 */
export async function registerDynamicClient(redirectUri: string): Promise<DynamicClient> {
	const res = await fetch(`${MGMT_API}/platform/oauth/apps/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_name: 'SupaAgent Extension',
			redirect_uris: [redirectUri],
			token_endpoint_auth_method: 'client_secret_post',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			scope: DEFAULT_SCOPES,
		}),
	})
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Dynamic client registration failed (${res.status}): ${text}`)
	}
	const data = (await res.json()) as {
		client_id: string
		client_secret: string
		client_id_issued_at?: number
	}
	if (!data.client_id) throw new Error('Registration response missing client_id')
	if (!data.client_secret) throw new Error('DCR response missing client_secret')
	return {
		client_id: data.client_id,
		client_secret: data.client_secret,
		client_id_issued_at: data.client_id_issued_at,
	}
}

// ── Authorize URL ────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(
	clientId: string,
	redirectUri: string,
	codeChallenge: string,
	state: string
): string {
	const url = new URL(`${MGMT_API}/v1/oauth/authorize`)
	url.searchParams.set('client_id', clientId)
	url.searchParams.set('redirect_uri', redirectUri)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('code_challenge', codeChallenge)
	url.searchParams.set('code_challenge_method', 'S256')
	url.searchParams.set('state', state)
	return url.toString()
}

// ── Token Exchange (direct — no client secret in DCR) ────────────────────────

export interface TokenResponse {
	accessToken: string
	refreshToken?: string
	expiresIn?: number
}

/**
 * Exchange the authorization code for an access token. With
 * `token_endpoint_auth_method: 'none'`, no client_secret is sent.
 */
export async function exchangeCode(
	clientId: string,
	code: string,
	codeVerifier: string,
	redirectUri: string,
	clientSecret?: string
): Promise<TokenResponse> {
	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		client_id: clientId,
		code,
		redirect_uri: redirectUri,
		code_verifier: codeVerifier,
	})
	if (clientSecret != null) params.set('client_secret', clientSecret)
	const res = await fetch(`${MGMT_API}/v1/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params,
	})
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Token exchange failed (${res.status}): ${text}`)
	}
	const data = await res.json()
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresIn: data.expires_in,
	}
}

export async function refreshAccessToken(
	clientId: string,
	refreshToken: string,
	clientSecret?: string
): Promise<TokenResponse> {
	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		client_id: clientId,
		refresh_token: refreshToken,
	})
	if (clientSecret != null) params.set('client_secret', clientSecret)
	const res = await fetch(`${MGMT_API}/v1/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params,
	})
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Token refresh failed (${res.status}): ${text}`)
	}
	const data = await res.json()
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresIn: data.expires_in,
	}
}

/**
 * Open the browser-level Supabase auth page. Returns the redirect URL on
 * success (contains `?code=…&state=…`) or null if the user closed the popup
 * or no result was returned.
 */
export async function launchAuthFlow(authorizeUrl: string): Promise<string | null> {
	try {
		const result = await chrome.identity.launchWebAuthFlow({
			url: authorizeUrl,
			interactive: true,
		})
		return result ?? null
	} catch (err) {
		if (err instanceof Error && /user closed|window closed/i.test(err.message)) return null
		throw err
	}
}

/** Extract the authorization `code` from a launchWebAuthFlow redirect URL. */
export function extractCode(redirectUrl: string): string {
	const url = new URL(redirectUrl)
	const code = url.searchParams.get('code')
	if (!code) {
		const err = url.searchParams.get('error_description') || url.searchParams.get('error')
		throw new Error(err || 'No authorization code in redirect URL')
	}
	return code
}
