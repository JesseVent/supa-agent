/**
 * React hook for using AgentController
 */
import {
	type AgentActivity,
	type AgentStatus,
	type ExecutionResult,
	type HistoricalEvent,
	type SupportedLanguage,
	sanitizeUntrusted,
} from '@supa-agent/core'
import type { LLMConfig } from '@supa-agent/llms'
import { SkillRouterClient } from '@supa-agent/skill-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { writeLog } from '@/lib/db'
import { DEMO_CONFIG } from './constants'
import { MultiPageAgent } from './MultiPageAgent'
import { adaptMcpTools } from './mcpToolAdapter'
import { SUPABASE_MIGRATION_INSTRUCTION } from './migrationInstruction'
import { SupabaseMcpClient } from './SupabaseMcpClient'

function isMigrationTask(task: string): boolean {
	return /\b(migrat(e|ion)|region transfer|cutover|move project|transfer project)\b/i.test(task)
}

function sanitizeMcpError(raw: string): string {
	return raw
		.replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[token]')
		.split('\n')[0]
		.slice(0, 120)
}

/** A single completed turn in the current conversation session */
interface ConversationTurn {
	task: string
	summary: string
	success: boolean
}

/** Language preference: undefined means follow system */
export type LanguagePreference = SupportedLanguage | undefined

export interface AdvancedConfig {
	maxSteps?: number
	systemInstruction?: string
	experimentalLlmsTxt?: boolean
	experimentalIncludeAllTabs?: boolean
	disableNamedToolChoice?: boolean
	skillRouterUrl?: string
	skillRouterKey?: string
	skillRouterSkill?: string
	supabaseMcpProjectRef?: string
	supabaseMcpProjectName?: string
	supabaseMcpAccessToken?: string
	/**
	 * Allow the agent to run write/destructive Supabase MCP operations.
	 * Default false: the MCP connection is read-only and write tools are blocked
	 * in code. Destructive ops still require explicit confirmation even when enabled.
	 */
	allowMcpWrites?: boolean
	/** Whitelist of domains the agent may interact with. Empty = allow all. */
	allowedDomains?: string[]
	/** Theme preference. 'system' follows OS setting. */
	theme?: 'system' | 'light' | 'dark'
	/**
	 * Keep conversation memory when config changes.
	 * When true, prior conversation turns survive across reconfigures.
	 */
	preserveMemory?: boolean
}

export interface ExtConfig extends LLMConfig, AdvancedConfig {
	language?: LanguagePreference
}

export interface UseAgentResult {
	status: AgentStatus
	history: HistoricalEvent[]
	activity: AgentActivity | null
	currentTask: string
	config: ExtConfig | null
	mcpStatus: 'idle' | 'loading' | 'connected' | 'error'
	mcpError: string | null
	conversationTurnCount: number
	execute: (task: string) => Promise<ExecutionResult>
	stop: () => void
	configure: (config: ExtConfig) => Promise<void>
	clearConversation: () => void
	/** Current effective theme ('light' | 'dark') derived from preference + system */
	effectiveTheme: 'light' | 'dark'
}

function buildSupabaseHint(projectLabel: string, projectRef: string, allowWrites: boolean): string {
	const writePolicy = allowWrites
		? `Writes are ENABLED. Destructive operations (DROP/DELETE/TRUNCATE/ALTER, migrations, deleting secrets/functions, pausing projects) still trigger a mandatory confirmation prompt and must be explicitly requested by the user.`
		: `This connection is READ-ONLY. Write and destructive MCP tools are BLOCKED in code and will return a "Blocked" message. Do not attempt them — if the task needs a write, call done and tell the user to enable "Allow MCP writes" in Settings.`

	return `\
You have Supabase MCP tools available for project "${projectLabel}" (ref: ${projectRef}).
Available tools: execute_sql, list_tables, list_projects, get_project, get_logs, get_advisors, list_edge_functions, get_publishable_keys, and others.

RULES — read carefully before every action:
1. For read-only tasks (check types, view schema, list data, inspect logs) — use MCP query tools. Do NOT navigate the Supabase dashboard UI unless the user explicitly asks you to open the dashboard.
2. ${writePolicy}
3. NEVER initiate a migration, region transfer, or cutover unless the user's message contains an explicit word like "migrate", "migration", "move project", or "transfer region". If you are unsure, call done and ask for clarification.
4. If a request is ambiguous about whether an operation is destructive, stop and ask the user to confirm before proceeding.`
}

