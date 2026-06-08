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
const MGMT_CLIENT_ID_KEY = 'SupaAgentMgmtClientId'
const MGMT_CLIENT_SECRET_KEY = 'SupaAgentMgmtClientSecret'

export default defineBackground(() => {
	console.log('[Background] Service Worker started')

	// tab change events

	setupTabEventsPort()

	// generate user auth token

	chrome.storage.local.get('PageAgentExtUserAuthToken').then((result) => {
		if (result.PageAgentExtUserAuthToken) return

		const userAuthToken = crypto.randomUUID()
		chrome.storage.local.set({ PageAgentExtUserAuthToken: userAuthToken })
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
		} else {
			sendResponse({ error: 'Unknown message type' })
			return
		}
	})

	// external messages (from localhost launcher page via externally_connectable)

	chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
		if (message.type === 'OPEN_HUB') {
			openOrFocusHubTab(message.wsPort).then(() => {
				if (sender.tab?.id) chrome.tabs.remove(sender.tab.id)
				sendResponse({ ok: true })
			})
			return true
		}
	})

	// setup

	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
})

async function openOrFocusHubTab(wsPort: number) {
	const hubUrl = chrome.runtime.getURL('hub.html')
	const existing = await chrome.tabs.query({ url: `${hubUrl}*` })

	if (existing.length > 0 && existing[0].id) {
		await chrome.tabs.update(existing[0].id, {
			active: true,
			url: `${hubUrl}?ws=${wsPort}`,
		})
		return
	}

	await chrome.tabs.create({ url: `${hubUrl}?ws=${wsPort}`, pinned: true })
}

// ── Supabase Management API OAuth (hosted MCP DCR) ───────────────────────────

async function getOrCreateClientId(): Promise<{ clientId: string; clientSecret: string }> {
	const stored = await chrome.storage.local.get([MGMT_CLIENT_ID_KEY, MGMT_CLIENT_SECRET_KEY])
	const existingId = stored[MGMT_CLIENT_ID_KEY] as string | undefined
	const existingSecret = stored[MGMT_CLIENT_SECRET_KEY] as string | undefined
	if (existingId && existingSecret) return { clientId: existingId, clientSecret: existingSecret }

	const redirectUri = getRedirectUri()
	const { client_id, client_secret } = await registerDynamicClient(redirectUri)
	await chrome.storage.local.set({ [MGMT_CLIENT_ID_KEY]: client_id, [MGMT_CLIENT_SECRET_KEY]: client_secret })
	return { clientId: client_id, clientSecret: client_secret }
}

async function handleConnectStart(): Promise<
	{ ok: true; accessToken: string } | { error: string }
> {
	try {
		const redirectUri = getRedirectUri()
		const { clientId, clientSecret } = await getOrCreateClientId()
		const { codeVerifier, codeChallenge } = await generatePKCE()
		const state = crypto.randomUUID()
		const authorizeUrl = buildAuthorizeUrl(clientId, redirectUri, codeChallenge, state)

		const redirectUrl = await launchAuthFlow(authorizeUrl)
		if (!redirectUrl) {
			return { error: 'Sign-in window was closed' }
		}

		// Verify state — defense against CSRF on the redirect.
		const returnedState = new URL(redirectUrl).searchParams.get('state')
		if (returnedState !== state) {
			return { error: 'OAuth state mismatch — possible CSRF, try again' }
		}

		const code = extractCode(redirectUrl)
		const tokens = await exchangeCode(clientId, code, codeVerifier, redirectUri, clientSecret)

		const update: Record<string, string> = { [MGMT_TOKEN_KEY]: tokens.accessToken }
		if (tokens.refreshToken) update[MGMT_REFRESH_KEY] = tokens.refreshToken
		await chrome.storage.local.set(update)

		return { ok: true, accessToken: tokens.accessToken }
	} catch (err) {
		return { error: err instanceof Error ? err.message : 'OAuth connection failed' }
	}
}

async function handleRefreshToken(): Promise<{ token?: string; error?: string }> {
	try {
		const stored = await chrome.storage.local.get([MGMT_REFRESH_KEY, MGMT_CLIENT_ID_KEY, MGMT_CLIENT_SECRET_KEY])
		const refreshToken = stored[MGMT_REFRESH_KEY] as string | undefined
		const clientId = stored[MGMT_CLIENT_ID_KEY] as string | undefined
		const clientSecret = stored[MGMT_CLIENT_SECRET_KEY] as string | undefined
		if (!refreshToken) return { error: 'No refresh token — please reconnect' }
		if (!clientId) return { error: 'No client_id — please reconnect' }

		const tokens = await refreshAccessToken(clientId, refreshToken, clientSecret)
		const update: Record<string, string> = { [MGMT_TOKEN_KEY]: tokens.accessToken }
		if (tokens.refreshToken) update[MGMT_REFRESH_KEY] = tokens.refreshToken
		await chrome.storage.local.set(update)
		return { token: tokens.accessToken }
	} catch (err) {
		return { error: err instanceof Error ? err.message : 'Token refresh failed' }
	}
}

async function handleDisconnect(): Promise<{ ok: true }> {
	await chrome.storage.local.remove([MGMT_TOKEN_KEY, MGMT_REFRESH_KEY])
	return { ok: true }
}
