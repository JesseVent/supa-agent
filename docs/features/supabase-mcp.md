# Supabase MCP Integration

SupaAgent connects to your Supabase project via the hosted MCP server at `mcp.supabase.com`. Once authenticated, the agent can query your database, inspect logs, manage edge functions, and check project health — directly from natural language in the browser.

## How it works

Authentication uses **OAuth 2.1 with Dynamic Client Registration (DCR) + PKCE**. No pre-registered app or hardcoded credentials — the extension registers its own OAuth client at runtime and stores only the resulting access token (no passwords or service role keys).

```
Browser extension
  → OAuth DCR: registers client with Supabase
  → PKCE auth flow: user approves in Supabase dashboard
  → Token stored in chrome.storage (isolated, not accessible to pages)
  → SupabaseMcpClient connects to mcp.supabase.com with Bearer token
  → Agent gains access to MCP tools
```

Tokens are automatically refreshed in the background. If a refresh fails, the extension shows a "Tools Error" status and falls back to browser-based navigation.

## Connecting

1. Open the SupaAgent side panel
2. Go to **Settings**
3. Click **Connect with Supabase**
4. Select the project you want to connect
5. Approve the OAuth permission screen

The connection status is shown in the panel header:
- **Connected** (green) — MCP tools are active
- **Loading** (amber) — connecting or refreshing token
- **Tools Error** (red) — authentication failed; click to reconnect

## Available MCP Tools

Once connected, the agent has access to the full Supabase MCP tool set:

| Tool | What it does |
|---|---|
| `execute_sql` | Run arbitrary SQL against your database |
| `list_tables` | List all tables in a schema |
| `list_schemas` | List all schemas |
| `list_extensions` | List installed Postgres extensions |
| `list_migrations` | Show applied migrations |
| `apply_migration` | Apply a new SQL migration |
| `get_project` | Fetch project metadata |
| `get_project_url` | Get the project's API URL |
| `get_publishable_keys` | Get the anon/publishable API key |
| `get_logs` | Fetch recent project logs (postgres, edge, etc.) |
| `get_advisors` | Run security and performance advisors |
| `list_edge_functions` | List deployed edge functions |
| `get_edge_function` | Get an edge function's details |
| `deploy_edge_function` | Deploy or update an edge function |
| `list_projects` | List all projects in your account |
| `list_organizations` | List your Supabase organisations |
| `generate_typescript_types` | Generate TypeScript types from the DB schema |

## Example Prompts

With Supabase MCP connected, you can ask:

- "Show me all tables in the public schema"
- "How many users signed up in the last 7 days?"
- "Are there any RLS policies missing on my tables?"
- "Check the performance advisors and tell me what to fix"
- "What are the most recent edge function error logs?"
- "Generate TypeScript types for my database"
- "List all secrets in my project"

## Security

- The agent only receives an OAuth access token with the scopes you approved
- The token is stored in `chrome.storage.local`, which is sandboxed to the extension — web pages cannot access it
- Raw error messages (including JWT fragments) are sanitised before being shown in the UI or injected into the LLM context
- To revoke access at any time, click **Disconnect** in the Settings panel or revoke the OAuth app in your Supabase account settings

## OAuth Scopes

The extension requests the following scopes:

```
projects:read  projects:write  organizations:read
database:read  database:write  analytics:read
secrets:read   edge_functions:read  edge_functions:write
environment:read  environment:write  storage:read
```
