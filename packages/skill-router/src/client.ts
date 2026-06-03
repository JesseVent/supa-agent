import type {
	SkillFeedbackRequest,
	SkillFeedbackResponse,
	SkillRouterRequest,
	SkillRouterResponse,
} from './types.js'

export class SkillRouterClient {
	constructor(
		private readonly baseUrl: string,
		private readonly anonKey: string
	) {}

	async route(req: SkillRouterRequest): Promise<SkillRouterResponse> {
		return this.post<SkillRouterResponse>('skill-router', req)
	}

	async feedback(req: SkillFeedbackRequest): Promise<SkillFeedbackResponse> {
		return this.post<SkillFeedbackResponse>('skill-feedback', req)
	}

	/**
	 * Returns a SkillRouterAdapter bound to a specific skill_name.
	 * Pass the result directly to PageAgent/PageAgentCore config as `skillRouter`.
	 *
	 * @example
	 * const agent = new PageAgent({
	 *   skillRouter: new SkillRouterClient(url, key).asAdapter('supabase-postgres-best-practices')
	 * })
	 */
	asAdapter(skill_name: string, top_k = 5) {
		return {
			route: async (task: string) => {
				const res = await this.route({ prompt: task, skill_name, top_k, include_preview: true })
				return { request_id: res.request_id, chunks: res.chunks }
			},
			feedback: async (request_id: string, outcome: 'success' | 'failure') => {
				await this.feedback({ request_id, outcome })
			},
		}
	}

	private async post<T>(fn: string, body: unknown): Promise<T> {
		const res = await fetch(`${this.baseUrl}/functions/v1/${fn}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.anonKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: res.statusText }))
			throw new Error(`${fn}: ${(err as { error: string }).error ?? res.statusText}`)
		}
		return res.json() as Promise<T>
	}
}

export type {
	RoutedChunk,
	SkillFeedbackRequest,
	SkillFeedbackResponse,
	SkillRouterRequest,
	SkillRouterResponse,
} from './types.js'
