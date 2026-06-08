import { useCallback, useEffect, useState } from 'react'

import { SupabaseMcpClient } from '@/agent/SupabaseMcpClient'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'

export interface SupabaseProject {
	id: string
	name: string
	organization_id: string
	status: string
	region: string
	ref?: string
}

export function useManagementApi(connected: boolean) {
	const [projects, setProjects] = useState<SupabaseProject[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchProjects = useCallback(async () => {
		const result = await chrome.storage.local.get(MGMT_TOKEN_KEY)
		const token = result[MGMT_TOKEN_KEY] as string | undefined
		if (!token) return

		setLoading(true)
		setError(null)
		try {
			// Account-level MCP connection (no project_ref) to call list_projects
			const client = new SupabaseMcpClient({ accessToken: token })
			const raw = await client.callTool('list_projects', {})
			const parsed = JSON.parse(raw) as { projects?: SupabaseProject[] } | SupabaseProject[]
			const data = Array.isArray(parsed) ? parsed : (parsed?.projects ?? [])
			setProjects(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch projects')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		if (connected) fetchProjects()
		else setProjects([])
	}, [connected, fetchProjects])

	return { projects, loading, error, fetchProjects }
}
