import type { EvalScenario } from '../types'

/**
 * Form-interaction eval scenarios.
 *
 * These test whether the agent:
 * - Fills inputs using input_text
 * - Selects dropdown options
 * - Clicks submit buttons
 * - Handles multi-step form flows
 */

export const formScenarios: EvalScenario[] = [
	{
		name: 'fill-login-form',
		task: 'Log in with username "alice" and password "secret"',
		url: 'https://example.com/login',
		html: '[0]<label>Username</label>\n[1]<input placeholder="Username"/>\n[2]<label>Password</label>\n[3]<input type="password"/>\n[4]<button>Login</button>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const actions = steps.map((s: any) => ({
				name: s.action?.name,
				input: s.action?.input,
			}))

			const hasUsername = actions.some(
				(a) => a.name === 'input_text' && a.input?.text === 'alice'
			)
			const hasPassword = actions.some(
				(a) => a.name === 'input_text' && a.input?.text === 'secret'
			)
			const hasClick = actions.some(
				(a) => a.name === 'click_element_by_index' && a.input?.index === 4
			)

			if (!hasUsername) {
				return { pass: false, message: 'Did not input username "alice"' }
			}
			if (!hasPassword) {
				return { pass: false, message: 'Did not input password "secret"' }
			}
			if (!hasClick) {
				return { pass: false, message: 'Did not click Login button (index 4)' }
			}
			return { pass: true }
		},
	},
	{
		name: 'select-dropdown',
		task: 'Select "Premium" from the plan dropdown',
		url: 'https://example.com/settings',
		html: '[0]<label>Plan</label>\n[1]<select>\n\t<option>Free</option>\n\t<option>Basic</option>\n\t<option>Premium</option>\n</select>\n[2]<button>Save</button>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const first = steps[0] as any
			if (!first) return { pass: false, message: 'No step recorded' }
			if (
				first.action?.name === 'select_dropdown_option' &&
				first.action?.input?.index === 1 &&
				first.action?.input?.text === 'Premium'
			) {
				return { pass: true }
			}
			return {
				pass: false,
				message: `Expected select_dropdown_option on index 1 with "Premium", got ${first.action?.name} with ${JSON.stringify(first.action?.input)}`,
			}
		},
	},
	{
		name: 'fill-and-submit-contact-form',
		task: 'Fill the contact form with name="Bob", email="bob@example.com", message="Hi", and submit',
		url: 'https://example.com/contact',
		html: '[0]<label>Name</label>\n[1]<input/>\n[2]<label>Email</label>\n[3]<input/>\n[4]<label>Message</label>\n[5]<textarea></textarea>\n[6]<button>Send</button>',
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			const actions = steps.map((s: any) => ({
				name: s.action?.name,
				input: s.action?.input,
			}))

			const hasName = actions.some((a) => a.name === 'input_text' && a.input?.text === 'Bob')
			const hasEmail = actions.some(
				(a) => a.name === 'input_text' && a.input?.text === 'bob@example.com'
			)
			const hasMessage = actions.some(
				(a) => a.name === 'input_text' && a.input?.text === 'Hi'
			)
			const hasSubmit = actions.some(
				(a) => a.name === 'click_element_by_index' && a.input?.index === 6
			)

			if (!hasName) return { pass: false, message: 'Did not input name "Bob"' }
			if (!hasEmail) return { pass: false, message: 'Did not input email "bob@example.com"' }
			if (!hasMessage) return { pass: false, message: 'Did not input message "Hi"' }
			if (!hasSubmit) return { pass: false, message: 'Did not click Send button (index 6)' }
			return { pass: true }
		},
	},
]

/**
 * Deterministic form scenarios with pre-defined LLM responses.
 */
export const deterministicFormScenarios: EvalScenario[] = [
	{
		name: 'det-login-flow',
		task: 'Log in with username "alice" and password "secret"',
		url: 'https://example.com/login',
		html: '[0]<label>Username</label>\n[1]<input/>\n[2]<label>Password</label>\n[3]<input type="password"/>\n[4]<button>Login</button>',
		mockLlmResponses: [
			{
				tool: 'input_text',
				args: { index: 1, text: 'alice' },
			},
			{
				tool: 'input_text',
				args: { index: 3, text: 'secret' },
			},
			{
				tool: 'click_element_by_index',
				args: { index: 4 },
			},
			{
				tool: 'done',
				args: { text: 'Logged in successfully', success: true },
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 4) {
				return { pass: false, message: `Expected 4 steps, got ${steps.length}` }
			}
			const actions = steps.map((s: any) => s.action?.name)
			const expected = ['input_text', 'input_text', 'click_element_by_index', 'done']
			if (JSON.stringify(actions) !== JSON.stringify(expected)) {
				return {
					pass: false,
					message: `Expected actions ${JSON.stringify(expected)}, got ${JSON.stringify(actions)}`,
				}
			}
			return { pass: true }
		},
	},
	{
		name: 'det-select-and-save',
		task: 'Select "Premium" from the plan dropdown and save',
		url: 'https://example.com/settings',
		html: '[0]<label>Plan</label>\n[1]<select>\n\t<option>Free</option>\n\t<option>Basic</option>\n\t<option>Premium</option>\n</select>\n[2]<button>Save</button>',
		mockLlmResponses: [
			{
				tool: 'select_dropdown_option',
				args: { index: 1, text: 'Premium' },
			},
			{
				tool: 'click_element_by_index',
				args: { index: 2 },
			},
			{
				tool: 'done',
				args: { text: 'Saved Premium plan', success: true },
			},
		],
		assert: (history) => {
			const steps = history.filter((e) => e.type === 'step')
			if (steps.length !== 3) {
				return { pass: false, message: `Expected 3 steps, got ${steps.length}` }
			}
			const first = steps[0] as any
			if (first.action?.name !== 'select_dropdown_option') {
				return {
					pass: false,
					message: `Expected first step select_dropdown_option, got ${first.action?.name}`,
				}
			}
			return { pass: true }
		},
	},
]
