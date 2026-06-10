/// <reference types="vite/client" />
import type { SupaAgent } from './SupaAgent'

declare global {
	interface Window {
		supaAgent?: SupaAgent
		SupaAgent: typeof SupaAgent
	}
}
