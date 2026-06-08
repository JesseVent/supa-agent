import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const MCP_BASE_URL = 'https://mcp.supabase.com/mcp'
const TOKEN_KEY = 'SupaAgentMgmtToken'

/**
 * Lightweight MCP client for the hosted Supabase MCP server.
 *
 * Uses our existing OAuth token (stored in chrome.storage by background.ts)
 * and injects it via a custom fetch wrapper that auto-refreshes on 401.
 *
 * This avoids the full OAuthClientProvider lifecycle — our extension already
 * handles DCR + PKCE in background.ts, so we just consume the resulting
 * Bearer token here.
 */
export class SupabaseMcpClient {
	private projectRef: string
	private readOnly?: boolean
	private features?: string[]
	private client: Client | null = null
	private transport: StreamableHTTPClientTransport | null = null
	private _token: string | null = null
	private _tokenSource: 'oauth' | 'manual' = 'oauth'
	private _connecting: Promise<void> | null = null
	private _connected = false

	constructor(opts: {
		/** Project ref scopes the MCP connection. Omit for account-level tools (e.g. list_projects). */
		projectRef?: string
		readOnly?: boolean
		features?: string[]
		/** Explicit access token (e.g. manual PAT). When omitted, reads from chrome.storage. */
		accessToken?: string
	}) {
		this.projectRef = opts.projectRef ?? ''
		this.readOnly = opts.readOnly
		this.features = opts.features
		if (opts.accessToken) {
			this._token = opts.accessToken
			this._tokenSource = 'manual'
		}
	}

	/**
	 * Load the current Bearer token from chrome.storage (OAuth path).
	 */
	private async _loadToken(): Promise<string | null> {
		if (this._tokenSource === 'manual') return this._token
		const stored = await chrome.storage.local.get(TOKEN_KEY)
		this._token = (stored[TOKEN_KEY] as string) ?? null
		return this._token
	}

	/**
	 * Create a fetch wrapper that injects the Bearer token and auto-refreshes
	 * via the background script when a 401 is received.
	 *
	 * Manual tokens are NOT refreshed — if they expire, the caller must reconnect.
	 */
	private async _createAuthFetch(): Promise<typeof fetch> {
		await this._loadToken()

		return async (input, init?) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const headers = new Headers(init?.headers)
			if (this._token) {
				headers.set('Authorization', `Bearer ${this._token}`)
			} else if (this._tokenSource === 'oauth') {
				throw new Error('No OAuth token available — connect via Settings first')
			}

			let res = await fetch(url, { ...init, headers })

			// Auto-refresh only for OAuth tokens
			if (res.status === 401 && this._token && this._tokenSource === 'oauth') {
				console.log('[SupabaseMcpClient] Token expired (401), refreshing...')
				const refresh = await chrome.runtime.sendMessage({ type: 'MGMT_REFRESH_TOKEN' })
				if (refresh?.error) {
					throw new Error(`Token refresh failed: ${refresh.error}`)
				}
				if (refresh?.token) {
					this._token = refresh.token as string
					headers.set('Authorization', `Bearer ${this._token}`)
					res = await fetch(url, { ...init, headers })
				} else {
					throw new Error('Token refresh returned no token — please reconnect in Settings')
				}
			}

			// Some MCP endpoints return 200 with an error body containing auth failures
			if (!res.ok) {
				const body = await res.text().catch(() => '')
				if (body.includes('JWT failed verification')) {
					throw new Error(
						'JWT failed verification — the OAuth token is invalid. Disconnect and reconnect in Settings.'
					)
				}
				throw new Error(`MCP HTTP error (${res.status}): ${body}`)
			}

			return res
		}
	}

	/**
	 * Connect to the hosted MCP server. Safe to call multiple times —
	 * subsequent calls noop if already connected.
	 */
	async connect(): Promise<void> {
		if (this._connected) return
		if (this._connecting) return this._connecting

		this._connecting = this._doConnect()
		try {
			await this._connecting
			this._connected = true
		} finally {
			this._connecting = null
		}
	}

	private async _doConnect(): Promise<void> {
		const url = new URL(MCP_BASE_URL)
		if (this.projectRef) url.searchParams.set('project_ref', this.projectRef)
		if (this.readOnly) url.searchParams.set('read_only', 'true')
		if (this.features?.length) url.searchParams.set('features', this.features.join(','))

		const authFetch = await this._createAuthFetch()

		this.transport = new StreamableHTTPClientTransport(url, { fetch: authFetch })

		this.client = new Client({ name: 'supa-agent-ext', version: '1.8.2' })
		try {
			await this.client.connect(this.transport)
		} catch (err) {
			// Clean up so the next connect() attempt starts fresh
			try {
				await this.transport.close()
			} catch {
				// ignore
			}
			this.transport = null
			this.client = null
			this._connected = false
			throw err
		}
	}

	get isConnected(): boolean {
		return this._connected
	}

	/**
	 * Disconnect from the MCP server and clean up.
	 */
	async disconnect(): Promise<void> {
		try {
			await this.transport?.close()
		} catch {
			// ignore
		}
		this.transport = null
		this.client = null
		this._connected = false
	}

	/**
	 * List available tools from the MCP server.
	 */
	async listTools(): Promise<
		{
			name: string
			description?: string
			inputSchema: Record<string, unknown>
		}[]
	> {
		await this.connect()
		const result = await this.client!.listTools()
		return result.tools
	}

	/**
	 * Call an MCP tool by name with arguments.
	 * Returns the text content from the tool result.
	 */
	async callTool(name: string, args: Record<string, unknown>): Promise<string> {
		await this.connect()
		const result = await this.client!.callTool({ name, arguments: args })

		const content = result.content as { type: string; text?: string; data?: string }[]

		if (result.isError) {
			const text = content
				.filter((c): c is { type: 'text'; text: string } => c.type === 'text')
				.map((c) => c.text)
				.join('\n')
			throw new Error(text || `Tool "${name}" returned an error`)
		}

		const textParts = content
			.filter((c): c is { type: 'text'; text: string } => c.type === 'text')
			.map((c) => c.text)

		return textParts.join('\n')
	}
}
