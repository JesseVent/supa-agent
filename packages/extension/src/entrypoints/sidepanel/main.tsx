import React from 'react'
import ReactDOM from 'react-dom/client'

import { ErrorBoundary } from '@/components/ErrorBoundary'

import App from './App'

import '@/assets/index.css'

// Apply stored or system theme before React mounts to avoid flash
const applyTheme = (pref?: 'system' | 'light' | 'dark') => {
	const isDark = pref === 'dark' || (!pref && matchMedia('(prefers-color-scheme: dark)').matches)
	document.documentElement.classList.toggle('dark', isDark)
}

chrome.storage.local.get('advancedConfig').then((result) => {
	const advancedConfig = result.advancedConfig as
		| { theme?: 'system' | 'light' | 'dark' }
		| undefined
	applyTheme(advancedConfig?.theme)
})

// Keep listening to system changes when theme is set to system (App will manage its own listener too)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
	chrome.storage.local.get('advancedConfig').then((result) => {
		const advancedConfig = result.advancedConfig as
			| { theme?: 'system' | 'light' | 'dark' }
			| undefined
		if (!advancedConfig?.theme || advancedConfig.theme === 'system') {
			document.documentElement.classList.toggle('dark', e.matches)
		}
	})
})

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</React.StrictMode>
)
