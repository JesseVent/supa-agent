import type { BrowserState } from '@supa-agent/page-controller'
import { isDomainAllowed } from './security'
import type { TabsController } from './TabsController'

const PREFIX = '[RemotePageController]'

const debug = console.debug.bind(console, `\x1b[90m${PREFIX}\x1b[0m`)

function sendMessage(message: {
	type: 'PAGE_CONTROL'
	action: string
	targetTabId: number
	payload?: any
}): Promise<any> {
	return chrome.runtime.sendMessage(message).catch((error) => {
		console.error(PREFIX, message.action, error)
		return null
	})
}

/**
 * Agent side page controller.
 * - live in the agent env (extension page or content script)
 * - communicates with remote PageController via sw
 */
export class RemotePageController {
	tabsController: TabsController

	constructor(tabsController: TabsController) {
		this.tabsController = tabsController
	}

	get currentTabId(): number | null {
		return this.tabsController.currentTabId
	}

	private async getCurrentUrl(): Promise<string> {
		if (!this.currentTabId) return ''
		const { url } = await this.tabsController.getTabInfo(this.currentTabId)
		return url || ''
	}

	private async getCurrentTitle(): Promise<string> {
		if (!this.currentTabId) return ''
		const { title } = await this.tabsController.getTabInfo(this.currentTabId)
		return title || ''
	}

	async getLastUpdateTime(): Promise<number> {
		if (!this.currentTabId) throw new Error('tabsController not initialized.')
		return sendMessage({
			type: 'PAGE_CONTROL',
			action: 'get_last_update_time',
			targetTabId: this.currentTabId,
		})
	}

	async getBrowserState(): Promise<BrowserState> {
		let browserState: BrowserState
		debug('getBrowserState', this.currentTabId)

		const currentUrl = await this.getCurrentUrl()
		const currentTitle = await this.getCurrentTitle()

		if (!this.currentTabId || !(await isPageActionAllowed(currentUrl))) {
			browserState = {
				url: currentUrl,
				title: currentTitle,
				header: '',
				content: '(empty page. either current page is not readable or not loaded yet.)',
				footer: '',
			}
		} else {
			browserState = await sendMessage({
				type: 'PAGE_CONTROL',
				action: 'get_browser_state',
				targetTabId: this.currentTabId,
			})
		}

		const sum = await this.tabsController.summarizeTabs()
		browserState.header = `${sum}\n\n${browserState.header || ''}`

		debug('getBrowserState: success', this.currentTabId, browserState)

		return browserState
	}

	async updateTree(): Promise<void> {
		if (!this.currentTabId || !(await isPageActionAllowed(await this.getCurrentUrl()))) {
			return
		}

		await sendMessage({
			type: 'PAGE_CONTROL',
			action: 'update_tree',
			targetTabId: this.currentTabId,
		})
	}

	async cleanUpHighlights(): Promise<void> {
		if (!this.currentTabId || !(await isPageActionAllowed(await this.getCurrentUrl()))) {
			return
		}

		await sendMessage({
			type: 'PAGE_CONTROL',
			action: 'clean_up_highlights',
			targetTabId: this.currentTabId,
		})
	}

	async clickElement(...args: any[]): Promise<DomActionReturn> {
		return this.withBrowserControl(async () => {
			const res = await this.remoteCallDomAction('click_element', args)
			// @note may cause page navigation, wait for 1 second to ensure the page loading started
			await new Promise((resolve) => setTimeout(resolve, 1000))
			return res
		})
	}

	async inputText(...args: any[]): Promise<DomActionReturn> {
		return this.withBrowserControl(() => this.remoteCallDomAction('input_text', args))
	}

	async selectOption(...args: any[]): Promise<DomActionReturn> {
		return this.withBrowserControl(() => this.remoteCallDomAction('select_option', args))
	}

	async scroll(...args: any[]): Promise<DomActionReturn> {
		return this.withBrowserControl(() => this.remoteCallDomAction('scroll', args))
	}

