# SupaAgent

AI-powered browser automation with native Supabase integration. Control any web page with natural language, query your Supabase project directly from the browser, and automate multi-page workflows — all from a Chrome extension or a JavaScript library.

[![License: MIT](https://img.shields.io/badge/License-MIT-auto.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## What is SupaAgent?

SupaAgent is a Chrome extension and headless JavaScript library that lets you automate web pages using natural language. It is designed for developers who want to:

- Automate repetitive browser workflows
- Query and manage their Supabase project without leaving the browser
- Give their web app a natural-language interface for users
- Connect local or cloud AI agents to the browser via MCP

## Features

| Feature | Description |
|---|---|
| **Natural language browser control** | Click, type, scroll, and navigate using plain English |
| **Supabase MCP integration** | OAuth-connected access to your Supabase project — query DB, inspect logs, manage edge functions |
| **Multi-page & multi-tab tasks** | Cross-tab automation from a single instruction |
| **OpenRouter support** | Works with Claude, Gemini, GPT, DeepSeek, Grok, and any OpenRouter model |
| **MCP server** | Let local agents (Claude Desktop, Cursor, etc.) control your browser |
| **Skill Router** | Inject domain knowledge into the agent from an external knowledge base |
| **Side panel UI** | Real-time activity feed, step history, and Supabase connection status |
| **Headless core** | Use `@supa-agent/core` without any UI for server-side or testing workflows |

## Quick Start

### Chrome Extension

1. Get an [OpenRouter](https://openrouter.ai) API key
2. Build or download the extension (see [Releases](https://github.com/JesseVent/supa-agent/releases))
3. Load `packages/extension/output/chrome-mv3/` in Chrome → Developer mode → Load unpacked
4. Open the side panel, enter your API key, and describe your task

### Connect Supabase

Click **Connect with Supabase** in the extension settings to authenticate via OAuth. Once connected, the agent gets direct access to MCP tools (`execute_sql`, `list_tables`, `get_logs`, `get_advisors`, `list_edge_functions`, etc.) and can answer questions about your project without navigating the dashboard.

### JavaScript Library

```bash
npm install supa-agent
```

```ts
import { SupaAgent } from 'supa-agent'

const agent = new SupaAgent({
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'google/gemini-2.5-flash',
  apiKey: 'your-openrouter-key',
})

agent.panel.show()
await agent.execute('Find all tables in my Supabase project and summarise the schema')
```

### Headless (no UI)

```ts
import { SupaAgentCore } from '@supa-agent/core'

const agent = new SupaAgentCore({
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-sonnet-4-6',
  apiKey: 'your-openrouter-key',
  pageController,
})

const result = await agent.execute('Fill in the login form with email test@example.com')
```

### MCP Server (for Claude Desktop, Cursor, etc.)

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

## Supported Models

Any OpenRouter-compatible model works. Well-tested options:

| Provider | Model ID |
|---|---|
| Google | `google/gemini-2.5-flash` |
| Anthropic | `anthropic/claude-sonnet-4-6` |
| OpenAI | `openai/gpt-5.1` |
| DeepSeek | `deepseek/deepseek-v3` |
| xAI | `x-ai/grok-4` |

## Architecture

```
packages/
  core/           # @supa-agent/core — headless agent logic, tools, prompts
  supa-agent/     # supa-agent — SupaAgent class with built-in UI panel
  extension/      # Chrome extension (WXT + React)
  llms/           # @supa-agent/llms — OpenAI-compatible LLM client
  page-controller/# @supa-agent/page-controller — DOM extraction & element interaction
  ui/             # @supa-agent/ui — Panel component and i18n
  mcp/            # @supa-agent/mcp — MCP server for external agent control
  skill-router/   # @supa-agent/skill-router — domain knowledge injection
```

## Development

```bash
# Install dependencies
pnpm install

# Extension dev server (hot reload)
pnpm run dev:ext

# Build extension
pnpm run build:ext

# Build all packages
pnpm run build

# Type check
pnpm run typecheck

# Lint
pnpm run lint
```

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| Base URL | `https://openrouter.ai/api/v1` | OpenAI-compatible API endpoint |
| Model | `google/gemini-2.5-flash` | Model ID |
| API Key | — | Your OpenRouter API key |
| Max Steps | 40 | Maximum agent steps per task |
| System Instruction | — | Custom instructions appended to every task |
| Supabase Project | — | Connect via OAuth to enable MCP tools |

## Documentation

Full documentation is in [`docs/`](./docs/README.md):

- [Overview](docs/introduction/overview.md)
- [Quick Start](docs/introduction/quick-start.md)
- [Chrome Extension](docs/features/chrome-extension.md)
- [Supabase MCP](docs/features/supabase-mcp.md)
- [MCP Server](docs/features/mcp-server.md)
- [Custom Tools](docs/features/custom-tools.md)
- [Custom Instructions](docs/features/custom-instructions.md)
- [Models](docs/features/models.md)
- [SupaAgentCore API](docs/advanced/supa-agent-core.md)
- [Changelog](docs/CHANGELOG.md)

## Manual Testing Checklist

Before pushing a release, verify these features manually in the side panel:

### 🎨 Theme toggle
1. Click the **sun/moon icon** in the header — it cycles `system → light → dark → system`
2. Check the **Theme** dropdown in Settings matches
3. Close and reopen the extension — the chosen theme persists

### 💬 Session continuation
1. Run a task (e.g. *"List tables"*)
2. Close the sidepanel completely
3. Reopen it — the **"Session active · N prior tasks"** banner should appear
4. Send a follow-up — it should reference the prior conversation turn

### 🧠 Preserve memory across settings changes
1. Go to **Settings → Advanced** → enable **"Preserve memory across settings changes"**
2. Change the model name → **Save**
3. The session banner should **still show** prior tasks (not cleared)

### 🎯 Example prompts
1. Clear the conversation to reach the empty state
2. Verify all **5 chips** appear: *List tables*, *Check logs*, *Summarize page*, *Harden Data API*, *Fill form*

| Chip | Expected result |
|---|---|
| **List tables** | Uses MCP to return a list of tables from the connected Supabase project |
| **Check logs** | Uses MCP to return recent logs from the connected Supabase project |
| **Summarize page** | Reads the current page DOM and returns a text summary |
| **Harden Data API** | Navigates to Supabase dashboard → Integrations → Data API → Settings → scrolls to "Harden Data API" → clicks button → expands Option 1 accordion → copies SQL → returns to chat |
| **Fill form** | Detects input fields on the current page and types sensible sample values |

### 🔄 Navigation retry (no errors)
1. Run any multi-page task (the Data API example is good)
2. Open the service-worker background console
3. There should be **zero** `"Receiving end does not exist"` errors — only `warn`-level transient-port messages if any

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/developer-guide.md](./docs/developer-guide.md).

## License

MIT — see [LICENSE](./LICENSE)
