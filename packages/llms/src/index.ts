import { DEFAULT_TEMPERATURE, LLM_MAX_RETRIES } from './constants'
import { InvokeError, InvokeErrorTypes } from './errors'
import { OpenAIClient } from './OpenAIClient'
import type { InvokeOptions, InvokeResult, LLMClient, LLMConfig, Message, Tool } from './types'

export type { InvokeOptions, InvokeResult, LLMClient, LLMConfig, Message, Tool }
export { InvokeError, InvokeErrorTypes }

export function parseLLMConfig(config: LLMConfig): Required<LLMConfig> {
	// Runtime validation as defensive programming (types already guarantee these)
	if (!config.baseURL || !config.model) {
		throw new Error(
			'[SupaAgent] LLM configuration required. Please provide: baseURL, model. ' +
				'See: https://supabase.com/docs'
		)
	}

	return {
		baseURL: config.baseURL,
		model: config.model,
		apiKey: config.apiKey || '',
		temperature: config.temperature ?? DEFAULT_TEMPERATURE,
		maxRetries: config.maxRetries ?? LLM_MAX_RETRIES,
		transformRequestBody: config.transformRequestBody ?? ((requestBody) => requestBody),
		disableNamedToolChoice: config.disableNamedToolChoice ?? false,
		customFetch: (config.customFetch ?? fetch).bind(globalThis), // fetch will be illegal unless bound
	}
}

export class LLM extends EventTarget {
	config: Required<LLMConfig>
	client: LLMClient

	constructor(config: LLMConfig) {
		super()
		this.config = parseLLMConfig(config)

		// Default to OpenAI client
		this.client = new OpenAIClient(this.config)
	}

	/**
	 * Call the LLM API and return a *validated* tool call.
	 *
	 * @remarks
	 * - The tool is NOT executed here — execution is the caller's responsibility so
	 *   side-effecting tools never run inside the retry loop.
	 * - Retries cover only the network round-trip + response normalization + schema
	 *   validation, with exponential backoff + jitter.
	 * - On `INVALID_TOOL_ARGS` / `NO_TOOL_CALL`, the validation error is appended to a
	 *   working copy of the messages so the next attempt receives different input
	 *   instead of an identical resend.
	 */
	async invoke(
		messages: Message[],
		tools: Record<string, Tool>,
		abortSignal: AbortSignal,
		options?: InvokeOptions
	): Promise<InvokeResult> {
		const maxRetries = this.config.maxRetries
		// Working copy — may be augmented with feedback between attempts.
		const working: Message[] = [...messages]
		let attempt = 0
		let lastError: Error | null = null

		while (attempt <= maxRetries) {
			// In case the user aborted before/between invocations.
			if (abortSignal.aborted) throw new Error('AbortError')

			if (attempt > 0) {
				this.dispatchEvent(
					new CustomEvent('retry', { detail: { attempt, maxAttempts: maxRetries } })
				)
				await sleep(backoffDelay(attempt), abortSignal)
			}

			try {
				return await this.client.invoke(working, tools, abortSignal, options)
			} catch (error: unknown) {
				// Never retry an abort.
				if (isAbortError(error)) throw error

				console.error(error)
				this.dispatchEvent(new CustomEvent('error', { detail: { error } }))

				// Do not retry non-retryable errors.
				if (error instanceof InvokeError && !error.retryable) throw error

				// Feedback: make the next attempt different from the last.
				if (
					error instanceof InvokeError &&
					(error.type === InvokeErrorTypes.INVALID_TOOL_ARGS ||
						error.type === InvokeErrorTypes.NO_TOOL_CALL)
				) {
					working.push({
						role: 'user',
						content: `Your previous response was invalid: ${error.message}. Respond again by calling the required tool with valid arguments.`,
					})
				}

				lastError = error as Error
				attempt++
			}
		}

		throw lastError!
	}
}

/** Exponential backoff with jitter, capped. attempt is 1-indexed. */
function backoffDelay(attempt: number): number {
	const base = 250
	const cap = 4000
	const exp = Math.min(base * 2 ** (attempt - 1), cap)
	return exp + Math.random() * base
}

function isAbortError(error: unknown): boolean {
	const e = error as { name?: string; message?: string; rawError?: { name?: string } }
	return (
		e?.name === 'AbortError' ||
		e?.message === 'AbortError' ||
		e?.rawError?.name === 'AbortError'
	)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(new Error('AbortError'))
		const id = setTimeout(resolve, ms)
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(id)
				reject(new Error('AbortError'))
			},
			{ once: true }
		)
	})
}
