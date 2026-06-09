# Chrome Extension

The SupaAgent Chrome extension adds multi-page automation, Supabase MCP integration, browser-level control, and an MCP server interface — all from the browser side panel.

## Key Features

- **Multi-page Tasks** — Run tasks across multiple pages and tabs without being limited to a single page context.
- **Supabase MCP** — OAuth-authenticated connection to your Supabase project. See [Supabase MCP](supabase-mcp.md).
- **Browser-Level Control** — Cross-tab navigation, tab groups, and page switching.
- **Open Integration API** — With explicit user authorisation, page JavaScript, local agents, or cloud agents can trigger multi-page tasks through the extension.

## Installing

### From source

```bash
cd packages/extension
pnpm run build:ext
```

Load `packages/extension/output/chrome-mv3/` in Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `output/chrome-mv3/` directory

### From GitHub Releases

Download the `.zip` from [Releases](https://github.com/JesseVent/supa-agent/releases), extract it, and load unpacked as above.

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
    model: 'google/gemini-2.5-flash',
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
