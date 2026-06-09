# Quick Start

## Chrome Extension

The fastest way to use SupaAgent.

1. **Get an API key** from [OpenRouter](https://openrouter.ai) (free tier available)
2. **Build or download** the extension:
   - From source: `pnpm run build:ext` inside `packages/extension/`
   - From [GitHub Releases](https://github.com/JesseVent/supa-agent/releases)
3. **Load in Chrome**: go to `chrome://extensions/` → enable Developer mode → Load unpacked → select `packages/extension/output/chrome-mv3/`
4. **Open the side panel**: click the SupaAgent icon in the toolbar
5. **Enter your API key** in Settings
6. **Describe your task** and press Enter

### Connect Supabase (optional)

In the extension settings, click **Connect with Supabase** to authenticate via OAuth. This gives the agent access to your Supabase project via MCP — database queries, logs, edge functions, and more.

---

## NPM Package

```bash
npm install supa-agent
# or
pnpm add supa-agent
```

```ts
import { PageAgent } from 'supa-agent'

const agent = new PageAgent({
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-2.5-flash',
  apiKey: 'YOUR_OPENROUTER_KEY',
})

// Show the built-in panel for user input
agent.panel.show()

// Or execute programmatically
await agent.execute('Click the submit button and wait for the confirmation message')
```

---

## Headless (no UI)

Use `@supa-agent/core` for server-side or test automation:

```bash
npm install @supa-agent/core @supa-agent/page-controller
```

```ts
import { PageAgentCore } from '@supa-agent/core'
import { PageController } from '@supa-agent/page-controller'

const pageController = new PageController()

const agent = new PageAgentCore({
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-sonnet-4-6',
  apiKey: 'YOUR_OPENROUTER_KEY',
  pageController,
})

const result = await agent.execute('Fill in the login form with email test@example.com')
console.log(result)
```

---

## MCP Server

Let Claude Desktop, Cursor, or any MCP-compatible client control your browser:

```json
{
  "mcpServers": {
    "supa-agent": {
      "command": "npx",
      "args": ["-y", "@supa-agent/mcp"],
      "env": {
        "LLM_BASE_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "your-openrouter-key",
        "LLM_MODEL_NAME": "google/gemini-2.5-flash"
      }
    }
  }
}
```

The MCP server exposes `execute_task`, `set_config`, `get_config`, `get_status`, and `stop_task` tools. The first time it runs, a Hub tab opens in Chrome — approve the connection when prompted.
