import type { BrowserState, PageController } from '@supa-agent/page-controller'
import { vi } from 'vitest'
import SYSTEM_PROMPT from '../prompts/system_prompt.md?raw'
import { SupaAgentCore } from '../SupaAgentCore'
import type { AgentStepEvent, ExecutionResult } from '../types'
import { sanitizeUntrusted } from '../utils'
import type { EvalConfig, EvalResult, EvalScenario, MockLlmResponse, PromptPreview } from './types'

/**
 * Build a mock PageController that returns fixed browser state.
 *
 * Action methods (clickElement, inputText, etc.) return generic success messages
 * and can be spied on via vi.fn() for assertion.
 */
export function createMockPageController(scenario: EvalScenario): PageController {
	const url = scenario.url || 'https://example.com'
	const title = scenario.title || 'Test Page'
	const html = scenario.html

	let currentUrl = url

	const mock = {
		showMask: vi.fn().mockResolvedValue(undefined),
		hideMask: vi.fn(),
		cleanUpHighlights: vi.fn(),
		dispose: vi.fn(),
		getLastUpdateTime: vi.fn().mockReturnValue(Date.now()),
		getBrowserState: vi.fn().mockImplementation((): BrowserState => {
			const pi = {
				viewport_width: 1920,
				viewport_height: 1080,
				page_width: 1920,
				page_height: 1080,
				pixels_above: 0,
				pixels_below: 0,
				pages_above: 0,
				pages_below: 0,
				total_pages: 1,
				current_page_position: 0,
			}
			const titleLine = `Current Page: [${title}](${currentUrl})`
			const pageInfoLine = `Page info: ${pi.viewport_width}x${pi.viewport_height}px viewport, ${pi.page_width}x${pi.page_height}px total page size, ${pi.pages_above.toFixed(1)} pages above, ${pi.pages_below.toFixed(1)} pages below, ${pi.total_pages.toFixed(1)} total pages, at ${(pi.current_page_position * 100).toFixed(0)}% of page`
			const elementsLabel =
				'Interactive elements from top layer of the current page inside the viewport:'
			return {
				url: currentUrl,
				title,
				header: `${titleLine}\n${pageInfoLine}\n\n${elementsLabel}\n\n[Start of page]`,
				content: html,
				footer: '[End of page]',
			}
		}),
		clickElement: vi.fn().mockImplementation(async (index: number) => {
			return {
				success: true,
				message: `Done: Clicked element ${index}`,
			}
		}),
		inputText: vi.fn().mockResolvedValue({
			success: true,
			message: 'Done: Input text',
		}),
		selectOption: vi.fn().mockResolvedValue({
			success: true,
			message: 'Done: Selected option',
		}),
		scroll: vi.fn().mockResolvedValue({
			success: true,
			message: 'Done: Scrolled',
		}),
		scrollHorizontally: vi.fn().mockResolvedValue({
			success: true,
			message: 'Done: Scrolled horizontally',
		}),
		executeJavascript: vi.fn().mockResolvedValue({
			success: true,
			message: 'Done: Executed JavaScript',
		}),
		navigateTo: vi.fn().mockImplementation(async (targetUrl: string) => {
			currentUrl = targetUrl
			return {
				success: true,
				message: `Navigating to ${targetUrl}`,
			}
		}),
		goBack: vi.fn().mockResolvedValue({
			success: true,
			message: 'Navigated back',
		}),
	}

	return mock as unknown as PageController
}

/**
 * Build a deterministic mock fetch for customFetch that drives the agent
 * using pre-defined tool responses.
 */
export function createMockLlmFetch(responses: MockLlmResponse[]) {
	const queue = [...responses]
	return vi.fn().mockImplementation(async (_url: string, init: any) => {
		const next = queue.shift()
		if (!next) {
			throw new Error('Mock LLM queue exhausted')
		}

		const body = JSON.parse(init.body)
		// Echo back the model from the request so validation passes
		const model = body.model || 'test-model'

		return {
			ok: true,
			status: 200,
			json: async () => ({
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							tool_calls: [
								{
									id: 'call_1',
									type: 'function',
									function: {
										name: 'AgentOutput',
										arguments: JSON.stringify({
											evaluation_previous_goal:
												next.reflection?.evaluation_previous_goal || 'eval',
											memory: next.reflection?.memory || 'memory',
											next_goal: next.reflection?.next_goal || 'next goal',
											action: { [next.tool]: next.args },
										}),
									},
								},
							],
						},
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 10,
					total_tokens: 20,
				},
				model,
			}),
		} as Response
	})
}

/**
 * Run a single eval scenario.
 *
 * Supports two modes:
 * 1. **Deterministic**: `scenario.mockLlmResponses` is set — uses mocked LLM.
 * 2. **Real LLM**: `config.llmConfig` is set AND `scenario.mockLlmResponses` is empty.
 *
 * Returns the full {@link EvalResult} including history and assertion outcome.
 */
