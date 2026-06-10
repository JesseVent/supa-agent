# Quick Start

## Chrome Extension

The fastest way to use SupaAgent.

1. **Get an API key** from [OpenRouter](https://openrouter.ai) (free tier available)
2. **Build or download** the extension:
   - From source: `bun run build:ext` (or `npm run build:ext`)
   - From [GitHub Releases](https://github.com/JesseVent/supa-agent/releases)
3. **Load in Chrome**: go to `chrome://extensions/` → enable Developer mode → Load unpacked → select `packages/extension/output/chrome-mv3/`
4. **Open the side panel**: click the SupaAgent icon in the toolbar
5. **Enter your API key** in Settings
6. **Describe your task** and press Enter

### Connect Supabase (optional)

You can connect your Supabase project in two ways:
*   **OAuth (Recommended)**: Click **Connect with Supabase** to authenticate via secure OAuth 2.1 (Dynamic Client Registration + PKCE).
*   **Manual**: Expand **Advanced** settings and provide your **Project Ref** and **Personal Access Token (`sbp_...`)**.

This grants the agent access to Supabase MCP tools (database queries, logs, edge functions, etc.) for direct project management.

---

## NPM Package (Server-Side)

For server-side browser automation (Node.js/Bun) or headless scripts, use `@supa-agent/core` and `@supa-agent/page-controller`. Sourced credentials and configuration should be loaded securely from your environment or `.env` file:

```bash
npm install @supa-agent/core @supa-agent/page-controller
# or
bun add @supa-agent/core @supa-agent/page-controller
```

```ts
import { SupaAgentCore } from '@supa-agent/core'
import { PageController } from '@supa-agent/page-controller'

// Create controller for browser DOM operations
const pageController = new PageController()

// Initialize the agent server-side
const agent = new SupaAgentCore({
  baseURL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  model: process.env.LLM_MODEL_NAME || 'google/gemini-2.5-flash',
  apiKey: process.env.LLM_API_KEY, // Sourced from .env
  pageController,
})

const result = await agent.execute('Click the submit button and wait for the confirmation message')
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
