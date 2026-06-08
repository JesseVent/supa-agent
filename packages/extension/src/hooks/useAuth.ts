import { useCallback, useEffect, useState } from 'react'

const MGMT_TOKEN_KEY = 'SupaAgentMgmtToken'

export function useAuth() {
	const [mgmtConnected, setMgmtConnected] = useState(false)

	useEffect(() => {
		let mounted = true

		chrome.storage.local.get(MGMT_TOKEN_KEY).then((result) => {
			if (mounted) setMgmtConnected(!!result[MGMT_TOKEN_KEY])
		})

		const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
			if (MGMT_TOKEN_KEY in changes && mounted) {
				setMgmtConnected(!!changes[MGMT_TOKEN_KEY]?.newValue)
			}
		}
		chrome.storage.local.onChanged.addListener(onStorageChanged)

		return () => {
			mounted = false
			chrome.storage.local.onChanged.removeListener(onStorageChanged)
		}
	}, [])

	const connectManagement = useCallback(async () => {
		const response = await chrome.runtime.sendMessage({ type: 'MGMT_CONNECT_START' })
		if (response?.error) throw new Error(response.error)
	}, [])

	const disconnectManagement = useCallback(async () => {
		await chrome.runtime.sendMessage({ type: 'MGMT_DISCONNECT' })
		setMgmtConnected(false)
	}, [])

	return { mgmtConnected, connectManagement, disconnectManagement }
}