export async function runScenario(
	scenario: EvalScenario,
	config: EvalConfig = {}
): Promise<EvalResult> {
	const start = performance.now()
	const pageController = createMockPageController(scenario)

	const isDeterministic = !!scenario.mockLlmResponses?.length
	const customFetch = isDeterministic ? createMockLlmFetch(scenario.mockLlmResponses!) : undefined

	const baseConfig = isDeterministic
		? {
				baseURL: 'http://localhost:1/v1',
				apiKey: 'test-key',
				model: 'test-model',
			}
		: config.llmConfig || {
				baseURL: 'http://localhost:1/v1',
				apiKey: 'test-key',
				model: 'test-model',
			}

	const agent = new SupaAgentCore({
		...baseConfig,
		pageController,
		customFetch,
		maxSteps: scenario.maxSteps ?? 5,
		stepDelay: config.stepDelay ?? 0,
		customSystemPrompt: scenario.customSystemPrompt,
		customTools: scenario.customTools,
	})

	let result: ExecutionResult

	try {
		result = await agent.execute(scenario.task)
	} catch (error) {
		result = {
			success: false,
			data: String(error),
			history: [],
		}
	}

	agent.dispose()

	const assertResult = scenario.assert(result.history)
	const duration = Math.round(performance.now() - start)

	return {
		name: scenario.name,
		passed: assertResult.pass,
		message: assertResult.message,
		executionResult: result,
		duration,
	}
}

/**
 * Extract the exact prompt that would be sent to the LLM for a scenario,
 * without calling the LLM.
 *
 * This is useful for rapid prompt iteration — you can inspect the assembled
 * system + user prompt and manually reason about whether the LLM will
 * choose the right action.
 */
export async function extractPrompt(scenario: EvalScenario): Promise<PromptPreview> {
	const system =
		scenario.customSystemPrompt || SYSTEM_PROMPT.replaceAll('{{LANGUAGE}}', 'English')

	const url = scenario.url || 'https://example.com'
	const title = scenario.title || 'Test Page'
	const html = scenario.html
	const maxSteps = scenario.maxSteps ?? 40

	const pi = {
		viewport_width: 1920,
		viewport_height: 1080,
		page_width: 1920,
		page_height: 1080,
		pixels_above: 0,
		pixels_below: 0,
		pages_above: 0,
		pages_below: 0,
		total_pages: 1,
		current_page_position: 0,
	}
	const titleLine = `Current Page: [${title}](${url})`
	const pageInfoLine = `Page info: ${pi.viewport_width}x${pi.viewport_height}px viewport, ${pi.page_width}x${pi.page_height}px total page size, ${pi.pages_above.toFixed(1)} pages above, ${pi.pages_below.toFixed(1)} pages below, ${pi.total_pages.toFixed(1)} total pages, at ${(pi.current_page_position * 100).toFixed(0)}% of page`
	const elementsLabel =
		'Interactive elements from top layer of the current page inside the viewport:'
	const header = `${titleLine}\n${pageInfoLine}\n\n${elementsLabel}\n\n[Start of page]`
	const footer = '[End of page]'

	let user = ''
	user += '<agent_state>\n'
	user += '<user_request>\n'
	user += `${scenario.task}\n`
	user += '</user_request>\n'
	user += '<step_info>\n'
	user += `Step 1 of ${maxSteps} max possible steps\n`
	user += `Current time: ${new Date().toLocaleString()}\n`
	user += '</step_info>\n'
	user += '</agent_state>\n\n'

	user += '<agent_history>\n'
	user += '</agent_history>\n\n'

	user += '<browser_state>\n'
	user += `${sanitizeUntrusted(header)}\n`
	user += `${sanitizeUntrusted(html)}\n`
	user += `${sanitizeUntrusted(footer)}\n\n`
	user += '</browser_state>\n\n'

	return { system, user }
}

/**
 * Run a single-step prompt eval against a **real LLM**.
 *
 * The agent executes exactly one step then stops, allowing you to test
 * the prompt in isolation without running a full multi-step loop.
 *
 * Requires `config.llmConfig`.
 */
export async function runPromptEval(
	scenario: EvalScenario,
	config: EvalConfig
): Promise<AgentStepEvent | null> {
	if (!config.llmConfig) {
		throw new Error('runPromptEval requires config.llmConfig')
	}

	const pageController = createMockPageController(scenario)

	const agent = new SupaAgentCore({
		...config.llmConfig,
		pageController,
		maxSteps: 100,
		stepDelay: 0,
		customSystemPrompt: scenario.customSystemPrompt,
		customTools: scenario.customTools,
	})

	let capturedStep: AgentStepEvent | null = null

	// Hook into afterStep to capture the first step and immediately stop
	const originalOnAfterStep = agent.config.onAfterStep
	agent.config.onAfterStep = async (self, history) => {
		await originalOnAfterStep?.(self, history)
		const step = history.findLast((e): e is AgentStepEvent => e.type === 'step')
		if (step && !capturedStep) {
			capturedStep = step
			self.stop()
		}
	}

	try {
		await agent.execute(scenario.task)
	} catch {
		// Expected — stop() causes an abort error
	}

	agent.dispose()
	return capturedStep
}
