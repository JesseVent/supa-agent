# Models

Supports models that comply with OpenAI API specification and support tool calls, including public cloud services and private deployments.

## Tested Models

Baseline-tested (marked with `*`): `minimax/minimax-m3`, `anthropic/claude-sonnet-4-6`, `openai/gpt-5.1`.

**OpenRouter:** `minimax/minimax-m3`*, `anthropic/claude-sonnet-4-6`*, `openai/gpt-5.1`*, `openai/gpt-5.4-mini`, `anthropic/claude-haiku-4.5`, `deepseek/deepseek-v4-flash`

**OpenAI:** `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.2`, `gpt-5.1`*, `gpt-5`, `gpt-5-mini`, `gpt-4.1`, `gpt-4.1-mini`

**DeepSeek:** `deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-3.2`

**Google:** `gemini-3.1-flash-lite`, `gemini-3-pro`, `gemini-3-flash`, `gemini-2.5`

**Anthropic:** `claude-opus-4.7`, `claude-opus-4.6`, `claude-opus-4.5`, `claude-sonnet-4.5`, `claude-haiku-4.5`, `claude-sonnet-3.5`

**MiniMax:** `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`

**xAI:** `grok-4.1-fast`, `grok-4`, `grok-code-fast`

**MoonshotAI:** `kimi-k2.5`

**Z.AI:** `glm-5`, `glm-4.7`

## Tips

- Recommended: Fast, lightweight models with strong ToolCall capabilities
- Models with weaker ToolCall capabilities may return incorrect formats. Common errors usually auto-recover. Higher temperature recommended
- Small models or those unable to handle complex tool definitions typically perform poorly

## Configuration

```javascript
// OpenRouter
const supaAgent = new SupaAgent({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: 'your-api-key',
  model: 'minimax/minimax-m3'
});
```

## Production Authentication

If you only use it as a personal assistant, you can connect to your LLM service directly.

If you plan to integrate it into your web app, it's better to have a backend proxy for the LLM and use `customFetch` to authenticate the request with cookies or other methods:

```javascript
const agent = new SupaAgent({
  baseURL: '/api/llm-proxy',
  model: 'minimax/minimax-m3',
  customFetch: (url, init) =>
    fetch(url, { ...init, credentials: 'include' }),
});
```

> ⚠️ **NEVER commit real LLM API keys to your frontend code**

## Prompt Caching

Some LLMs benefit significantly from prompt caching. Because each provider exposes caching differently, use `transformRequestBody` to add provider-specific cache hints.

### Claude

Claude supports global Automatic prompt caching. When using a Claude-compatible proxy, add `cache_control` at the top level of the request body.

```typescript
const supaAgent = new SupaAgent({
  baseURL: 'https://your-claude-proxy.example/v1',
  apiKey: 'your-api-key',
  model: 'claude-sonnet-4.5',
  transformRequestBody: (requestBody) => ({
    ...requestBody,
    cache_control: { type: 'ephemeral' },
  }),
});
```

## Local LLMs

Use local OpenAI-compatible runtimes such as Ollama and LM Studio with SupaAgent for offline or LAN deployments.

### Requirements

- Enable CORS, otherwise the browser cannot call your local LLM endpoint directly.
- Set context length or content length to at least 8000. A typical page often needs around 15k tokens, so the default 4k usually truncates prompts.
- Use a model with tool_call support.
- Models smaller than 10B are usually not strong enough.

### Basic Configuration

```javascript
// Local OpenAI-compatible runtime - no apiKey needed
const supaAgent = new SupaAgent({
  baseURL: 'http://localhost:11434/v1',
  model: 'qwen3:14b'
});

// Or connect to LM Studio
const lmStudioAgent = new SupaAgent({
  baseURL: 'http://127.0.0.1:1234/v1',
  model: 'qwen/qwen3.5-27b'
});
```

### Ollama

Tested on Ollama 0.15 with `qwen3:14b` (RTX3090 24GB).

```bash
LLM_BASE_URL="http://localhost:11434/v1"
LLM_MODEL_NAME="qwen3:14b"
```

> ⚠️ **Warning** — If browser-side requests fail, check whether Ollama has CORS enabled as required above.

#### Recommended Startup

When starting Ollama, increase the context window and enable cross-origin access.

macOS / Linux:

```bash
OLLAMA_CONTEXT_LENGTH=64000 OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve
```

Windows (PowerShell):

```powershell
$env:OLLAMA_CONTEXT_LENGTH=64000; $env:OLLAMA_HOST="0.0.0.0:11434"; $env:OLLAMA_ORIGINS="*"; ollama serve
```

### LM Studio

```bash
LLM_BASE_URL="http://127.0.0.1:1234/v1"
LLM_MODEL_NAME="qwen/qwen3.5-27b"
```

> ⚠️ **Warning** — Enable `disableNamedToolChoice` in the agent config, otherwise the `tool_choice` parameter may fail.
