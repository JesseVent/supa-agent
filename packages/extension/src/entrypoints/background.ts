import { handlePageControlMessage } from '@/agent/RemotePageController.background'
import { handleTabControlMessage, setupTabEventsPort } from '@/agent/TabsController.background'
import {
	buildAuthorizeUrl,
	exchangeCode,
	extractCode,
	generatePKCE,
	getRedirectUri,
	launchAuthFlow,
	refreshAccessToken,
	registerDynamicClient,
} from '@/oauth/supabaseOAuth'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'
const MGMT_REFRESH_KEY = 'SupaAgentMgmtRefreshToken'
const MGMT_CLIENT_ID_KEY = 'SupaAgentMgmtClientIdV3'
const MGMT_CLIENT_SECRET_KEY = 'SupaAgentMgmtClientSecretV3'

export default defineBackground(() => {
	// tab change events

	setupTabEventsPort()

	// generate user auth token (migrate legacy key on first run)

	chrome.storage.local
		.get(['SupaAgentExtUserAuthToken', 'PageAgentExtUserAuthToken'])
		.then((result) => {
			if (result.SupaAgentExtUserAuthToken) return

			const existing = result.PageAgentExtUserAuthToken ?? crypto.randomUUID()
			chrome.storage.local
				.set({ SupaAgentExtUserAuthToken: existing })
				.then(() => chrome.storage.local.remove('PageAgentExtUserAuthToken'))
		})

	// message proxy

	chrome.runtime.onMessage.addListener((message, sender, sendResponse): true | undefined => {
		if (message.type === 'TAB_CONTROL') {
			return handleTabControlMessage(message, sender, sendResponse)
		} else if (message.type === 'PAGE_CONTROL') {
			return handlePageControlMessage(message, sender, sendResponse)
		} else if (message.type === 'MGMT_CONNECT_START') {
			handleConnectStart().then(sendResponse)
			return true
		} else if (message.type === 'MGMT_REFRESH_TOKEN') {
			handleRefreshToken().then(sendResponse)
			return true
		} else if (message.type === 'MGMT_DISCONNECT') {
			handleDisconnect().then(sendResponse)
			return true
		} else if (message.type === 'AGENT_EVENT') {
			// Forward side-panel agent events to the tab the agent is running on.
			// currentTabId is set by the extension when it starts controlling a tab.
			// Falls back to the active tab if currentTabId is not set.
			chrome.storage.local.get('currentTabId').then((result) => {
				const targetTabId = result.currentTabId as number | undefined
				if (targetTabId) {
					chrome.tabs.sendMessage(targetTabId, message).catch((err) => {
						// biome-ignore lint/suspicious/noConsole: Debug log for trace bridge
						console.warn(
							'[SupaAgent background] AGENT_EVENT send to tab',
							targetTabId,
							'failed:',
							err?.message
						)
					})
				} else {
					chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
						const tab = tabs[0]
						if (tab?.id) {
							chrome.tabs.sendMessage(tab.id, message).catch((err) => {
								// biome-ignore lint/suspicious/noConsole: Debug log for trace bridge
								console.warn(
									'[SupaAgent background] AGENT_EVENT send to active tab',
									tab.id,
									'failed:',
									err?.message
								)
							})
						}
					})
				}
			})
			// No async response needed — return undefined
			return
		} else {
			sendResponse({ error: 'Unknown message type' })
			return
		}
	})

	// external messages (from localhost launcher page via externally_connectable)

	chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
		if (message.type === 'OPEN_HUB') {
			openOrFocusHubTab(message.wsPort, message.wsToken).then(() => {
				if (sender.tab?.id) chrome.tabs.remove(sender.tab.id)
				sendResponse({ ok: true })
			})
			return true
		}
	})

	// setup

	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

async function openOrFocusHubTab(wsPort: number, wsToken?: string) {
	const hubUrl = chrome.runtime.getURL('hub.html')
	const existing = await chrome.tabs.query({ url: `${hubUrl}*` })
	const query = wsToken ? `?ws=${wsPort}&token=${encodeURIComponent(wsToken)}` : `?ws=${wsPort}`

	if (existing.length > 0 && existing[0].id) {
		await chrome.tabs.update(existing[0].id, {
			active: true,
			url: `${hubUrl}${query}`,
		})
		return
	}

	await chrome.tabs.create({ url: `${hubUrl}${query}`, pinned: true })
}

// ── Supabase Management API OAuth (hosted MCP DCR) ───────────────────────────

