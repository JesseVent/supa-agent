import {
	AGENT_TRACE_EVENTS_TABLE,
	AGENT_TRACE_TOKEN_FUNCTION,
	type BridgeAction,
	getChannelName,
	type TraceEventEnvelope,
} from '@supa-agent/bridge-events'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'
const USER_AUTH_TOKEN_KEY = 'SupaAgentExtUserAuthToken'
/** Re-mint the project JWT this long before it actually expires. */
const TOKEN_SLACK_SECONDS = 120
/** Serialized payloads above this size are truncated before persisting. */
const MAX_PAYLOAD_CHARS = 32_000
const MAX_INSERT_ATTEMPTS = 3

interface MintedToken {
	token: string
	expiresAt: number
	userId: string
}

export type PublisherState = 'idle' | 'connecting' | 'live' | 'error'

/**
 * 'persist': signed-in path — INSERT rows, DB trigger broadcasts on the
 *            private user topic (replay-capable).
 * 'broadcast': fallback when no Management OAuth token / token exchange fails —
 *            direct channel.send() on a public topic derived from the
 *            extension's pre-shared user auth token. Live only, no persistence.
 */
type PublishMode = 'persist' | 'broadcast'

/**
 * Publishes agent trace events to the connected Supabase project so remote
 * viewers (e.g. the Supabase DevTool) can render a live trace from any tab
 * or device.
 *
 * Transport design (see supa-agent#2): single write path — every event is
 * INSERTed into `agent_trace_events`; a database trigger broadcasts it to the
 * private Realtime topic `agent-trace:{sha256(userId)}` via realtime.send().
 * That guarantees persistence ⊇ broadcast and DB-side ordering. The websocket
 * channel is joined only for Presence ("agent online" + active run).
 *
 * Auth: exchanges the Management OAuth token for a short-lived project JWT via
 * the `agent-trace-token` edge function (sub = deterministic project-scoped
 * UUID; the function validates the caller has Management API access to the
 * project), then feeds it to supabase-js through the `accessToken` callback so
 * PostgREST and Realtime stay in sync.
 *
 * Publishing must never break the agent loop: failures are surfaced through
 * `state`/`lastError` and console warnings, not thrown into callers.
 */
export class RealtimeTracePublisher {
	private supabaseUrl: string
	private anonKey: string
	private client: SupabaseClient | null = null
	private channel: RealtimeChannel | null = null
	private minted: MintedToken | null = null
	private mintPromise: Promise<MintedToken> | null = null

	private runId: string | null = null
	private seq = 0
	private queue: { seq: number; action: BridgeAction; payload: unknown }[] = []
	private flushing = false
	private mode: PublishMode = 'persist'

	state: PublisherState = 'idle'
	lastError: string | null = null

	constructor(opts: { supabaseUrl: string; anonKey: string }) {
		this.supabaseUrl = opts.supabaseUrl.replace(/\/$/, '')
		this.anonKey = opts.anonKey
	}