export function useAgent(): UseAgentResult {
	const agentRef = useRef<MultiPageAgent | null>(null)
	const configRef = useRef<ExtConfig | null>(null)
	/** Accumulated prior turns — persists across execute() calls until clearConversation() */
	const conversationRef = useRef<ConversationTurn[]>([])
	const [status, setStatus] = useState<AgentStatus>('idle')
	const [history, setHistory] = useState<HistoricalEvent[]>([])
	const [activity, setActivity] = useState<AgentActivity | null>(null)
	const [currentTask, setCurrentTask] = useState('')
	const [config, setConfig] = useState<ExtConfig | null>(null)
	const [mcpStatus, setMcpStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle')
	const [mcpError, setMcpError] = useState<string | null>(null)
	const [conversationTurnCount, setConversationTurnCount] = useState(0)
	const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
		matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
	)

	/** Resolve stored theme preference into an effective light/dark value. */
	const resolveTheme = useCallback((pref?: 'system' | 'light' | 'dark'): 'light' | 'dark' => {
		if (pref === 'light') return 'light'
		if (pref === 'dark') return 'dark'
		return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
	}, [])

	useEffect(() => {
		chrome.storage.local
			.get(['llmConfig', 'language', 'advancedConfig', 'conversationHistory'])
			.then((result) => {
				const llmConfig = (result.llmConfig as LLMConfig) ?? DEMO_CONFIG
				const language = (result.language as SupportedLanguage) || undefined
				const advancedConfig = (result.advancedConfig as AdvancedConfig) ?? {}
				const storedHistory = (result.conversationHistory as ConversationTurn[]) ?? []

				if (!result.llmConfig) {
					chrome.storage.local.set({ llmConfig: DEMO_CONFIG })
				}

				if (storedHistory.length > 0) {
					conversationRef.current = storedHistory
					setConversationTurnCount(storedHistory.length)
				}

				setConfig({ ...llmConfig, ...advancedConfig, language })
				setEffectiveTheme(resolveTheme(advancedConfig.theme))
			})
	}, [resolveTheme])

	useEffect(() => {
		if (config?.theme === 'system' || !config?.theme) {
			const listener = (e: MediaQueryListEvent) =>
				setEffectiveTheme(e.matches ? 'dark' : 'light')
			matchMedia('(prefers-color-scheme: dark)').addEventListener('change', listener)
			return () =>
				matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', listener)
		}
	}, [config?.theme])

	useEffect(() => {
		if (!config) return

		let disposed = false
		let createdAgent: MultiPageAgent | null = null

		configRef.current = config

		const {
			systemInstruction,
			skillRouterUrl,
			skillRouterKey,
			skillRouterSkill,
			supabaseMcpProjectRef,
			supabaseMcpProjectName,
			supabaseMcpAccessToken,
			allowMcpWrites,
			...agentConfig
		} = config

		const skillRouter =
			skillRouterUrl && skillRouterKey && skillRouterSkill
				? new SkillRouterClient(skillRouterUrl, skillRouterKey).asAdapter(skillRouterSkill)
				: undefined

		const handleStatusChange = () => {
			const agent = createdAgent
			if (!agent) return
			const newStatus = agent.status as AgentStatus
			setStatus(newStatus)
			if (newStatus === 'idle' || newStatus === 'completed' || newStatus === 'error') {
				setActivity(null)
			}
		}
		const handleHistoryChange = () => {
			if (createdAgent) setHistory([...createdAgent.history])
		}
		const handleActivity = (e: Event) => {
			setActivity((e as CustomEvent).detail as AgentActivity)
		}

		;(async () => {
			let customTools: Record<string, import('@supa-agent/core').SupaAgentTool> | undefined
			let supabaseHint: string | undefined

			if (supabaseMcpProjectRef) {
				try {
					const client = new SupabaseMcpClient({
						projectRef: supabaseMcpProjectRef,
						// When accessToken is omitted, SupabaseMcpClient reads the OAuth
						// mgmt token from chrome.storage (SupaAgentMgmtToken) and auto-refreshes.
						accessToken: supabaseMcpAccessToken || undefined,
						// Default to a read-only MCP connection (server-side enforcement);
						// code-level write/destructive gating is applied in adaptMcpTools.
						readOnly: !allowMcpWrites,
					})
					customTools = await adaptMcpTools(client, { allowWrites: !!allowMcpWrites })
					setMcpStatus('connected')
					setMcpError(null)
					const projectLabel = supabaseMcpProjectName || supabaseMcpProjectRef
					void writeLog({
						level: 'success',
						source: 'mcp',
						message: `Connected to project ${projectLabel}`,
						detail: supabaseMcpProjectRef,
					})
					supabaseHint = buildSupabaseHint(
						projectLabel,
						supabaseMcpProjectRef,
						!!allowMcpWrites
					)
				} catch (err) {
					const mcpErr = err instanceof Error ? err.message : 'MCP connection failed'
					console.warn('[useAgent] MCP tools unavailable:', err)
					setMcpStatus('error')
					setMcpError(mcpErr)
					const safeErr = sanitizeMcpError(mcpErr)
					void writeLog({
						level: 'error',
						source: 'mcp',
						message: `MCP connection failed for ${supabaseMcpProjectRef}`,
						detail: safeErr,
					})
					supabaseHint = `A Supabase project ("${supabaseMcpProjectRef}") is configured but the MCP tools failed to load (${safeErr}). You do NOT have MCP tools right now. Fall back to browser actions and inform the user that Supabase integration is offline.`
				}
			} else {
				setMcpStatus('idle')
				setMcpError(null)
			}

			if (disposed) return

			const systemParts = [systemInstruction, supabaseHint].filter(Boolean)

			const agent = new MultiPageAgent({
				...agentConfig,
				instructions: systemParts.length ? { system: systemParts.join('\n\n') } : undefined,
				skillRouter,
				customTools,
			})
			createdAgent = agent
			agentRef.current = agent

			// Wire a confirmation/question callback. This both enables the `ask_user`
			// tool and powers the mandatory confirmation for destructive MCP operations
			// in adaptMcpTools. Uses a native prompt in the side panel context.
			agent.onAskUser = (question: string) => Promise.resolve(window.prompt(question) ?? '')

			agent.addEventListener('statuschange', handleStatusChange)
			agent.addEventListener('historychange', handleHistoryChange)
			agent.addEventListener('activity', handleActivity)
		})()

		return () => {
			disposed = true
			if (createdAgent) {
				createdAgent.removeEventListener('statuschange', handleStatusChange)
				createdAgent.removeEventListener('historychange', handleHistoryChange)
				createdAgent.removeEventListener('activity', handleActivity)
				createdAgent.dispose()
				agentRef.current = null
			}
		}
	}, [config])

	const execute = useCallback(async (task: string) => {
		const agent = agentRef.current
		if (!agent) throw new Error('Agent not initialized')

		setCurrentTask(task)
		setHistory([])

		// Build conversation context from prior turns in this session
		const priorTurns = conversationRef.current
		let effectiveTask = task

		if (priorTurns.length > 0) {
			// Prior-turn task text and model summaries are untrusted — defuse any framing
			// tags so an earlier turn cannot forge prompt structure for the next one.
			const contextLines = priorTurns
				.map(
					(t, i) =>
						`[Turn ${i + 1}] ${t.success ? '✓' : '✗'} "${sanitizeUntrusted(t.task)}" → ${sanitizeUntrusted(t.summary)}`
				)
				.join('\n')
			effectiveTask = `<conversation_history>\n${contextLines}\n</conversation_history>\n\nCurrent request: ${task}`
		}

		// Inject migration instruction only when the task explicitly requests migration.
		// This avoids wasting ~195 lines of tokens on every non-migration task.
		if (configRef.current?.supabaseMcpProjectRef && isMigrationTask(task)) {
			effectiveTask = `${SUPABASE_MIGRATION_INSTRUCTION}\n\n---\n\n${effectiveTask}`
		}

		void writeLog({ level: 'info', source: 'agent', message: `Task started`, detail: task })

		try {
			const result = await agent.execute(effectiveTask)

			// Append this turn so the next message has context
			const summary =
				result.data?.slice(0, 300) || (result.success ? 'Completed.' : 'Failed.')
			conversationRef.current = [...priorTurns, { task, summary, success: result.success }]
			setConversationTurnCount(conversationRef.current.length)
			void chrome.storage.local.set({ conversationHistory: conversationRef.current })

			void writeLog({
				level: result.success ? 'success' : 'error',
				source: 'agent',
				message: result.success ? 'Task completed' : 'Task failed',
				detail: task,
			})
			return result
		} catch (err) {
			void writeLog({
				level: 'error',
				source: 'agent',
				message: `Task threw: ${err instanceof Error ? err.message : String(err)}`,
				detail: task,
			})
			throw err
		}
	}, [])

	const stop = useCallback(() => {
		agentRef.current?.stop()
	}, [])

	const clearConversation = useCallback(() => {
		conversationRef.current = []
		setConversationTurnCount(0)
		void chrome.storage.local.remove('conversationHistory')
	}, [])

	const configure = useCallback(
		async ({
			language,
			maxSteps,
			systemInstruction,
			experimentalLlmsTxt,
			experimentalIncludeAllTabs,
			disableNamedToolChoice,
			skillRouterUrl,
			skillRouterKey,
			skillRouterSkill,
			supabaseMcpProjectRef,
			supabaseMcpProjectName,
			supabaseMcpAccessToken,
			allowMcpWrites,
			allowedDomains,
			theme,
			preserveMemory,
			...llmConfig
		}: ExtConfig) => {
			// Clear conversation when config changes unless user asked to preserve memory
			if (!preserveMemory) {
				conversationRef.current = []
				setConversationTurnCount(0)
			}

			await chrome.storage.local.set({ llmConfig })
			if (language) {
				await chrome.storage.local.set({ language })
			} else {
				await chrome.storage.local.remove('language')
			}
			const advancedConfig: AdvancedConfig = {
				maxSteps,
				systemInstruction,
				experimentalLlmsTxt,
				experimentalIncludeAllTabs,
				disableNamedToolChoice,
				skillRouterUrl,
				skillRouterKey,
				skillRouterSkill,
				supabaseMcpProjectRef,
				supabaseMcpProjectName,
				supabaseMcpAccessToken,
				allowMcpWrites,
				allowedDomains,
				theme,
				preserveMemory,
			}
			await chrome.storage.local.set({ advancedConfig })
			setConfig({ ...llmConfig, ...advancedConfig, language })
			setEffectiveTheme(resolveTheme(theme))
		},
		[resolveTheme]
	)

	return {
		status,
		history,
		activity,
		currentTask,
		config,
		mcpStatus,
		mcpError,
		conversationTurnCount,
		execute,
		stop,
		configure,
		clearConversation,
		effectiveTheme,
	}
}
