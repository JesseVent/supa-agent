/**
 * React hook for using AgentController
 */
import type {
	AgentActivity,
	AgentStatus,
	ExecutionResult,
	HistoricalEvent,
	SupportedLanguage,
} from '@supa-agent/core'
import type { LLMConfig } from '@supa-agent/llms'
import { SkillRouterClient } from '@supa-agent/skill-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { MultiPageAgent } from './MultiPageAgent'
import { DEMO_CONFIG } from './constants'
import { createSupabaseMcpTools } from './supabaseMcpTools'

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
	supabaseMcpAccessToken?: string
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
	execute: (task: string) => Promise<ExecutionResult>
	stop: () => void
	configure: (config: ExtConfig) => Promise<void>
}

export function useAgent(): UseAgentResult {
	const agentRef = useRef<MultiPageAgent | null>(null)
	const [status, setStatus] = useState<AgentStatus>('idle')
	const [history, setHistory] = useState<HistoricalEvent[]>([])
	const [activity, setActivity] = useState<AgentActivity | null>(null)
	const [currentTask, setCurrentTask] = useState('')
	const [config, setConfig] = useState<ExtConfig | null>(null)

	useEffect(() => {
		chrome.storage.local.get(['llmConfig', 'language', 'advancedConfig']).then((result) => {
			const llmConfig = (result.llmConfig as LLMConfig) ?? DEMO_CONFIG
			const language = (result.language as SupportedLanguage) || undefined
			const advancedConfig = (result.advancedConfig as AdvancedConfig) ?? {}

			if (!result.llmConfig) {
				chrome.storage.local.set({ llmConfig: DEMO_CONFIG })
			}

			setConfig({ ...llmConfig, ...advancedConfig, language })
		})
	}, [])

	useEffect(() => {
		if (!config) return

		const {
			systemInstruction,
			skillRouterUrl,
			skillRouterKey,
			skillRouterSkill,
			supabaseMcpProjectRef,
			supabaseMcpAccessToken,
			...agentConfig
		} = config

		const skillRouter =
			skillRouterUrl && skillRouterKey && skillRouterSkill
				? new SkillRouterClient(skillRouterUrl, skillRouterKey).asAdapter(skillRouterSkill)
				: undefined

		const customTools =
			supabaseMcpProjectRef && supabaseMcpAccessToken
				? createSupabaseMcpTools({
						projectRef: supabaseMcpProjectRef,
						accessToken: supabaseMcpAccessToken,
					})
				: undefined

		const supabaseHint =
			supabaseMcpProjectRef && supabaseMcpAccessToken
				? `You have supabase_* tools available for the project "${supabaseMcpProjectRef}". Use them proactively when the user asks about their database, schema, users, storage, logs, or project health — don't just browse the Supabase dashboard UI.`
				: undefined

		const systemParts = [systemInstruction, supabaseHint].filter(Boolean)

		const agent = new MultiPageAgent({
			...agentConfig,
			instructions: systemParts.length ? { system: systemParts.join('\n\n') } : undefined,
			skillRouter,
			customTools,
		})
		agentRef.current = agent

		const handleStatusChange = (e: Event) => {
			const newStatus = agent.status as AgentStatus
			setStatus(newStatus)
			if (newStatus === 'idle' || newStatus === 'completed' || newStatus === 'error') {
				setActivity(null)
			}
		}

		const handleHistoryChange = (e: Event) => {
			setHistory([...agent.history])
		}

		const handleActivity = (e: Event) => {
			const newActivity = (e as CustomEvent).detail as AgentActivity
			setActivity(newActivity)
		}

		agent.addEventListener('statuschange', handleStatusChange)
		agent.addEventListener('historychange', handleHistoryChange)
		agent.addEventListener('activity', handleActivity)

		return () => {
			agent.removeEventListener('statuschange', handleStatusChange)
			agent.removeEventListener('historychange', handleHistoryChange)
			agent.removeEventListener('activity', handleActivity)
			agent.dispose()
		}
	}, [config])

	const execute = useCallback(async (task: string) => {
		const agent = agentRef.current
		if (!agent) throw new Error('Agent not initialized')

		setCurrentTask(task)
		setHistory([])
		return agent.execute(task)
	}, [])

	const stop = useCallback(() => {
		agentRef.current?.stop()
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
			supabaseMcpAccessToken,
			...llmConfig
		}: ExtConfig) => {
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
				supabaseMcpAccessToken,
			}
			await chrome.storage.local.set({ advancedConfig })
			setConfig({ ...llmConfig, ...advancedConfig, language })
		},
		[]
	)

	return {
		status,
		history,
		activity,
		currentTask,
		config,
		execute,
		stop,
		configure,
	}
}
