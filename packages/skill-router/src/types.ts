export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW-MEDIUM' | 'LOW'
export type OutcomeType = 'success' | 'failure' | 'partial'

// ── DB row types ──────────────────────────────────────────────────────────────

export interface SkillChunk {
	id: string
	skill_name: string
	title: string
	impact: ImpactLevel
	impact_description: string | null
	tags: string[]
	category: string
	content: string
	content_hash: string
	ingested_at: string
	updated_at: string
}

export interface RetrievalEvent {
	id: string
	request_id: string
	skill_name: string
	prompt_hash: string
	prompt_preview: string | null
	chunk_id: string
	rank: number
	score: number
	relevance_reason: string
	retrieved_at: string
}

export interface FeedbackEvent {
	id: string
	request_id: string
	outcome: OutcomeType
	task_type: string | null
	notes: string | null
	created_at: string
}

// ── Edge function I/O ─────────────────────────────────────────────────────────

export interface SkillRouterRequest {
	prompt: string
	skill_name: string
	top_k?: number
	include_preview?: boolean
}

export interface RoutedChunk {
	id: string
	title: string
	content: string
	tags: string[]
	impact: ImpactLevel
	score: number
	rank: number
	relevance_reason: string
}

export interface SkillRouterResponse {
	request_id: string
	skill_name: string
	chunks: RoutedChunk[]
}

export interface SkillFeedbackRequest {
	request_id: string
	outcome: OutcomeType
	task_type?: string
	notes?: string
}

export interface SkillFeedbackResponse {
	ok: true
	feedback_id: string
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

export interface ParsedChunk {
	id: string
	skill_name: string
	title: string
	impact: ImpactLevel
	impact_description: string | null
	tags: string[]
	category: string
	content: string
	content_hash: string
}
