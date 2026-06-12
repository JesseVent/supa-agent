import type { EvalScenario } from '../types'

/**
 * Navigation-focused eval scenarios.
 *
 * These test whether the agent:
 * - Uses `go_to_url` when asked to visit a specific URL
 * - Uses `go_back` when asked to return
 * - Clicks links correctly
 * - Handles URL changes gracefully
 */

export const navigationScenarios: EvalScenario[] = [
	{
		name: 'visit-google',
		task: 'Go to google.com',
		url: 'https://example.com',
		html: '[0]<button>Login</button>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			if (first.action?.name === 'go_to_url') {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected go_to_url, got ${first.action?.name} with args ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
	{
		name: 'visit-specific-url',
		task: 'Navigate to https://github.com/login',
		url: 'https://example.com',
		html: '[0]<button>Home</button>\n[1]<a>About</a>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			if (
				first.action?.name === 'go_to_url' &&
				first.action?.input?.url === 'https://github.com/login'
			) {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected go_to_url to https://github.com/login, got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
	{
		name: 'go-back-after-navigation',
		task: 'Go back to the previous page',
		url: 'https://example.com/products',
		html: '[0]<button>Add to cart</button>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			if (first.action?.name === 'go_back') {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected go_back, got ${first.action?.name}`,
			}
		},
	},
	{
		name: 'click-internal-link',
		task: 'Click the About link',
		url: 'https://example.com',
		html: '[0]<button>Home</button>\n[1]<a>About</a>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			if (
				first.action?.name === 'click_element_by_index' &&
				first.action?.input?.index === 1
			) {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected click_element_by_index(1), got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
	{
		name: 'do-not-click-target-blank',
		task: 'Click the external link',
		url: 'https://example.com',
		html: '[0]<button>Stay here</button>\n[1]<a target="_blank">External</a>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			// The agent should NOT click the target=_blank link.
			// It should either use go_to_url, ask_user, or done with a warning.
			if (
				first.action?.name === 'click_element_by_index' &&
				first.action?.input?.index === 1
			) {
				return {
					pass: false,
					message: 'Agent incorrectly clicked a target=_blank link',
				}
			}
			// Any other action is acceptable
			return { pass: true }
		},
	},
	{
		name: 'prefer-go-to-url-over-click',
		task: 'Visit the pricing page',
		url: 'https://example.com',
		html: '[0]<nav>\n\t[1]<a>Pricing</a>\n\t[2]<a>Docs</a>\n\t[3]<a>Contact</a>\n</nav>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			// Both click_element_by_index(1) and go_to_url are valid,
			// but we encourage go_to_url when the user explicitly asks to "visit".
			// For this eval we accept either.
			if (
				first.action?.name === 'go_to_url' ||
				(first.action?.name === 'click_element_by_index' &&
					first.action?.input?.index === 1)
			) {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected go_to_url or click_element_by_index(1), got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
]

/**
 * Deterministic navigation scenarios — these use mock LLM responses
 * and are guaranteed to pass as long as the agent loop mechanics work.
 */
export const deterministicNavigationScenarios: EvalScenario[] = [
	{
		name: 'det-navigate-and-done',
		task: 'Go to google.com',
		url: 'https://example.com',
		html: '[0]<button>Login</button>',
		mockLlmResponses: [
			{
				tool: 'go_to_url',
				args: { url: 'https://google.com' },
				reflection: {
					evaluation_previous_goal: '',
					memory: 'Need to navigate to Google',
					next_goal: 'Navigate to google.com',
				},
			},
			{
				tool: 'done',
				args: { text: 'Arrived at Google', success: true },
				reflection: {
					evaluation_previous_goal: 'Successfully navigated to Google',
					memory: 'Now on Google homepage',
					next_goal: 'Finish task',
				},
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 2) {
				return {
					pass: false,
					message: `Expected 2 steps, got ${steps.length}`,
				}
			}
			const navStep = steps[0] as any
			const doneStep = steps[1] as any
			if (navStep.action?.name !== 'go_to_url') {
				return {
					pass: false,
					message: `Expected first step to be go_to_url, got ${navStep.action?.name}`,
				}
			}
			if (doneStep.action?.name !== 'done') {
				return {
					pass: false,
					message: `Expected second step to be done, got ${doneStep.action?.name}`,
				}
			}
			return { pass: true }
		},
	},
	{
		name: 'det-click-navigates',
		task: 'Click the Products link',
		url: 'https://example.com',
		html: '[0]<button>Home</button>\n[1]<a>Products</a>',
		mockLlmResponses: [
			{
				tool: 'click_element_by_index',
				args: { index: 1 },
			},
			{
				tool: 'done',
				args: { text: 'Clicked Products', success: true },
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 2) {
				return { pass: false, message: `Expected 2 steps, got ${steps.length}` }
			}
			const clickStep = steps[0] as any
			if (clickStep.action?.name !== 'click_element_by_index') {
				return {
					pass: false,
					message: `Expected click, got ${clickStep.action?.name}`,
				}
			}
			return { pass: true }
		},
	},
	{
		name: 'det-go-back-recovery',
		task: 'Go back',
		url: 'https://example.com/profile',
		html: '[0]<h1>Profile Page</h1>',
		mockLlmResponses: [
			{
				tool: 'go_back',
				args: {},
			},
			{
				tool: 'done',
				args: { text: 'Went back', success: true },
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 2) {
				return { pass: false, message: `Expected 2 steps, got ${steps.length}` }
			}
			const backStep = steps[0] as any
			if (backStep.action?.name !== 'go_back') {
				return {
					pass: false,
					message: `Expected go_back, got ${backStep.action?.name}`,
				}
			}
			return { pass: true }
		},
	},
]
