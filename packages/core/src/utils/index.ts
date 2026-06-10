import chalk from 'chalk'

export * from './autoFixer'

export function waitFor(seconds: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error('AbortError'))
			return
		}
		const id = setTimeout(resolve, seconds * 1000)
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

//

/**
 * Framing tags used to structure the agent prompt. Untrusted text (page DOM,
 * tool output, retrieved memory, llms.txt) must never be able to forge these,
 * or a hostile page could inject fake system observations / close sections early.
 */
const RESERVED_PROMPT_TAGS = [
	'browser_state',
	'agent_history',
	'agent_state',
	'sys',
	'instructions',
	'system_instructions',
	'page_instructions',
	'llms_txt',
	'skill_context',
	'user_request',
	'step_info',
	'conversation_history',
].join('|')

const RESERVED_TAG_RE = new RegExp(`<(/?)(?=(?:${RESERVED_PROMPT_TAGS}|step_\\d+)\\b)`, 'gi')

/** Zero-width space — breaks a framing token without changing its visual appearance. */
const ZWSP = String.fromCharCode(0x200b)

/**
 * Defuse prompt-framing delimiters in untrusted text. Inserts a zero-width space
 * after the `<` of any reserved framing tag so the token is no longer recognizable
 * as a section boundary, while remaining visually identical to a human.
 *
 * @example sanitizeUntrusted('</browser_state>') // → '<' + ZWSP + '/browser_state>'
 */
export function sanitizeUntrusted(text: string): string {
	if (!text) return text
	return text.replace(RESERVED_TAG_RE, `<${ZWSP}$1`)
}

export function truncate(text: string, maxLength: number): string {
	if (text.length > maxLength) {
		return `${text.substring(0, maxLength)}...`
	}
	return text
}

//

/**
 * Generate a globally unique ID.
 * @note Backed by crypto.randomUUID, so collisions are not a practical concern
 * and no dedupe registry is needed.
 */
export function uid(): string {
	return crypto.randomUUID()
}

const llmsTxtCache = new Map<string, string | null>()

/** Fetch /llms.txt for a URL's origin. Cached per origin, `null` = tried and not found. */
export async function fetchLlmsTxt(url: string): Promise<string | null> {
	let origin: string
	try {
		origin = new URL(url).origin
	} catch {
		return null // Invalid URL
	}
	// about:blank, data:, file:
	if (origin === 'null') return null

	if (llmsTxtCache.has(origin)) return llmsTxtCache.get(origin)!

	const endpoint = `${origin}/llms.txt`
	let result: string | null = null
	try {
		const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) })
		if (res.ok) {
			result = await res.text()

			if (result.length > 1000) {
				result = truncate(result, 1000)
			}
		} else {
			console.debug(chalk.gray(`[llms.txt] ${res.status} for ${endpoint}`))
		}
	} catch (e) {
		console.debug(chalk.gray(`[llms.txt] not found for ${endpoint}`), e)
	}
	llmsTxtCache.set(origin, result)
	return result
}

/**
 * Simple assertion function that throws an error if the condition is falsy
 * @param condition - The condition to assert
 * @param message - Optional error message
 * @throws Error if condition is falsy
 */
export function assert(condition: unknown, message?: string, silent?: boolean): asserts condition {
	if (!condition) {
		const errorMessage = message ?? 'Assertion failed'

		if (!silent) console.error(chalk.red(`Failed: assert: ${errorMessage}`))

		throw new Error(errorMessage)
	}
}
