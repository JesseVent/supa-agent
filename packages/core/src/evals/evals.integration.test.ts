import { describe, expect, it } from 'vitest'
import { formScenarios, navigationScenarios, runScenario, supabaseMcpScenarios } from '.'

/**
 * Integration evals run against a **real LLM**.
 *
 * These test whether the *prompt* produces correct tool choices.
 * They are slow, non-deterministic, and cost API tokens.
 *
 * To run locally:
 *   OPENAI_API_KEY=sk-xxx OPENAI_BASE_URL=https://api.openai.com/v1 MODEL=gpt-4.1-mini vitest run packages/core/src/evals/evals.integration.test.ts
 *
 * In CI they auto-skip unless `ENABLE_INTEGRATION_EVALS` is set.
 *
 * Model requirements:
 * - Navigation & Form scenarios: pass reliably with gpt-4.1-mini and up
 * - Supabase MCP scenarios: pass reliably with gpt-4.1; gpt-4.1-mini fails 2/7
 *   (model capability issue, not a prompt issue)
 */

const enabled = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL && process.env.MODEL)

/** Sleep helper to avoid rate limits between test cases */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const llmConfig = enabled
	? {
			apiKey: process.env.OPENAI_API_KEY!,
			baseURL: process.env.OPENAI_BASE_URL!,
			model: process.env.MODEL!,
		}
	: { apiKey: '', baseURL: '', model: '' }

describe.skipIf(!enabled).sequential('Integration Evals — Navigation (real LLM)', () => {
	for (const scenario of navigationScenarios) {
		it(`→ ${scenario.name}`, { timeout: 30000 }, async () => {
			const result = await runScenario(scenario, { llmConfig })
			expect(result.passed).toBe(true)
			if (!result.passed) {
				console.error(`\n❌ FAIL: ${scenario.name}`)
				console.error(`   ${result.message}`)
				console.error(`   History (${result.executionResult.history.length} events):`)
				for (const evt of result.executionResult.history) {
					if (evt.type === 'step') {
						console.error(
							`   Step ${evt.stepIndex}: ${evt.action.name}(${JSON.stringify(evt.action.input)}) → ${evt.action.output.slice(0, 120)}`
						)
					} else if (evt.type === 'observation') {
						console.error(`   OBS: ${evt.content.slice(0, 120)}`)
					} else if (evt.type === 'error') {
						console.error(`   ERR: ${evt.message}`)
					}
				}
			} else {
				console.error(`\n✅ PASS: ${scenario.name} (${result.duration}ms)`)
			}
			// Small delay to avoid hitting rate limits between scenarios
			await sleep(1000)
		})
	}
})

describe.skipIf(!enabled).sequential('Integration Evals — Forms (real LLM)', () => {
	for (const scenario of formScenarios) {
		it(`→ ${scenario.name}`, { timeout: 60000 }, async () => {
			const result = await runScenario(scenario, { llmConfig })
			expect(result.passed).toBe(true)
			if (!result.passed) {
				console.error(`\n❌ FAIL: ${scenario.name}`)
				console.error(`   ${result.message}`)
			} else {
				console.error(`\n✅ PASS: ${scenario.name} (${result.duration}ms)`)
			}
			await sleep(1000)
		})
	}
})

describe.skipIf(!enabled).sequential('Integration Evals — Supabase MCP (real LLM)', () => {
	for (const scenario of supabaseMcpScenarios) {
		it(`→ ${scenario.name}`, { timeout: 60000 }, async () => {
			const result = await runScenario(scenario, { llmConfig })
			expect(result.passed).toBe(true)
			if (!result.passed) {
				console.error(`\n❌ FAIL: ${scenario.name}`)
				console.error(`   ${result.message}`)
				console.error(`   History (${result.executionResult.history.length} events):`)
				for (const evt of result.executionResult.history) {
					if (evt.type === 'step') {
						console.error(
							`   Step ${evt.stepIndex}: ${evt.action.name}(${JSON.stringify(evt.action.input)}) → ${evt.action.output.slice(0, 120)}`
						)
					} else if (evt.type === 'observation') {
						console.error(`   OBS: ${evt.content.slice(0, 120)}`)
					} else if (evt.type === 'error') {
						console.error(`   ERR: ${evt.message}`)
					}
				}
			} else {
				console.error(`\n✅ PASS: ${scenario.name} (${result.duration}ms)`)
			}
			await sleep(1000)
		})
	}
})

/**
 * Prompt preview sanity check.
 */
describe.skipIf(!enabled).sequential('Prompt Preview (real LLM mode)', () => {
	it('extracts a readable prompt for the first navigation scenario', async () => {
		const { extractPrompt } = await import('./harness')
		const preview = await extractPrompt(navigationScenarios[0])
		expect(preview.system).toContain('AI agent')
		expect(preview.user).toContain('Go to google.com')
		expect(preview.user).toContain('[0]')
	})
})
