/**
 * Shared agent trace event contract.
 *
 * These types are the single source of truth for the events the SupaAgent
 * extension publishes (via window.postMessage and/or Supabase Realtime) and
 * viewers such as the Supabase DevTool consume. The action names are a stable
 * wire contract — do not rename them.
 */

/**
 * Agent execution status
 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

/**
 * Agent activity - transient state for immediate UI feedback.
 *
 * Unlike historical events (which are persisted), activities are ephemeral
 * and represent "what the agent is doing right now". UI components should
 * listen to 'activity' events to show real-time feedback.
 *
 * Note: There is no 'idle' activity - absence of activity events means idle.
 */
export type AgentActivity =
	| { type: 'thinking' }
	| { type: 'executing'; tool: string; input: unknown }
	| { type: 'executed'; tool: string; input: unknown; output: string; duration: number }
	| { type: 'retrying'; attempt: number; maxAttempts: number }
	| { type: 'error'; message: string }

/**
 * Reflection state the LLM must output before each action
 */
export interface AgentReflection {
	evaluation_previous_goal: string
	memory: string
	next_goal: string
}

/**
 * A single agent step with reflection and action
 */
export interface AgentStepEvent {
	type: 'step'
	stepIndex: number
	reflection: Partial<AgentReflection>
	action: {
		name: string
		input: any
		output: string
	}
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
		cachedTokens?: number
		reasoningTokens?: number
	}
	/** Raw LLM response for debugging */
	rawResponse?: unknown
	/** Raw LLM request for debugging */
	rawRequest?: unknown
}

/**
 * Persistent observation event (stays in memory)
 */
export interface ObservationEvent {
	type: 'observation'
	content: string
}

/**
 * User takeover event
 */
export interface UserTakeoverEvent {
	type: 'user_takeover'
}

/**
 * Retry event - LLM call is being retried
 */
export interface RetryEvent {
	type: 'retry'
	message: string
	attempt: number
	maxAttempts: number
}

/**
 * Error event - fatal error from LLM or execution
 */
export interface AgentErrorEvent {
	type: 'error'
	message: string
	rawResponse?: unknown
}

/**
 * Union type for all history events
 */
export type HistoricalEvent =
	| AgentStepEvent
	| ObservationEvent
	| UserTakeoverEvent
	| RetryEvent
	| AgentErrorEvent

export interface ExecutionResult {
	success: boolean
	data: string
	history: HistoricalEvent[]
}

/**
 * The four bridge actions. Stable wire contract — do not rename.
 */
export type BridgeAction =
	| 'status_change_event'
	| 'activity_event'
	| 'history_change_event'
	| 'execute_result'

/**
 * Discriminated { action, payload } pairs as they cross the bridge.
 * `execute_result` carries the final result on success or an error message.
 */
export type BridgeEvent =
	| { action: 'status_change_event'; payload: AgentStatus }
	| { action: 'activity_event'; payload: AgentActivity }
	| { action: 'history_change_event'; payload: HistoricalEvent[] }
	| { action: 'execute_result'; payload: ExecutionResult | { error: string } | unknown }

/**
 * Envelope persisted to `agent_trace_events` and broadcast over Realtime.
 * `seq` is monotonic per run so subscribers can order, dedupe and backfill.
 */
export interface TraceEventEnvelope {
	runId: string
	seq: number
	ts: number
	action: BridgeAction
	payload: unknown
}
