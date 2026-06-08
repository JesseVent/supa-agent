/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * All rights reserved.
 */
import { type AgentConfig, PageAgentCore } from '@supa-agent/core'
import { PageController, type PageControllerConfig } from '@supa-agent/page-controller'
import { Panel, type PanelConfig } from '@supa-agent/ui'

export * from '@supa-agent/core'

export type PageAgentConfig = AgentConfig & PageControllerConfig & Omit<PanelConfig, 'language'>

export class PageAgent extends PageAgentCore {
	panel: Panel

	constructor(config: PageAgentConfig) {
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
