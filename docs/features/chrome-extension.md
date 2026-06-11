# Chrome Extension

The SupaAgent Chrome extension adds multi-page automation, Supabase MCP integration, browser-level control, and an MCP server interface — all from the browser side panel.

## Key Features

- **Multi-page Tasks** — Run tasks across multiple pages and tabs without being limited to a single page context.
- **Multi-turn Conversation Memory** — The agent remembers the results of prior tasks in the session. Each completed turn is summarised and injected as context into the next request, so follow-up messages like "now check the logs for that table" work naturally. Click the turn counter in the header to clear conversation context and start fresh.
- **Supabase MCP** — OAuth-authenticated connection to your Supabase project. See [Supabase MCP](supabase-mcp.md).
- **Browser-Level Control** — Cross-tab navigation, tab groups, and page switching.
- **Agent Log** — A persistent structured log (IndexedDB) captures MCP connection events, task starts, completions, and errors. Accessible from History → Logs tab.
- **Open Integration API** — With explicit user authorisation, page JavaScript, local agents, or cloud agents can trigger multi-page tasks through the extension.

## Installing

### From source

```bash
bun run build:ext
# or
npm run build:ext
```

Load `packages/extension/output/chrome-mv3/` in Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `output/chrome-mv3/` directory

### From GitHub Releases

Download the `.zip` from [Releases](https://github.com/JesseVent/supa-agent/releases), extract it, and load unpacked as above.

## Permissions

The extension uses the Manifest V3 optional permissions model for broad host access.

| Permission | When granted |
|---|---|
| `tabs`, `storage`, `sidePanel`, `identity` | At install time (always required) |
| `<all_urls>` | At runtime — requested the first time the user runs a task |

`<all_urls>` is declared under `optional_host_permissions`. Chrome prompts the user once; subsequent runs resolve silently if already granted. If the user declines, the agent will still run but may be blocked from accessing pages on origins it hasn't been granted.

### Experimental: Control All Tabs

Enable **Experimental include all tabs** in Settings to let the agent read and interact with all unpinned browser tabs, not just the active one. An amber warning is shown in Settings when this option is on:

> ⚠️ This lets the agent control all unpinned tabs. Use with caution.

## Third-Party Page Integration

By calling `window.PAGE_AGENT_EXT` from page JavaScript, your app can trigger multi-page tasks. Access requires an explicit token match — the user must copy their auth token from the extension side panel and set it in `localStorage` in the trusted application.

### Authorization

```javascript
// Copy the auth token from the SupaAgent side panel → Settings → Auth Token
// Then set it in your trusted application:
localStorage.setItem('SupaAgentExtUserAuthToken', '<your-token-from-extension>')

// After token match, the extension exposes window.PAGE_AGENT_EXT
```

**Never share the token with untrusted pages or third-party scripts.** The token gives full browser automation access.

### TypeScript Declaration

```typescript
import type {
  AgentActivity,
  AgentStatus,
  ExecutionResult,
  HistoricalEvent
} from '@supa-agent/core'

interface ExecuteConfig {
  baseURL: string        // LLM API endpoint
  model: string          // Model name
  apiKey?: string        // LLM API key
  systemInstruction?: string
  experimentalIncludeAllTabs?: boolean
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
const result = await window.PAGE_AGENT_EXT.execute(
  'Search for "supa-agent" on GitHub and open the first result',
  {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: 'your-api-key',
    model: 'google/gemini-3.1-flash-lite',
    onStatusChange: status => console.log('Status:', status),
    onActivity: activity => console.log('Activity:', activity),
  }
)
console.log(result)
```

### PAGE_AGENT_EXT.stop()

```javascript
window.PAGE_AGENT_EXT.stop()
```
