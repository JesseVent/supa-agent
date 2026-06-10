import { LLM } from '@supa-agent/llms'
import { describe, expect, it, vi } from 'vitest'

import { SupaAgentCore } from './SupaAgentCore'

function stubPageController() {
	return {
		showMask: async () => {},
		hideMask: () => {},
		cleanUpHighlights: () => {},
		dispose: () => {},
		getLastUpdateTime: () => Date.now(),
		// Never resolves — keeps the agent loop parked in "running" for the tests
		getBrowserState: () => new Promise(() => {}),
	} as never
}

const baseConfig = {
	baseURL: 'http://localhost:1/v1',
	apiKey: 'test-key',
	model: 'test-model',
}

describe('SupaAgentCore lifecycle', () => {
	it('removes its LLM event listeners on dispose()', () => {
		const addSpy = vi.spyOn(LLM.prototype, 'addEventListener')
		const removeSpy = vi.spyOn(LLM.prototype, 'removeEventListener')

		try {
			const agent = new SupaAgentCore({ ...baseConfig, pageController: stubPageController() })

			const addedRetry = addSpy.mock.calls.find((c) => c[0] === 'retry')?.[1]
			const addedError = addSpy.mock.calls.find((c) => c[0] === 'error')?.[1]
			expect(addedRetry).toBeTypeOf('function')
			expect(addedError).toBeTypeOf('function')

			agent.dispose()

			const removedRetry = removeSpy.mock.calls.find((c) => c[0] === 'retry')?.[1]
			const removedError = removeSpy.mock.calls.find((c) => c[0] === 'error')?.[1]
			// The exact same listener references must be removed, otherwise they leak
			expect(removedRetry).toBe(addedRetry)
			expect(removedError).toBe(addedError)
		} finally {
			addSpy.mockRestore()
			removeSpy.mockRestore()
		}
	})

	it('rejects execute() while another task is running', async () => {
		const agent = new SupaAgentCore({ ...baseConfig, pageController: stubPageController() })

		// First task parks forever in getBrowserState — never settles in this test
		const first = agent.execute('first task')
		first.catch(() => {})

		await new Promise((r) => setTimeout(r, 10))
		expect(agent.status).toBe('running')

		await expect(agent.execute('second task')).rejects.toThrow(/already running/)

		agent.dispose()
	})

	it('rejects execute() after dispose()', async () => {
		const agent = new SupaAgentCore({ ...baseConfig, pageController: stubPageController() })
		agent.dispose()
		await expect(agent.execute('task')).rejects.toThrow(/disposed/)
	})
})
