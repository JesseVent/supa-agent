# Chrome Extension

An optional Chrome extension. PageAgent.js keeps handling in-page automation, while the extension API adds multi-page tasks, browser-level control, and tasks initiated from outside the browser.

## Key Features

- **🔓 Multi-Page Tasks** — Run tasks across multiple pages and tabs without being limited to a single page context.
- **Browser-Level Control** — Enable richer browser automation, including cross-tab navigation and page switching.
- **Open Integration API** — With explicit user authorization, page JS, local agents, or cloud agents can trigger multi-page tasks through the extension.

## Get the Extension

- [Install from Chrome Web Store](https://chromewebstore.google.com/detail/page-agent-ext/akldabonmimlicnjlflnapfeklbfemhj)
- [GitHub Releases](https://github.com/supabase/supabase/releases) (faster updates)

## How It Relates to PageAgent.js

PageAgent.js already works for in-page automation. The Chrome extension is optional, not a dependency.

With the extension, you can perform multi-page tasks, browser-level control, and tasks triggered outside the browser (local or cloud services).

## Third-Party Integration

By calling `window.PAGE_AGENT_EXT` from page JavaScript, your app can trigger multi-page tasks and control browser behavior.

### Authorization and Security

The extension has broad permissions (such as page access, navigation, and multi-tab control). If abused, it can harm user privacy. That is why access is protected by a token, and users must actively share the token only with applications they trust.

```javascript
// 1) Get auth token from the extension side panel
// 2) Set it only in trusted applications
// 3) After token match, extension exposes window.PAGE_AGENT_EXT

// Never provide the token to untrusted pages or scripts
localStorage.setItem('PageAgentExtUserAuthToken', '<your-token-from-extension>')
```

## API Reference

If you are using an AI coding assistant (like Cursor, GitHub Copilot), share these documentation links with it for better understanding of Page Agent Extension API:

- [API Documentation](https://github.com/supabase/supabase/blob/main/packages/extension/docs/extension_api.md)

### TypeScript Declaration

Add this `execute` declaration to your project for full type support.

```typescript
import type {
	AgentActivity,
	AgentStatus,
	ExecutionResult,
	HistoricalEvent
} from '@page-agent/core'

interface ExecuteConfig {
	baseURL: string   // LLM API endpoint
	model: string     // Model name
	apiKey?: string   // LLM AK

	systemInstruction?: string // Global system-level instructions
	includeInitialTab?: boolean
	experimentalIncludeAllTabs?: boolean // Control all unpinned tabs in the window
	onStatusChange?: (status: AgentStatus) => void
	onActivity?: (activity: AgentActivity) => void
	onHistoryUpdate?: (history: HistoricalEvent[]) => void
}

type Execute = (task: string, config: ExecuteConfig) => Promise<ExecutionResult>

declare global {
	interface Window {
		PAGE_AGENT_EXT_VERSION?: string
		PAGE_AGENT_EXT?: {
			version: string
			execute: Execute
			stop: () => void
		}
	}
}
```

### PAGE_AGENT_EXT.execute(task, config)

```javascript
// Execute a task with configuration
const result = await window.PAGE_AGENT_EXT.execute(
	'Search for "page-agent" on GitHub and open the first result',
	{
		baseURL: 'https://api.openai.com/v1',
		apiKey: 'your-api-key',
		model: 'gpt-5.2',
		// includeInitialTab: false, // Set to false to exclude initial tab
		// experimentalIncludeAllTabs: true, // Control all unpinned tabs in the window
		onStatusChange: status => console.log('Status change:', status),
		onActivity: activity => console.log('Activity:', activity),
		onHistoryUpdate: history => console.log('History update:', history)
	}
)

console.log(result) // Task execution result
```

### PAGE_AGENT_EXT.stop()

Stop the current running task.

```javascript
// Stop current task execution
window.PAGE_AGENT_EXT.stop()
```

## Integrate MultiPageAgent into Your Extension

@TODO

Start with the extension API docs, then use the background entry implementation as a reference. See [`packages/extension/src/entrypoints/background.ts`](https://github.com/supabase/supabase/blob/main/packages/extension/src/entrypoints/background.ts).
