/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * All rights reserved.
 */
import { type AgentConfig, SupaAgentCore } from '@supa-agent/core'
import { PageController, type PageControllerConfig } from '@supa-agent/page-controller'
import { Panel, type PanelConfig } from '@supa-agent/ui'

export * from '@supa-agent/core'

export type SupaAgentConfig = AgentConfig & PageControllerConfig & Omit<PanelConfig, 'language'>

export class SupaAgent extends SupaAgentCore {
	panel: Panel

	constructor(config: SupaAgentConfig) {
		const pageController = new PageController({
			...config,
			enableMask: config.enableMask ?? true,
		})

		super({ ...config, pageController })

		this.panel = new Panel(this, {
			language: config.language,
			promptForNextTask: config.promptForNextTask,
		})
	}
}
