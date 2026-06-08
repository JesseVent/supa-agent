import type { LLMConfig } from '@supa-agent/llms'

export const DEMO_MODEL = 'google/gemini-2.5-flash'
export const DEMO_BASE_URL = 'https://openrouter.ai/api/v1'

export const DEMO_CONFIG: LLMConfig = {
	baseURL: DEMO_BASE_URL,
	model: DEMO_MODEL,
}
