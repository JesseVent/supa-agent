import { useCallback, useState } from 'react'

import { type OAuthProject, getProjectKeys, listProjects } from '@/oauth/supabaseOAuth'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'

/**
 * Hook that wraps the Supabase OAuth DCR flow for the sidepanel modal.
 *
 * Flow:
 *   1. `connectWithOAuth()` → sends MGMT_CONNECT_START to the SW, which
 *      runs the full DCR + PKCE + launchWebAuthFlow + token exchange
 *      and stores the access token in chrome.storage.local.
 *   2. The hook then fetches /v1/projects with the new token and either
 *      auto-applies the single project or surfaces a picker.
 *   3. `applyOAuthProject(p)` fetches /v1/projects/{ref}/api-keys to
 *      pre-fill the connection form.
 *
 * The hook never sees the access token directly — it reads it from
 * chrome.storage via `getStoredToken()` for the project-list / key
 * fetch helpers, then calls `onApplyProject(ref, anonKey)` to bubble
 * the result back to the caller (ConfigPanel writes it into ExtConfig).
 */
export function useSupabaseConnect(opts: {
	onApplyProject: (project: { ref: string; name: string; anonKey: string }) => void
}) {
	const [isOAuthConnecting, setIsOAuthConnecting] = useState(false)
	const [oauthProjects, setOauthProjects] = useState<OAuthProject[] | null>(null)
	const [createError, setCreateError] = useState<string | null>(null)

	const reset = useCallback(() => {
		setOauthProjects(null)
		setCreateError(null)
		setIsOAuthConnecting(false)
	}, [])

	const getStoredToken = useCallback(async (): Promise<string | null> => {
		const stored = await chrome.storage.local.get(MGMT_TOKEN_KEY)
		const token = stored[MGMT_TOKEN_KEY] as string | undefined
		return token ?? null
	}, [])

	const connectWithOAuth = useCallback(async () => {
		setIsOAuthConnecting(true)
		setCreateError(null)
		try {
			const response = (await chrome.runtime.sendMessage({
				type: 'MGMT_CONNECT_START',
			})) as { ok?: true; accessToken?: string; error?: string } | undefined

			if (response?.error) throw new Error(response.error)
			if (!response?.ok) throw new Error('OAuth handshake failed — no response from background')

			const accessToken = await getStoredToken()
			if (!accessToken) throw new Error('Token not found in storage after OAuth')

			const projects = await listProjects(accessToken)
			if (projects.length === 0) {
				throw new Error('No Supabase projects found in this account.')
			}

			if (projects.length === 1) {
				// Auto-apply the only project.
				await applyOAuthProject(projects[0], accessToken)
			} else {
				setOauthProjects(projects)
			}
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : 'OAuth connection failed')
		} finally {
			setIsOAuthConnecting(false)
		}
	}, [getStoredToken])

	const applyOAuthProject = useCallback(
		async (project: OAuthProject, accessToken: string) => {
			setIsOAuthConnecting(true)
			setCreateError(null)
			try {
				let anonKey = ''
				try {
					const keys = await getProjectKeys(project.ref, accessToken)
					anonKey = keys.anon
				} catch {
					// Missing Secrets scope or transient API error — caller will
					// show the toast and the user can paste keys manually.
				}
				opts.onApplyProject({ ref: project.ref, name: project.name, anonKey })
				setOauthProjects(null)
			} catch (err) {
				setCreateError(err instanceof Error ? err.message : 'Failed to load project details')
			} finally {
				setIsOAuthConnecting(false)
			}
		},
		[opts]
	)

	/**
	 * Stub for the "Prefill from .env" button. The devtool reads from
	 * `process.env.SEED_*`; the extension has no equivalent yet, so the
	 * button surfaces a hint instead of silently doing nothing.
	 */
	const prefillFromEnv = useCallback(() => {
		setCreateError('No .env prefill configured for the extension — paste values manually.')
	}, [])

	return {
		isOAuthConnecting,
		oauthProjects,
		setOauthProjects,
		createError,
		setCreateError,
		connectWithOAuth,
		applyOAuthProject,
		prefillFromEnv,
		reset,
	}
}
