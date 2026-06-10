import { describe, expect, it } from 'vitest'

import { InvokeError, InvokeErrorTypes } from './errors'

describe('InvokeError retryability', () => {
	const retryable = [
		InvokeErrorTypes.NETWORK_ERROR,
		InvokeErrorTypes.RATE_LIMIT,
		InvokeErrorTypes.SERVER_ERROR,
		InvokeErrorTypes.NO_TOOL_CALL,
		InvokeErrorTypes.INVALID_TOOL_ARGS,
		InvokeErrorTypes.UNKNOWN,
	]

	const nonRetryable = [
		InvokeErrorTypes.AUTH_ERROR,
		InvokeErrorTypes.CONFIG_ERROR,
		InvokeErrorTypes.CONTEXT_LENGTH,
		InvokeErrorTypes.CONTENT_FILTER,
		// Reclassified: tool execution happens outside the retry loop, re-running a
		// side-effecting tool can cause duplicate writes, so it must not retry.
		InvokeErrorTypes.TOOL_EXECUTION_ERROR,
	]

	for (const type of retryable) {
		it(`marks "${type}" as retryable`, () => {
			expect(new InvokeError(type, 'x').retryable).toBe(true)
		})
	}

	for (const type of nonRetryable) {
		it(`marks "${type}" as non-retryable`, () => {
			expect(new InvokeError(type, 'x').retryable).toBe(false)
		})
	}

	it('marks an AbortError as non-retryable even for an otherwise-retryable type', () => {
		const abort = new Error('aborted')
		abort.name = 'AbortError'
		const err = new InvokeError(InvokeErrorTypes.NETWORK_ERROR, 'x', abort)
		expect(err.retryable).toBe(false)
	})
})
