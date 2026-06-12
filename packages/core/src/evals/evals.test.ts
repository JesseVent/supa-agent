import { describe, expect, it } from 'vitest'
import {
	deterministicFormScenarios,
	deterministicNavigationScenarios,
	deterministicSupabaseScenarios,
	runScenario,
} from '.'

/**
 * Deterministic evals run with pre-defined LLM responses.
 *
 * These are fast, cheap, and guarantee the agent loop mechanics work:
 * - Correct tool dispatch
 * - Correct argument passing
 * - Correct mock PageController state changes
 * - History accumulation
 *
 * They do NOT test the actual prompt against a real LLM.
 * For that, run the integration evals.
 */
describe('Deterministic Navigation Evals', () => {
	for (const scenario of deterministicNavigationScenarios) {
		it(`✓ ${scenario.name}`, async () => {
			const result = await runScenario(scenario)
			expect(result.passed).toBe(true)
			if (!result.passed) {
				console.error(`FAIL: ${result.message}`)
				console.error('History:', JSON.stringify(result.executionResult.history, null, 2))
			}
		})
	}
})

describe('Deterministic Form Evals', () => {
	for (const scenario of deterministicFormScenarios) {
		it(`✓ ${scenario.name}`, async () => {
			const result = await runScenario(scenario)
			expect(result.passed).toBe(true)
			if (!result.passed) {
				console.error(`FAIL: ${result.message}`)
				console.error('History:', JSON.stringify(result.executionResult.history, null, 2))
			}
		})
	}
})

describe('Deterministic Supabase MCP Evals', () => {
	for (const scenario of deterministicSupabaseScenarios) {
		it(`✓ ${scenario.name}`, async () => {
			const result = await runScenario(scenario)
			expect(result.passed).toBe(true)
			if (!result.passed) {
				console.error(`FAIL: ${result.message}`)
				console.error('History:', JSON.stringify(result.executionResult.history, null, 2))
			}
		})
	}
})

/**
 * Smoke test for prompt-debug helper.
 */
describe('Prompt Debug Helpers', () => {
	it('extractPrompt returns system and user prompts', async () => {
		const { extractPrompt } = await import('./harness')
		const { deterministicNavigationScenarios } = await import('./scenarios/navigation')
		const preview = await extractPrompt(deterministicNavigationScenarios[0])
		expect(preview.system).toContain('AI agent')
		expect(preview.user).toContain('<browser_state>')
		expect(preview.user).toContain('<user_request>')
	})
})
