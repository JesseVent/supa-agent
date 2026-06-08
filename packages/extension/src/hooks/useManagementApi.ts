import { useCallback, useEffect, useState } from 'react'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'
const MGMT_API = 'https://api.supabase.com/v1'

export interface SupabaseProject {
	id: string
	name: string
	organization_id: string
	status: string
	region: string
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
			const res = await fetch(`${MGMT_API}/projects`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			if (!res.ok) {
				const text = await res.text()
				throw new Error(`API error ${res.status}: ${text}`)
			}
			const data: SupabaseProject[] = await res.json()
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