async function getOrCreateClient(
	force = false
): Promise<{ clientId: string; clientSecret?: string }> {
	if (!force) {
		const stored = await chrome.storage.local.get([MGMT_CLIENT_ID_KEY, MGMT_CLIENT_SECRET_KEY])
		const existingId = stored[MGMT_CLIENT_ID_KEY] as string | undefined
		if (existingId != null) {
			return {
				clientId: existingId,
				clientSecret: stored[MGMT_CLIENT_SECRET_KEY] as string | undefined,
			}
		}
	}

	const redirectUri = getRedirectUri()
	const { client_id, client_secret } = await registerDynamicClient(redirectUri)
	const update: Record<string, string> = { [MGMT_CLIENT_ID_KEY]: client_id }
	// Supabase DCR may return a client_secret without token_endpoint_auth_method.
	// Storing and forwarding it ensures the token exchange uses client_secret_post
	// rather than treating the client as public — which causes MCP auth rejection.
	if (client_secret) update[MGMT_CLIENT_SECRET_KEY] = client_secret
	await chrome.storage.local.set(update)
	return { clientId: client_id, clientSecret: client_secret }
}

async function handleConnectStart(): Promise<
	{ ok: true; accessToken: string } | { error: string }
> {
	const attempt = async (force = false) => {
		const redirectUri = getRedirectUri()
		const { clientId, clientSecret } = await getOrCreateClient(force)
		const { codeVerifier, codeChallenge } = await generatePKCE()
		const state = crypto.randomUUID()
		const authorizeUrl = buildAuthorizeUrl(clientId, redirectUri, codeChallenge, state)

		const redirectUrl = await launchAuthFlow(authorizeUrl)
		if (!redirectUrl) throw new Error('Sign-in window was closed')

		const returnedState = new URL(redirectUrl).searchParams.get('state')
		if (returnedState !== state)
			throw new Error('OAuth state mismatch — possible CSRF, try again')

		const code = extractCode(redirectUrl)
		return exchangeCode(clientId, code, codeVerifier, redirectUri, clientSecret)
	}

	try {
		let tokens: Awaited<ReturnType<typeof exchangeCode>>
		try {
			tokens = await attempt()
		} catch (err) {
			if (/unrecognized.client/i.test(err instanceof Error ? err.message : '')) {
				await chrome.storage.local.remove([MGMT_CLIENT_ID_KEY, MGMT_CLIENT_SECRET_KEY])
				tokens = await attempt(true)
			} else if (
				/required.parameter.*client_secret/i.test(err instanceof Error ? err.message : '')
			) {
				await chrome.storage.local.remove([MGMT_CLIENT_ID_KEY, MGMT_CLIENT_SECRET_KEY])
				tokens = await attempt(true)
			} else {
				throw err
			}
		}

		const update: Record<string, string> = { [MGMT_TOKEN_KEY]: tokens.accessToken }
		if (tokens.refreshToken) update[MGMT_REFRESH_KEY] = tokens.refreshToken
		await chrome.storage.local.set(update)

		return { ok: true as const, accessToken: tokens.accessToken }
	} catch (err) {
		return { error: err instanceof Error ? err.message : 'OAuth connection failed' }
	}
}

async function handleRefreshToken(): Promise<{ token?: string; error?: string }> {
	try {
		const stored = await chrome.storage.local.get([
			MGMT_REFRESH_KEY,
			MGMT_CLIENT_ID_KEY,
			MGMT_CLIENT_SECRET_KEY,
		])
		const refreshToken = stored[MGMT_REFRESH_KEY] as string | undefined
		const clientId = stored[MGMT_CLIENT_ID_KEY] as string | undefined
		const clientSecret = stored[MGMT_CLIENT_SECRET_KEY] as string | undefined
		if (!refreshToken) return { error: 'No refresh token — please reconnect' }
		if (!clientId) return { error: 'No client_id — please reconnect' }

		let tokens: Awaited<ReturnType<typeof refreshAccessToken>>
		try {
			tokens = await refreshAccessToken(clientId, refreshToken, clientSecret)
		} catch (err) {
			if (/unrecognized.client/i.test(err instanceof Error ? err.message : '')) {
				await chrome.storage.local.remove([
					MGMT_CLIENT_ID_KEY,
					MGMT_CLIENT_SECRET_KEY,
					MGMT_REFRESH_KEY,
				])
				return { error: 'Session expired — please reconnect via OAuth' }
			}
			if (
				/required.parameter.*client_secret/i.test(err instanceof Error ? err.message : '')
			) {
				await chrome.storage.local.remove([
					MGMT_CLIENT_ID_KEY,
					MGMT_CLIENT_SECRET_KEY,
					MGMT_REFRESH_KEY,
				])
				return { error: 'Missing client_secret — please reconnect via OAuth' }
			}
			throw err
		}

		const update: Record<string, string> = { [MGMT_TOKEN_KEY]: tokens.accessToken }
		if (tokens.refreshToken) update[MGMT_REFRESH_KEY] = tokens.refreshToken
		await chrome.storage.local.set(update)
		// biome-ignore lint/suspicious/noConsole: Log refresh event to extension console
		console.log('[SupaAgent background] Supabase Management token successfully refreshed.')
		return { token: tokens.accessToken }
	} catch (err) {
		return { error: err instanceof Error ? err.message : 'Token refresh failed' }
	}
}

async function handleDisconnect(): Promise<{ ok: true }> {
	await chrome.storage.local.remove([MGMT_TOKEN_KEY, MGMT_REFRESH_KEY])
	return { ok: true }
}
