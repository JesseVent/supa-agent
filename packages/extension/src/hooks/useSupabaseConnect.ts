import { useCallback, useState } from 'react'

import { SupabaseMcpClient } from '@/agent/SupabaseMcpClient'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'

export interface OAuthProject {
	id: string
	ref: string
	name: string
	region: string
	status: string
}

/**
 * Hook that wraps the Supabase OAuth DCR flow for the sidepanel modal.
 *
 * Flow:
 *   1. `connectWithOAuth()` → sends MGMT_CONNECT_START to the SW, which
 *      runs the full DCR + PKCE + launchWebAuthFlow + token exchange
 *      and stores the access token in chrome.storage.local.
 *   2. Lists projects via MCP `list_projects` (account-level, no project_ref).
 *   3. `applyOAuthProject(p)` fetches the publishable key via project-scoped MCP.
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

	const applyOAuthProject = useCallback(
		async (project: OAuthProject, accessToken: string) => {
			setIsOAuthConnecting(true)
			setCreateError(null)
			try {
				let anonKey = ''
				try {
					// Fetch publishable (anon) key via project-scoped MCP
					const client = new SupabaseMcpClient({ projectRef: project.ref, accessToken })
					const keyRaw = await client.callTool('get_publishable_keys', {})
					// Response may be plain text or JSON
					try {
						const parsed = JSON.parse(keyRaw)
						if (Array.isArray(parsed?.keys)) {
							const anon = parsed.keys.find(
								(k: any) => k.name === 'anon' || k.type === 'legacy'
							)
							anonKey = anon?.api_key ?? ''
						} else if (typeof parsed === 'string') {
							anonKey = parsed
						} else {
							anonKey = parsed?.key ?? parsed?.anon_key ?? ''
						}
					} catch {
						anonKey = keyRaw.trim()
					}
				} catch {
					// Non-fatal — user can paste the key manually
				}
				opts.onApplyProject({ ref: project.ref, name: project.name, anonKey })
				setOauthProjects(null)
			} catch (err) {
				setCreateError(
					err instanceof Error ? err.message : 'Failed to load project details'
				)
			} finally {
				setIsOAuthConnecting(false)
			}
		},
		[opts]
	)

	const connectWithOAuth = useCallback(async () => {
		setIsOAuthConnecting(true)
		setCreateError(null)
		try {
			const response = (await chrome.runtime.sendMessage({
				type: 'MGMT_CONNECT_START',
			})) as { ok?: true; accessToken?: string; error?: string } | undefined

			if (response?.error) throw new Error(response.error)
			if (!response?.ok)
				throw new Error('OAuth handshake failed — no response from background')

			const accessToken = await getStoredToken()
			if (!accessToken) throw new Error('Token not found in storage after OAuth')

			// List projects via MCP (account-level, no project_ref)
			const client = new SupabaseMcpClient({ accessToken })
			const raw = await client.callTool('list_projects', {})
			const parsed = JSON.parse(raw) as { projects?: OAuthProject[] } | OAuthProject[]
			const projects = Array.isArray(parsed) ? parsed : (parsed?.projects ?? [])

			if (projects.length === 0) {
				throw new Error('No Supabase projects found in this account.')
			}

			if (projects.length === 1) {
				await applyOAuthProject(projects[0], accessToken)
			} else {
				setOauthProjects(projects)
			}
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : 'OAuth connection failed')
		} finally {
			setIsOAuthConnecting(false)
		}
	}, [getStoredToken, applyOAuthProject])

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
