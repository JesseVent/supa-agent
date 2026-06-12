import type { AgentReflection, ExecutionResult, HistoricalEvent } from '@supa-agent/bridge-events'
import type { LLMConfig } from '@supa-agent/llms'

// @note circular dependency but okay
import type { SupaAgentCore } from './SupaAgentCore'
import type { SupaAgentTool } from './tools'

// Shared trace/event contract — the source of truth lives in @supa-agent/bridge-events
// so external viewers (e.g. the Supabase DevTool) consume identical types.
export type {
	AgentActivity,
	AgentErrorEvent,
	AgentReflection,
	AgentStatus,
	AgentStepEvent,
	ExecutionResult,
	HistoricalEvent,
	ObservationEvent,
	RetryEvent,
	UserTakeoverEvent,
} from '@supa-agent/bridge-events'

/** Supported UI languages */
export type SupportedLanguage = 'en-US'

export interface SkillRouterChunk {
	id: string
	title: string
	content: string
	impact: string
	relevance_reason: string
}

export interface SkillRouterResult {
	request_id: string
	chunks: SkillRouterChunk[]
}

/**
 * Minimal interface for dynamic skill context injection.
 * Implemented by `SkillRouterClient.asAdapter(skill_name)` from @supa-agent/skill-router.
 */
export interface SkillRouterAdapter {
	route(task: string): Promise<SkillRouterResult>
	feedback(request_id: string, outcome: 'success' | 'failure'): Promise<void>
}

export interface AgentConfig extends LLMConfig {
	language?: SupportedLanguage

	/**
	 * Maximum number of steps the agent can take per task.
	 * @default 40
	 */
	maxSteps?: number

	/**
	 * Custom tools to extend SupaAgent capabilities
	 * @experimental
	 * @note You can also override or remove internal tools by using the same name.
	 * @see SupaAgentTool
	 *
	 * @example
	 * // override internal tool
	 * import { z } from 'zod/v4'
	 * import { tool } from 'supa-agent'
	 * const customTools = {
	 * ask_user: tool({
	 * 	description:
	 * 		'Ask the user or parent model a question and wait for their answer. Use this if you need more information or clarification.',
	 * 	inputSchema: z.object({
	 * 		question: z.string(),
	 * 	}),
	 * 	execute: async function (this: SupaAgent, input) {
	 * 		const answer = await do_some_thing(input.question)
	 * 		return "Done: Received user answer: " + answer
	 * 	},
	 * })
	 * }
	 *
	 * @example
	 * // remove internal tool
	 * const customTools = {
	 * 	ask_user: null // never ask user questions
	 * }
	 */
	customTools?: Record<string, SupaAgentTool | null>

	/**
	 * Instructions to guide the agent's behavior
	 */
	instructions?: {
		/**
		 * Global system-level instructions, applied to all tasks
		 */
		system?: string

		/**
		 * Dynamic page-level instructions callback
		 * Called before each step to get instructions for the current page
		 * @param url - Current page URL (window.location.href)
		 * @returns Instructions string, or undefined/null to skip
		 */
		getPageInstructions?: (url: string) => string | undefined | null
	}

	/**
	 * Lifecycle hooks for task execution.
	 * @experimental API may change in future versions.
	 *
	 * All hooks receive the agent instance as first parameter.
	 */

	/**
	 * Called before each step execution.
	 * @experimental
	 * @param agent - The SupaAgentCore instance
	 * @param stepCount - Current step number (0-indexed)
	 */
	onBeforeStep?: (agent: SupaAgentCore, stepCount: number) => Promise<void> | void

	/**
	 * Called after each step execution.
	 * @experimental
	 * @param agent - The SupaAgentCore instance
	 * @param history - Current history of events
	 */
	onAfterStep?: (agent: SupaAgentCore, history: HistoricalEvent[]) => Promise<void> | void

	/**
	 * Called before task execution starts.
	 * @experimental
	 * @param agent - The SupaAgentCore instance
	 */
	onBeforeTask?: (agent: SupaAgentCore) => Promise<void> | void

	/**
	 * Called after task execution completes (success or failure).
	 * @experimental
	 * @param agent - The SupaAgentCore instance
	 * @param result - The execution result
	 */
	onAfterTask?: (agent: SupaAgentCore, result: ExecutionResult) => Promise<void> | void

	/**
	 * Called when the agent is disposed.
	 * @experimental
	 * @note This hook can block the disposal process if it's async.
	 * @param agent - The SupaAgentCore instance
	 * @param reason - Optional reason for disposal
	 */
	onDispose?: (agent: SupaAgentCore, reason?: string) => void

	// page behavior hooks

	/**
	 * @experimental
	 * Enable the experimental script execution tool that allows executing generated JavaScript code on the page.
	 * @note Can cause unpredictable side effects.
	 * @note May bypass some safe guards and data-masking mechanisms.
	 */
	experimentalScriptExecutionTool?: boolean

	/**
	 * @experimental
	 * Fetch /llms.txt from current site origin and include as context.
	 * Only fetched once per origin per task.
	 * @default false
	 */
	experimentalLlmsTxt?: boolean

	/**
	 * Transform page content before sending to LLM.
	 * Called after DOM extraction and simplification, before LLM invocation.
	 * Use cases: inspect extraction results, modify page info, mask sensitive data.
	 *
	 * @param content - Simplified page content that will be sent to LLM
	 * @returns Transformed content
	 *
	 * @example
	 * // Mask phone numbers
	 * transformPageContent: async (content) => {
	 *   return content.replace(/1[3-9]\d{9}/g, '***********')
	 * }
	 */
	transformPageContent?: (content: string) => Promise<string> | string

	/**
	 * Completely override the default system prompt.
	 * @experimental Use with caution - incorrect prompts may break agent behavior.
	 */
	customSystemPrompt?: string

	/**
	 * Delay between steps in seconds.
	 * @default 0.4
	 */
	stepDelay?: number

	/**
	 * Skill router for dynamic context retrieval.
	 * When set, routes each task to find relevant skill chunks and injects them as context
	 * before every LLM call. Feedback (success/failure) is sent automatically at task end.
	 *
	 * @example
	 * import { SkillRouterClient } from '@supa-agent/skill-router'
	 * const client = new SkillRouterClient(supabaseUrl, anonKey)
	 * const agent = new SupaAgent({ skillRouter: client.asAdapter('my-skill') })
	 */
	skillRouter?: SkillRouterAdapter
}

/**
 * MacroTool input structure
 *
 * This is the core abstraction that enforces the "reflection-before-action" mental model.
 * Before executing any action, the LLM must output its reasoning state.
 */
export interface MacroToolInput extends Partial<AgentReflection> {
	action: Record<string, any>
}

/**
 * MacroTool output structure
 */
export interface MacroToolResult {
	input: MacroToolInput
	output: string
}
