/**
 * content script for RemotePageController
 */
import { PageController } from '@supa-agent/page-controller'

import { isDomainAllowed } from './security'

export function initPageController() {
	let pageController: PageController | null = null
	let intervalID: number | null = null

	const myTabIdPromise = chrome.runtime
		.sendMessage({ type: 'PAGE_CONTROL', action: 'get_my_tab_id' })
		.then((response) => {
			return (response as { tabId: number | null }).tabId
		})
		.catch((error) => {
			console.error('[RemotePageController.ContentScript]: Failed to get my tab id', error)
			return null
		})

	async function isCurrentDomainAllowed(): Promise<boolean> {
		const { advancedConfig } = await chrome.storage.local.get('advancedConfig')
		const cfg = advancedConfig as Record<string, unknown> | undefined
		const allowedDomains = (cfg?.allowedDomains ?? []) as string[]
		return isDomainAllowed(window.location.href, allowedDomains)
	}

	function getPC(): PageController {
		if (!pageController) {
			pageController = new PageController({
				enableMask: false,
				viewportExpansion: 400,
			})
		}
		return pageController
	}

	intervalID = window.setInterval(async () => {
		// chrome.runtime.id becomes undefined when the extension is reloaded
		if (!chrome.runtime?.id) {
			if (intervalID) window.clearInterval(intervalID)
			pageController?.dispose()
			pageController = null
			return
		}
		try {
			const agentHeartbeat = (await chrome.storage.local.get('agentHeartbeat')).agentHeartbeat
			const now = Date.now()
			const agentInTouch = typeof agentHeartbeat === 'number' && now - agentHeartbeat < 2_000

			const isAgentRunning = (await chrome.storage.local.get('isAgentRunning')).isAgentRunning
			const currentTabId = (await chrome.storage.local.get('currentTabId')).currentTabId

			const shouldShowMask =
				isAgentRunning && agentInTouch && currentTabId === (await myTabIdPromise)

			if (shouldShowMask) {
				// Security: do not show mask or enable DOM ops on non-whitelisted domains
				if (!(await isCurrentDomainAllowed())) {
					if (pageController) {
						pageController.hideMask()
						pageController.cleanUpHighlights()
					}
					return
				}
				const pc = getPC()
				pc.initMask()
				await pc.showMask()
			} else {
				if (pageController) {
					pageController.hideMask()
					pageController.cleanUpHighlights()
				}
			}

			if (!isAgentRunning && agentInTouch) {
				if (pageController) {
					pageController.dispose()
					pageController = null
				}
			}
		} catch (e) {
			// Extension was reloaded — stop the interval to avoid further errors
			if (e instanceof Error && e.message.includes('Extension context invalidated')) {
				if (intervalID) window.clearInterval(intervalID)
				if (pageController) {
					pageController.dispose()
					pageController = null
				}
			}
		}
	}, 500)

	chrome.runtime.onMessage.addListener((message, sender, sendResponse): true | undefined => {
		if (message.type !== 'PAGE_CONTROL') {
			// sendResponse({
			// 	success: false,
			// 	error: `[RemotePageController.ContentScript]: Invalid message type: ${message.type}`,
			// })
			return
		}

		const { action, payload } = message
		const methodName = getMethodName(action)

		const pc = getPC() as any

		switch (action) {
			case 'get_last_update_time':
			case 'get_browser_state':
			case 'update_tree':
			case 'clean_up_highlights':
			case 'click_element':
			case 'input_text':
			case 'select_option':
			case 'scroll':
			case 'scroll_horizontally':
			case 'execute_javascript':
				// Security: reject DOM actions on non-whitelisted domains
				isCurrentDomainAllowed().then((allowed) => {
					if (!allowed) {
						sendResponse({
							success: false,
							message: 'Operation blocked: current domain is not in the allowed list.',
						})
						return
					}
					pc[methodName](...(payload || []))
						.then((result: any) => sendResponse(result))
						.catch((error: any) =>
							sendResponse({
								success: false,
								error: error instanceof Error ? error.message : String(error),
							})
						)
				})
				break

			default:
				sendResponse({
					success: false,
					error: `Unknown PAGE_CONTROL action: ${action}`,
				})
		}

		return true
	})
}

function getMethodName(action: string): string {
	switch (action) {
		case 'get_last_update_time':
			return 'getLastUpdateTime' as const
		case 'get_browser_state':
			return 'getBrowserState' as const
		case 'update_tree':
			return 'updateTree' as const
		case 'clean_up_highlights':
			return 'cleanUpHighlights' as const

		// DOM actions

		case 'click_element':
			return 'clickElement' as const
		case 'input_text':
			return 'inputText' as const
		case 'select_option':
			return 'selectOption' as const
		case 'scroll':
			return 'scroll' as const
		case 'scroll_horizontally':
			return 'scrollHorizontally' as const
		case 'execute_javascript':
			return 'executeJavascript' as const

		default:
			return action
	}
}
