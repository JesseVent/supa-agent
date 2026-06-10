/**
 * background logics for RemotePageController
 * - redirect messages from RemotePageController(Agent, extension pages) to ContentScript
 */

export function handlePageControlMessage(
	message: { type: 'PAGE_CONTROL'; action: string; payload: any; targetTabId: number },
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: unknown) => void
): true | undefined {
	const PREFIX = '[RemotePageController.background]'

	const debug = console.debug.bind(console, `\x1b[90m${PREFIX}\x1b[0m`)

	const { action, payload, targetTabId } = message

	if (action === 'get_my_tab_id') {
		debug('get_my_tab_id', sender.tab?.id)
		sendResponse({ tabId: sender.tab?.id || null })
		return
	}

	async function sendWithRetry(retries = 1): Promise<void> {
		try {
			const result = await chrome.tabs.sendMessage(targetTabId, {
				type: 'PAGE_CONTROL',
				action,
				payload,
			})
			sendResponse(result)
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)

			// Chrome bfcache kills content-script ports when a page is navigated back/forward.
			// "Receiving end does not exist" is also expected when a tab just navigated and the
			// content script hasn't re-injected yet. Retry once after a short delay.
			const isTransient =
				/back\/forward cache|message channel is closed|receiving end does not exist/i.test(
					msg
				)

			if (isTransient && retries > 0) {
				debug('Transient port error, retrying...', msg)
				await new Promise((r) => setTimeout(r, 400))
				return sendWithRetry(retries - 1)
			}

			if (isTransient) {
				console.warn(PREFIX, 'Tab port unavailable — ignoring', msg)
			} else {
				console.error(PREFIX, error)
			}
			sendResponse({
				success: false,
				error: msg,
			})
		}
	}

	sendWithRetry()
	return true // async response
}
