import type { SupaAgentTool } from '../tools'
import type { ExecutionResult, HistoricalEvent } from '../types'

/**
 * Expected tool call assertion for deterministic evals.
 */
export interface ExpectedToolCall {
	/** Tool name */
	tool: string
	/** Expected arguments (partial match is enough) */
	args?: Record<string, any>
}

/**
 * A single eval scenario definition.
 *
 * Scenarios describe a starting browser state, a user task,
 * and assertions on the resulting agent behavior.
 */
export interface EvalScenario {
	/** Human-readable name */
	name: string
	/** User task */
	task: string
	/** Initial URL */
	url?: string
	/** Page title */
	title?: string
	/**
	 * Simplified HTML sent to the LLM as browser_state.content.
	 * Should use the same [index]<type> format the agent produces.
	 */
	html: string
	/** Optional custom system prompt to test */
	customSystemPrompt?: string
	/** Max steps before forcing termination */
	maxSteps?: number
	/**
	 * Pre-defined LLM responses for deterministic mode.
	 * Each response drives one step. When exhausted, the agent will error.
	 */
	mockLlmResponses?: MockLlmResponse[]
	/**
	 * Custom tools to inject into the agent for this scenario.
	 * Useful for testing MCP tools and other extensions.
	 */
	customTools?: Record<string, SupaAgentTool | null>
	/**
	 * Assertion function evaluated against the full history.
	 * Return {pass: true} to pass, {pass: false, message: '...'} to fail.
	 */
	assert: (history: HistoricalEvent[]) => EvalAssertion
}

/**
 * Pre-defined LLM response for deterministic evals.
 * Allows driving the agent loop without a real LLM.
 */
export interface MockLlmResponse {
	/** Tool to invoke */
	tool: string
	/** Tool arguments */
	args: Record<string, any>
	/** Reflection fields (optional) */
	reflection?: {
		evaluation_previous_goal?: string
		memory?: string
		next_goal?: string
	}
}

/**
 * Result of an eval assertion.
 */
export interface EvalAssertion {
	pass: boolean
	message?: string
}

/**
 * Configuration for running an eval.
 */
export interface EvalConfig {
	/** LLM configuration (required for real LLM mode) */
	llmConfig?: {
		baseURL: string
		apiKey: string
		model: string
	}
	/** Step delay in seconds (default: 0) */
	stepDelay?: number
}

/**
 * Result of running a single eval scenario.
 */
export interface EvalResult {
	name: string
	passed: boolean
	message?: string
	/** Full execution result from the agent */
	executionResult: ExecutionResult
	/** Duration in ms */
	duration: number
}

/**
 * Result of running a prompt-preview (no LLM call).
 */
export interface PromptPreview {
	system: string
	user: string
}
