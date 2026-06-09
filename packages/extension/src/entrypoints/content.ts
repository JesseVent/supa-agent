import { initPageController } from '@/agent/RemotePageController.content'
import { isDomainAllowed } from '@/agent/security'

// import { DEMO_CONFIG } from '@/agent/constants'

const DEBUG_PREFIX = '[Content]'

export default defineContentScript({
	matches: ['<all_urls>'],
	runAt: 'document_end',

	main() {
		console.debug(`${DEBUG_PREFIX} Loaded on ${window.location.href}`)
		initPageController()

		// Migrate legacy storage key to new brand name
		chrome.storage.local.get('PageAgentExtUserAuthToken').then((legacy) => {
			if (legacy.PageAgentExtUserAuthToken) {
				chrome.storage.local
					.set({ SupaAgentExtUserAuthToken: legacy.PageAgentExtUserAuthToken })
					.then(() => chrome.storage.local.remove('PageAgentExtUserAuthToken'))
			}
		})

		// if auth token matches, expose agent to page
		chrome.storage.local.get('SupaAgentExtUserAuthToken').then((result) => {
			// extension side token.
			// @note this is isolated world. it is safe to assume user script cannot access it
			const extToken = result.SupaAgentExtUserAuthToken
			if (!extToken) return

			// page side token
			const pageToken =
				localStorage.getItem('SupaAgentExtUserAuthToken') ||
				localStorage.getItem('PageAgentExtUserAuthToken') // legacy compat
			if (!pageToken) return

			if (pageToken !== extToken) return

			// Security: only expose the page-facing API on the origin tab and whitelisted domains
			chrome.storage.local
				.get(['agentOriginTabId', 'advancedConfig'])
				.then(({ agentOriginTabId, advancedConfig }) => {
					chrome.runtime
						.sendMessage({ type: 'PAGE_CONTROL', action: 'get_my_tab_id' })
						.then((response) => {
							const myTabId = (response as { tabId: number | null }).tabId
							const cfg = advancedConfig as Record<string, unknown> | undefined
							const allowedDomains = (cfg?.allowedDomains ?? []) as string[]

							if (myTabId !== agentOriginTabId) {
								console.debug(
									'[SupaAgent]: Not origin tab — skipping page exposure.'
								)
								return
							}
							if (!isDomainAllowed(window.location.href, allowedDomains)) {
								console.debug(
									'[SupaAgent]: Domain not in whitelist — skipping page exposure.',
									allowedDomains
								)
								return
							}

							// add isolated world script
							exposeAgentToPage().then(
								// add main-world script
								() => injectScript('/main-world.js')
							)
						})
						.catch((err) => {
							console.error(
								'[SupaAgent]: Failed to get tab id for page exposure check:',
								err
							)
						})
				})
		})
	},
})

async function exposeAgentToPage() {
	const { MultiPageAgent } = await import('@/agent/MultiPageAgent')

	/**
	 * singleton MultiPageAgent to handle requests from the page
	 */
	let multiPageAgent: InstanceType<typeof MultiPageAgent> | null = null

	window.addEventListener('message', async (e) => {
		if (e.source !== window) return

		const data = e.data
		if (typeof data !== 'object' || data === null) return
		if (data.channel !== 'PAGE_AGENT_EXT_REQUEST') return

		const { action, payload, id } = data

		switch (action) {
			case 'execute': {
				// singleton check
				if (multiPageAgent && multiPageAgent.status === 'running') {
					window.postMessage(
						{
							channel: 'PAGE_AGENT_EXT_RESPONSE',
							id,
							action: 'execute_result',
							error: 'Agent is already running a task. Please wait until it finishes.',
						},
						'*'
					)
					return
				}

				try {
					const { task, config } = payload
					const { systemInstruction, ...agentConfig } = config

					// Dispose old instance before creating new one
					multiPageAgent?.dispose()

					multiPageAgent = new MultiPageAgent({
						...agentConfig,
						instructions: systemInstruction ? { system: systemInstruction } : undefined,
					})

					// events

					multiPageAgent.addEventListener('statuschange', (_event) => {
						if (!multiPageAgent) return
						window.postMessage(
							{
								channel: 'PAGE_AGENT_EXT_RESPONSE',
								id,
								action: 'status_change_event',
								payload: multiPageAgent.status,
							},
							'*'
						)
					})

					multiPageAgent.addEventListener('activity', (event) => {
						if (!multiPageAgent) return
						window.postMessage(
							{
								channel: 'PAGE_AGENT_EXT_RESPONSE',
								id,
								action: 'activity_event',
								payload: (event as CustomEvent).detail,
							},
							'*'
						)
					})

					multiPageAgent.addEventListener('historychange', (_event) => {
						if (!multiPageAgent) return
						window.postMessage(
							{
								channel: 'PAGE_AGENT_EXT_RESPONSE',
								id,
								action: 'history_change_event',
								payload: multiPageAgent.history,
							},
							'*'
						)
					})

					// result

					const result = await multiPageAgent.execute(task)

					window.postMessage(
						{
							channel: 'PAGE_AGENT_EXT_RESPONSE',
							id,
							action: 'execute_result',
							payload: result,
						},
						'*'
					)
				} catch (error) {
					window.postMessage(
						{
							channel: 'PAGE_AGENT_EXT_RESPONSE',
							id,
							action: 'execute_result',
							error: (error as Error).message,
						},
						'*'
					)
				}

				break
			}

			case 'stop': {
				multiPageAgent?.stop()
				break
			}

			default:
				console.warn(`${DEBUG_PREFIX} Unknown action from page:`, action)
				break
		}
	})
}