	/** Begin a new run: mint identity, join the presence channel, reset seq. */
	async startRun(): Promise<string> {
		this.runId = crypto.randomUUID()
		this.seq = 0
		this.queue = []
		this.state = 'connecting'
		this.lastError = null

		let topic: string
		try {
			const { userId } = await this.getToken()
			this.mode = 'persist'
			topic = await getChannelName(userId)
		} catch (err) {
			// No project JWT possible — fall back to direct broadcast on a public
			// topic derived from the pre-shared extension auth token.
			const fallbackToken = await this.loadUserAuthToken()
			if (!fallbackToken) {
				this.state = 'error'
				this.warn('startRun failed (no OAuth token and no fallback token)', err)
				return this.runId
			}
			this.mode = 'broadcast'
			topic = await getChannelName(fallbackToken)
			this.warn('using public-channel fallback (live only, no persistence)', err)
		}

		try {
			const client = this.getClient()

			// Rejoin fresh each run so presence reflects the current run only.
			if (this.channel) {
				await this.client?.removeChannel(this.channel)
				this.channel = null
			}
			const channel = client.channel(topic, {
				config: { private: this.mode === 'persist' },
			})
			this.channel = channel
			channel.subscribe((status, err) => {
				if (status === 'SUBSCRIBED') {
					this.state = 'live'
					void channel.track({
						runId: this.runId,
						status: 'running',
						startedAt: Date.now(),
					})
				} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					// Presence is best-effort; persist-mode events still broadcast
					// via the DB trigger.
					this.warn(`presence channel ${status}`, err)
				}
			})
		} catch (err) {
			this.state = 'error'
			this.warn('startRun failed', err)
		}
		return this.runId
	}

	/**
	 * Queue an event for publication. Synchronously assigns the per-run `seq`
	 * (ordering), then flushes in the background. Never throws.
	 */
	publish(action: BridgeAction, payload: unknown): void {
		if (!this.runId) return
		this.queue.push({ seq: this.seq++, action, payload: capPayload(payload) })
		void this.flush()
	}

	/** Finish the run: flush remaining events and update presence. */
	async endRun(status: 'completed' | 'error'): Promise<void> {
		await this.flush()
		try {
			await this.channel?.track({ runId: this.runId, status, endedAt: Date.now() })
			await this.channel?.untrack()
		} catch {
			// presence is best-effort
		}
		this.runId = null
	}

	/** Tear down the websocket and client (config change / unmount). */
	async dispose(): Promise<void> {
		this.runId = null
		this.queue = []
		if (this.channel && this.client) {
			await this.client.removeChannel(this.channel).catch(() => {})
		}
		this.channel = null
		this.client?.realtime.disconnect()
		this.client = null
		this.state = 'idle'
	}

	private clientMode: PublishMode | null = null

	private getClient(): SupabaseClient {
		if (!this.client || this.clientMode !== this.mode) {
			this.client?.realtime.disconnect()
			this.clientMode = this.mode
			this.client =
				this.mode === 'persist'
					? createClient(this.supabaseUrl, this.anonKey, {
							auth: { persistSession: false, autoRefreshToken: false },
							// agent_trace_events lives in `public`, which is not necessarily
							// the project's default Data API schema (e.g. projects exposing
							// `api` first) — target it explicitly.
							db: { schema: 'public' },
							// Single source of auth for PostgREST + Realtime; re-mints near expiry.
							accessToken: async () => (await this.getToken()).token,
						})
					: // Broadcast fallback: anon key only, public channel.
						createClient(this.supabaseUrl, this.anonKey, {
							auth: { persistSession: false, autoRefreshToken: false },
						})

			if (this.mode === 'persist' && this.minted) {
				this.client.realtime.setAuth(this.minted.token)
			}
		}
		return this.client
	}

	private async flush(): Promise<void> {
		if (this.flushing) return
		this.flushing = true
		try {
			while (this.queue.length > 0) {
				const item = this.queue[0]
				const ok =
					this.mode === 'persist'
						? await this.insertWithRetry(item)
						: await this.sendWithRetry(item)
				if (!ok) {
					// Drop the event after exhausting retries — visible, not silent.
					this.warn(`dropping trace event seq=${item.seq} action=${item.action}`)
				}
				this.queue.shift()
			}
		} finally {
			this.flushing = false
		}
	}

	private async insertWithRetry(item: {
		seq: number
		action: BridgeAction
		payload: unknown
	}): Promise<boolean> {
		const { userId } = await this.getToken().catch(() => ({ userId: null }) as never)
		if (!userId || !this.runId) return false

		for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
			const { error } = await this.getClient().from(AGENT_TRACE_EVENTS_TABLE).insert({
				user_id: userId,
				run_id: this.runId,
				seq: item.seq,
				action: item.action,
				payload: item.payload,
			})
			if (!error) {
				if (this.state === 'error') this.state = 'live'
				return true
			}
			this.lastError = `insert seq=${item.seq}: ${error.code ?? ''} ${error.message}`
			console.warn(
				'[RealtimeTracePublisher] insert error:',
				error.code,
				error.message,
				error.details
			)
			if (attempt < MAX_INSERT_ATTEMPTS) {
				await sleep(250 * 2 ** (attempt - 1))
			} else {
				this.state = 'error'
				this.warn(`insert failed after ${MAX_INSERT_ATTEMPTS} attempts`, error.message)
			}
		}
		return false
	}

	/** Broadcast-mode delivery: channel.send (HTTP pre-subscribe, WS after). */
	private async sendWithRetry(item: {
		seq: number
		action: BridgeAction
		payload: unknown
	}): Promise<boolean> {
		if (!this.runId || !this.channel) return false
		const envelope: TraceEventEnvelope = {
			runId: this.runId,
			seq: item.seq,
			ts: Date.now(),
			action: item.action,
			payload: item.payload,
		}

		for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
			try {
				const res = await this.channel.send({
					type: 'broadcast',
					event: item.action,
					payload: envelope,
				})
				if (res === 'ok') {
					if (this.state === 'error') this.state = 'live'
					return true
				}
				this.lastError = `broadcast send: ${res}`
			} catch (err) {
				this.lastError = err instanceof Error ? err.message : String(err)
			}
			if (attempt < MAX_INSERT_ATTEMPTS) {
				await sleep(250 * 2 ** (attempt - 1))
			} else {
				this.state = 'error'
				this.warn(`broadcast failed after ${MAX_INSERT_ATTEMPTS} attempts`, this.lastError)
			}
		}
		return false
	}

	/** Mint (or reuse) the project JWT via the agent-trace-token edge function. */
	private async getToken(): Promise<MintedToken> {
		const now = Math.floor(Date.now() / 1000)
		if (this.minted && this.minted.expiresAt - now > TOKEN_SLACK_SECONDS) {
			return this.minted
		}
		if (!this.mintPromise) {
			this.mintPromise = this.mintToken().finally(() => {
				this.mintPromise = null
			})
		}
		const minted = await this.mintPromise
		this.client?.realtime.setAuth(minted.token)
		return minted
	}

	private async mintToken(): Promise<MintedToken> {
		let mgmtToken = await this.loadMgmtToken()
		if (!mgmtToken) {
			throw new Error('No Supabase OAuth token — connect a project in Settings first')
		}

		let res = await this.callTokenFunction(mgmtToken)
		// The management token may have expired — refresh once via background.
		if (res.status === 401) {
			const refresh = await chrome.runtime.sendMessage({ type: 'MGMT_REFRESH_TOKEN' })
			if (refresh?.token) {
				mgmtToken = refresh.token as string
				res = await this.callTokenFunction(mgmtToken)
			}
		}
		if (!res.ok) {
			const body = await res.text().catch(() => '')
			throw new Error(`agent-trace-token failed (${res.status}): ${sanitize(body)}`)
		}

		const minted = (await res.json()) as MintedToken
		if (!minted.token || !minted.userId) {
			throw new Error('agent-trace-token returned no token/userId')
		}
		this.minted = minted
		return minted
	}

	private callTokenFunction(mgmtToken: string): Promise<Response> {
		return fetch(`${this.supabaseUrl}/functions/v1/${AGENT_TRACE_TOKEN_FUNCTION}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${mgmtToken}`,
				apikey: this.anonKey,
			},
		})
	}

	private async loadMgmtToken(): Promise<string | null> {
		// Prefer the OAuth-managed token: the background refresh flow keeps it
		// fresh, while a manually pasted token in advancedConfig is static and
		// silently goes stale. The manual token is only a fallback for users
		// who never connected via OAuth.
		const stored = await chrome.storage.local.get(MGMT_TOKEN_KEY)
		const oauthToken = stored[MGMT_TOKEN_KEY] as string | undefined
		if (oauthToken) return oauthToken

		const config = await chrome.storage.local.get('advancedConfig')
		const manualToken = (config.advancedConfig as any)?.supabaseMcpAccessToken as
			| string
			| undefined
		return manualToken?.trim() || null
	}

	private async loadUserAuthToken(): Promise<string | null> {
		const stored = await chrome.storage.local.get(USER_AUTH_TOKEN_KEY)
		return (stored[USER_AUTH_TOKEN_KEY] as string) ?? null
	}

	private warn(message: string, detail?: unknown): void {
		this.lastError = detail instanceof Error ? detail.message : (this.lastError ?? message)
		console.warn(`[RealtimeTracePublisher] ${message}`, detail ?? '')
	}
}

/** Cap oversized payloads (page-derived content can be arbitrarily large). */
function capPayload(payload: unknown): unknown {
	try {
		const serialized = JSON.stringify(payload) ?? 'null'
		if (serialized.length <= MAX_PAYLOAD_CHARS) return payload
		return { __truncated: true, preview: serialized.slice(0, MAX_PAYLOAD_CHARS) }
	} catch {
		return { __truncated: true, preview: String(payload).slice(0, MAX_PAYLOAD_CHARS) }
	}
}

function sanitize(body: string): string {
	return body.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[token]').slice(0, 300)
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
