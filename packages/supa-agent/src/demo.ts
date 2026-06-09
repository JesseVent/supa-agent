/**
 * IIFE demo entry - auto-initializes with built-in demo API for testing
 */
import { SupaAgent, type SupaAgentConfig } from './SupaAgent'

const currentScript = document.currentScript as HTMLScriptElement | null
const currentScriptURL = currentScript?.src ? new URL(currentScript.src) : null
const autoInit = currentScriptURL?.searchParams.get('autoInit') !== 'false'

// Clean up existing instances to prevent multiple injections from bookmarklet
if (autoInit && window.supaAgent) {
	window.supaAgent.dispose()
}

// Mount to global window object
window.SupaAgent = SupaAgent

const DEMO_MODEL = 'google/gemini-2.5-flash'
const DEMO_BASE_URL = 'https://openrouter.ai/api/v1'
const DEMO_API_KEY = ''

// in case document.x is not ready yet
if (autoInit) {
	setTimeout(() => {
		let config: SupaAgentConfig
		let showPanel = true

		if (currentScriptURL) {
			const url = currentScriptURL
			const model = url.searchParams.get('model') || DEMO_MODEL
			const baseURL = url.searchParams.get('baseURL') || DEMO_BASE_URL
			const apiKey = url.searchParams.get('apiKey') || DEMO_API_KEY
			showPanel =
				((url.searchParams.get('showPanel') as 'true' | 'false') || 'true') === 'true'
			config = { model, baseURL, apiKey }
		} else {
			config = {
				model: import.meta.env.LLM_MODEL_NAME ? import.meta.env.LLM_MODEL_NAME : DEMO_MODEL,
				baseURL: import.meta.env.LLM_BASE_URL
					? import.meta.env.LLM_BASE_URL
					: DEMO_BASE_URL,
				apiKey: import.meta.env.LLM_API_KEY ? import.meta.env.LLM_API_KEY : DEMO_API_KEY,
			}
		}

		// Create agent
		window.supaAgent = new SupaAgent(config)
		if (showPanel) {
			window.supaAgent.panel.show()
		}
	})
}