	async scrollHorizontally(...args: any[]): Promise<DomActionReturn> {
		return this.withBrowserControl(() => this.remoteCallDomAction('scroll_horizontally', args))
	}

	async executeJavascript(...args: any[]): Promise<DomActionReturn> {
		return this.withBrowserControl(() => this.remoteCallDomAction('execute_javascript', args))
	}

	async navigateTo(url: string): Promise<DomActionReturn> {
		return this.withBrowserControl(async () => {
			// If there is no current tab (e.g. agent started from side-panel on a
			// chrome-extension:// URL), open a new tab instead of trying to navigate
			// a tab that does not exist.
			if (!this.currentTabId) {
				try {
					const message = await this.tabsController.openNewTab(url)
					return { success: true, message }
				} catch (error) {
					return {
						success: false,
						message: `Failed to open new tab: ${error instanceof Error ? error.message : String(error)}`,
					}
				}
			}
			try {
				const message = await this.tabsController.navigateTo(this.currentTabId, url)
				return { success: true, message }
			} catch (error) {
				return {
					success: false,
					message: `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`,
				}
			}
		})
	}

	async goBack(): Promise<DomActionReturn> {
		return this.withBrowserControl(async () => {
			if (!this.currentTabId) {
				return {
					success: false,
					message: 'No current tab to go back in. Open a tab first.',
				}
			}
			try {
				const message = await this.tabsController.goBack(this.currentTabId)
				return { success: true, message }
			} catch (error) {
				return {
					success: false,
					message: `Failed to go back: ${error instanceof Error ? error.message : String(error)}`,
				}
			}
		})
	}

	/** @note Managed by content script via storage polling. */
	async showMask(): Promise<void> {}
	/** @note Managed by content script via storage polling. */
	async hideMask(): Promise<void> {}
	/** @note Managed by content script via storage polling. */
	dispose(): void {}

	/** Set isBrowserControlling in storage for the duration of a browser action. */
	private async withBrowserControl<T>(fn: () => Promise<T>): Promise<T> {
		await chrome.storage.local.set({ isBrowserControlling: true })
		try {
			return await fn()
		} finally {
			await chrome.storage.local.set({ isBrowserControlling: false })
		}
	}

	private async remoteCallDomAction(action: string, payload: any[]): Promise<DomActionReturn> {
		if (!this.currentTabId) {
			return { success: false, message: 'RemotePageController not initialized.' }
		}

		if (!(await isPageActionAllowed(await this.getCurrentUrl()))) {
			return {
				success: false,
				message:
					'Operation not allowed on this page. Use open_new_tab to navigate to a web page first.',
			}
		}

		return sendMessage({
			type: 'PAGE_CONTROL',
			action: action,
			targetTabId: this.currentTabId!,
			payload,
		})
	}
}

interface DomActionReturn {
	success: boolean
	message: string
}

/**
 * Check if a URL can run content scripts and is in the domain whitelist.
 */
async function isPageActionAllowed(url: string | undefined): Promise<boolean> {
	if (!isContentScriptAllowed(url)) return false
	const { advancedConfig } = await chrome.storage.local.get('advancedConfig')
	const cfg = advancedConfig as Record<string, unknown> | undefined
	const allowedDomains = (cfg?.allowedDomains ?? []) as string[]
	return isDomainAllowed(url ?? '', allowedDomains)
}

/**
 * Check if a URL can run content scripts.
 */
export function isContentScriptAllowed(url: string | undefined): boolean {
	if (!url) return false

	const restrictedPatterns = [
		/^chrome:\/\//,
		/^chrome-extension:\/\//,
		/^about:/,
		/^edge:\/\//,
		/^brave:\/\//,
		/^opera:\/\//,
		/^vivaldi:\/\//,
		/^file:\/\//,
		/^view-source:/,
		/^devtools:\/\//,
	]

	return !restrictedPatterns.some((pattern) => pattern.test(url))
}
