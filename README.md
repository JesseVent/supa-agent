# SupaAgent

AI-powered browser automation assistant. Control web pages with natural language, powered by OpenRouter.

[![License: MIT](https://img.shields.io/badge/License-MIT-auto.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/page-agent)](https://bundlephobia.com/package/page-agent)

## What is SupaAgent?

SupaAgent is a browser extension and JavaScript library that lets you automate web pages using natural language. Describe what you want done, and the agent interacts with the page for you -- clicking, typing, scrolling, and navigating across tabs.

Built on the Page Agent core, rebranded with Supabase design language and configured for OpenRouter.

## Features

- Natural language control of any web page
- Multi-page and multi-tab task execution
- Side panel UI with real-time activity feed
- Hub mode for external control via WebSocket (MCP integration)
- OpenRouter support -- works with Claude, GPT, Gemini, DeepSeek, and more
- Supabase design system styling

## Quick Start

### Browser Extension

1. Get an [OpenRouter](https://openrouter.ai) API key
2. Load the extension from `packages/extension/.output/chrome-mv3/` in Chrome (Developer mode)
3. Open the side panel, enter your OpenRouter API key
4. Describe your task and press Enter

### JavaScript Library

```html
<script type="module">
  import { PageAgent } from 'page-agent'

  const agent = new PageAgent({
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash',
    apiKey: 'your-openrouter-key',
  })
</script>
```

### NPM Package

```bash
npm install page-agent
```

```ts
import { PageAgentCore } from '@supa-agent/core'

const agent = new PageAgentCore({
  baseURL: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-sonnet-4-6',
  apiKey: 'your-openrouter-key',
})

const result = await agent.execute('Fill in the login form with email test@example.com')
```

## Supported Models

SupaAgent works with any OpenRouter-compatible model:

| Provider | Model ID |
|----------|----------|
| Google | `google/gemini-2.5-flash` |
| Anthropic | `anthropic/claude-sonnet-4-6` |
| OpenAI | `openai/gpt-5.1` |
| DeepSeek | `deepseek/deepseek-v4-pro` |
| xAI | `x-ai/grok-4` |

## Architecture

```
packages/
  core/              # Core agent logic (headless)
  page-agent/        # Main entry with UI panel
  extension/         # Chrome extension (WXT + React)
  llms/              # LLM client with model-specific patches
  page-controller/   # DOM operations and visual feedback
  ui/                # Panel component and i18n
  mcp/               # MCP server for external control
  website/           # Documentation site
```

### Module Boundaries

- **Page Agent** extends PageAgentCore and adds the UI Panel
- **Core** contains agent logic, tool definitions, and prompt templates
- **LLMs** handles OpenAI-compatible API calls with model-specific patches
- **Page Controller** manages DOM extraction and element interactions
- **UI** provides the side panel component and translations

## Development

```bash
# Install dependencies
bun install

# Start dev server (website)
npm start

# Start extension dev
npm run dev:ext

# Build all packages
npm run build

# Build extension only
npm run build:ext

# Type check
npm run typecheck

# Lint
npm run lint
```

## Configuration

### Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Base URL | `https://openrouter.ai/api/v1` | OpenAI-compatible API endpoint |
| Model | `google/gemini-2.5-flash` | Model ID to use |
| API Key | - | Your OpenRouter API key |
| Max Steps | 40 | Maximum agent steps per task |
| Response Language | System | Language for agent responses |

### Advanced

- **System Instruction** -- Custom instructions appended to the agent prompt
- **Disable named tool_choice** -- For models that don't support named tool selection
- **Experimental llms.txt** -- Enable llms.txt context fetching
- **Experimental include all tabs** -- Include all browser tabs in agent context

## License

MIT
