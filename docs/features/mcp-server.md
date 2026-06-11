# MCP Server

SupaAgent ships an MCP server (`@supa-agent/mcp`) that lets external AI clients — Claude Desktop, Cursor, Windsurf, or any MCP-compatible host — send natural-language browser tasks to the extension.

## How to use

1. Install SupaAgent in Chrome (see [Chrome Extension](chrome-extension.md))
2. Add the MCP server to your AI client's config
3. Start the client — the MCP server opens a Hub tab in Chrome
4. Approve the connection when prompted
5. Ask your agent to do something in the browser

## Configuration

### Claude Desktop / Cursor / Windsurf

```json
{
  "mcpServers": {
    "supa-agent": {
      "command": "npx",
      "args": ["-y", "@supa-agent/mcp"],
      "env": {
        "LLM_BASE_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "your-openrouter-key",
        "LLM_MODEL_NAME": "google/gemini-3.1-flash-lite"
      }
    }
  }
}
```

### With Hub auth token (for shared or headless environments)

```json
{
  "mcpServers": {
    "supa-agent": {
      "command": "npx",
      "args": ["-y", "@supa-agent/mcp"],
      "env": {
        "LLM_BASE_URL": "https://openrouter.ai/api/v1",
        "LLM_API_KEY": "your-openrouter-key",
        "LLM_MODEL_NAME": "google/gemini-3.1-flash-lite",
        "HUB_AUTH_TOKEN": "your-hub-token"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|---|---|
| `execute_task` | Run a natural-language browser task |
| `set_config` | Update agent configuration (model, API key, etc.) |
| `get_config` | Read current agent configuration |
| `get_status` | Check whether the agent is idle or running |
| `stop_task` | Abort a running task |

## The Hub

The Hub is the local WebSocket bridge between the MCP server and the Chrome extension. When the MCP server starts, it:

1. Starts a local HTTP + WebSocket server (default port `38401`)
2. Opens a launcher page in the default browser
3. The launcher asks the extension to open the Hub tab
4. The Hub tab receives tasks from the MCP server and forwards them to the agent

The Hub tab must remain open while the MCP server is in use. If the tab is closed, reconnect by restarting the MCP server.

## Two MCP integrations

SupaAgent has two separate MCP layers — they are complementary, not alternatives:

| | `@supa-agent/mcp` server | Supabase MCP (mcp.supabase.com) |
|---|---|---|
| What it does | Lets external agents control the browser | Gives the browser agent access to your Supabase project |
| Direction | External → browser | Browser agent → Supabase |
| Auth | Hub token | OAuth 2.1 + PKCE |
| Config | `~/.claude/mcp.json` or client config | Extension settings → Connect with Supabase |
