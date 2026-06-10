import { describe, expect, it } from 'vitest'

import { modelPatch } from './utils'

describe('modelPatch', () => {
	it('disables thinking and rewrites tool_choice for a Claude model', () => {
		const body = modelPatch({ model: 'claude-opus-4-8', tool_choice: 'required' })
		expect(body.thinking).toEqual({ type: 'disabled' })
		expect(body.tool_choice).toEqual({ type: 'any' })
	})

	it('removes tool_choice for a grok model', () => {
		const body = modelPatch({ model: 'grok-4.2', tool_choice: 'required' })
		expect(body).not.toHaveProperty('tool_choice')
	})

	it('removes tool_choice for a deepseek model', () => {
		const body = modelPatch({ model: 'deepseek-v3.2', tool_choice: 'required' })
		expect(body).not.toHaveProperty('tool_choice')
	})

	it('normalizes a provider-prefixed gpt-5 id and sets reasoning/verbosity', () => {
		const body = modelPatch({ model: 'openai/gpt-5' })
		expect(body.verbosity).toBe('low')
		expect(body.reasoning_effort).toBe('low')
	})
})
