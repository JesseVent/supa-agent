# Pull Request Summary: `chore/supa-agent-refactor`

## Overview
This PR completes the rebrand from **PageAgent** to **SupaAgent**, hardens the extension and core library for production use, and introduces security guardrails against prompt injection and unauthorized MCP operations.

---

## Breaking Changes

- **Package & class rename:** All `PageAgent*` identifiers are now `SupaAgent*` (`SupaAgentCore`, `SupaAgentTool`, `SupaAgent`, npm package `supa-agent`, scoped packages `@supa-agent/*`).
- **Storage key migration:** Extension storage keys migrated from `PageAgentExtUserAuthToken` → `SupaAgentExtUserAuthToken` with backward-compatible shim.
- **Removed:** `packages/website/` deleted; docs now live in `docs/` only.
- **Tooling:** ESLint + Prettier replaced by Biome (`bun run lint` / `bun run format`).

---

## New Features

### Extension
- **Conversation memory:** Prior turns are summarized and injected as `<conversation_history>` so the agent carries context across messages. Turn count shown in header; resets on `configure()` unless `preserveMemory` is enabled.
- **Structured agent logs:** Fire-and-forget IndexedDB logging for MCP connect/fail and task start/complete/error events.
- **History panel:** New Sessions / Logs tabs with per-source color coding.
- **Context-aware header:** Shows project name / Disconnected, Stop button while running, Ready / No Model pill based on API key presence.
- **Supabase MCP guardrails:** 4 explicit rules enforced in code + system prompt (no migrations without keyword, no destructive SQL without confirmation, read-only tasks use MCP, ambiguous requests ask for clarification).

### Core Library
- **AbortSignal support:** Cooperative cancellation across the agent loop — `waitFor()`, `wait` tool, and `ask_user` tool all respect the abort signal.
- **Skill router refresh:** When navigation crosses origins, the skill router is re-invoked with the new context.
- **Migration instruction injection:** The 195-line migration hint is no longer injected on every prompt; only when the task matches migration keywords (`\bmigration\b`, etc.).

---

## Security & Hardening

| Area | Change |
|------|--------|
| **Prompt injection** | `sanitizeUntrusted()` now defuses framing tags (`<browser_state>`, `<sys>`, etc.) in page DOM, tool output, action results, `llms.txt`, skill context, conversation history, and agent observations. |
| **MCP writes** | Write/destructive MCP tools are blocked in code unless `allowMcpWrites` is enabled. Destructive ops additionally require an explicit `onAskUser` confirmation that survives prompt-injection attempts. |
| **Domain allowlist** | Content script enforces `allowedDomains` before executing DOM actions or showing the mask. |
| **URL validation** | `open_new_tab` validates URL scheme — only `http:`/`https:` allowed; blocks `javascript:`, `data:`, `file:`, etc. |
| **DCR guard** | Throws if Supabase returns empty `client_secret` (was silently stored as `''`, causing downstream 422 errors). |
| **Error sanitization** | JWT-like tokens stripped from error messages before they reach history / UI (`eyJ[A-Za-z0-9._-]{20+}` → `[token]`). |
| **LLM retry loop** | On `INVALID_TOOL_ARGS` / `NO_TOOL_CALL`, the error is appended as feedback to the working messages so the next attempt receives different input instead of an identical resend. |
| **No fabricated actions** | `autoFixer` no longer fabricates a fake `wait` action when no action is extracted; it throws `NO_TOOL_CALL` so the retry loop can handle it properly. |

---

## Bug Fixes

- **LLM retry logic:** Feedback messages now appended to working copy, preventing infinite identical retries.
- **Mask / DOM race:** Mask pointer-events bypassed during `updateTree()` DOM extraction and restored after, preventing the mask from blocking its own extraction.
- **Transient port errors:** Background script retries `chrome.tabs.sendMessage` once on `receiving end does not exist` after navigation.
- **Token refresh:** Empty token responses now throw instead of silently proceeding.
- **System prompt:** Uses real MCP tool names instead of `supabase_*` wildcard; adds `ask_user` guidance.

---

## Documentation

- Full README rewrite with SupaAgent branding, Supabase MCP feature table, and updated quick-start.
- New `docs/features/supabase-mcp.md`: OAuth DCR+PKCE flow, tool table, scopes, security notes.
- Updated `docs/features/chrome-extension.md`, `docs/features/mcp-server.md`, `docs/advanced/security-permissions.md`.
- `docs/CHANGELOG.md` updated for v1.8.2.

---

## Migration Notes for Consumers

```typescript
// Before
import { PageAgentCore, type PageAgentTool } from '@supa-agent/core'

// After
import { SupaAgentCore, type SupaAgentTool } from '@supa-agent/core'
```

Extension settings storage is auto-migrated; no user action required.

---

## Files Changed
- `packages/core/src/SupaAgentCore.ts` — core refactor + security hardening
- `packages/core/src/utils/autoFixer.ts` — no fake action fallback
- `packages/core/src/utils/index.ts` — `sanitizeUntrusted`, `uid`, `fetchLlmsTxt`
- `packages/extension/src/agent/*` — MCP guardrails, conversation memory, logging
- `packages/extension/src/entrypoints/background.ts` — OAuth DCR + token refresh
- `packages/page-controller/src/PageController.ts` — mask bypass during extraction
- `docs/` — full rebrand + new guides
- `package.json`, `biome.json`, `.gitignore` — tooling swap, artifact cleanup

---

**Reviewers:** Please pay special attention to the `sanitizeUntrusted()` coverage in `SupaAgentCore.ts` (lines ~628, ~649) and the MCP destructive-ops confirmation flow in `mcpToolAdapter.ts`.
