import {
	AGENT_TRACE_EVENTS_TABLE,
	AGENT_TRACE_TOKEN_FUNCTION,
	type BridgeAction,
	getChannelName,
} from '@supa-agent/bridge-events'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'
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
 * the `agent-trace-token` edge function (sub = shared platform user id), then
 * feeds it to supabase-js through the `accessToken` callback so PostgREST and
 * Realtime stay in sync.
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

		try {
			const { userId } = await this.getToken()
			const client = this.getClient()
			const topic = await getChannelName(userId)

			// Rejoin fresh each run so presence reflects the current run only.
			if (this.channel) {
				await this.client?.removeChannel(this.channel)
				this.channel = null
			}
			const channel = client.channel(topic, { config: { private: true } })
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
					// Presence is best-effort; inserts still broadcast via the DB trigger.
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

	private getClient(): SupabaseClient {
		if (!this.client) {
			this.client = createClient(this.supabaseUrl, this.anonKey, {
				auth: { persistSession: false, autoRefreshToken: false },
				// Single source of auth for PostgREST + Realtime; re-mints near expiry.
				accessToken: async () => (await this.getToken()).token,
			})
		}
		return this.client
	}

	private async flush(): Promise<void> {
		if (this.flushing) return
		this.flushing = true
		try {
			while (this.queue.length > 0) {
				const item = this.queue[0]
				const ok = await this.insertWithRetry(item)
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
			this.lastError = error.message
			if (attempt < MAX_INSERT_ATTEMPTS) {
				await sleep(250 * 2 ** (attempt - 1))
			} else {
				this.state = 'error'
				this.warn(`insert failed after ${MAX_INSERT_ATTEMPTS} attempts`, error.message)
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
		return this.mintPromise
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
		const stored = await chrome.storage.local.get(MGMT_TOKEN_KEY)
		return (stored[MGMT_TOKEN_KEY] as string) ?? null
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
