# Supa-Agent Full Audit & Recovery Plan

**Date:** 2026-06-09
**Scope:** Prompts, architecture, build pipeline, auth flow, UI components, and branding.
**Goal:** Identify all gaps, regressions, and lost code before public release. Each section is a delegable review/repair task.

---

## Part A: Prompts & Agent Instructions

---

### Review Task 1: Core System Prompt (`packages/core/src/prompts/system_prompt.md`)

**Status:** Inherited from `alibaba/page-agent` — **UNCHANGED** by rebrand.
**Size:** ~154 lines

**Review Checklist:**
- [ ] Verify language settings reference only `en-US` (zh-CN support was stripped from extension-side `detectLanguage()`)
- [ ] Confirm `<output>` JSON schema matches what the LLM provider actually expects (OpenRouter + `google/gemini-2.5-flash`)
- [ ] Check if any examples reference Alibaba-specific sites or Chinese services that could confuse the model
- [ ] Validate that `max_steps` handling in the prompt matches the actual `PageAgentCore.ts` implementation
- [ ] **Risk:** This is the original Alibaba prompt. If we haven't updated the model reference from `qwen3.5-plus` → `google/gemini-2.5-flash`, the prompt may assume wrong token limits or reasoning style.

**Verdict:** 🟢 Low risk — stable upstream prompt. Minor localization/branding updates needed.

---

### Review Task 2: Extension System Prompt (`packages/extension/src/agent/system_prompt.md`)

**Status:** **MODIFIED** during Supabase integration.
**Size:** ~154 lines

**Key addition (lines 107–112):**
```markdown
<tool_priority_rules>
When you have custom tools available (such as supabase_* tools), you MUST use them instead of browser navigation...
</tool_priority_rules>
```

**Review Checklist:**
- [ ] Does "custom tools" language generalize to other MCP servers beyond Supabase?
- [ ] Verify the 3-strike retry rule — is this too permissive?
- [ ] **Critical gap:** There is NO mention of the `ask_user` tool in the system prompt. If MCP tools are unavailable, the agent may never ask for clarification.
- [ ] **Critical gap:** No instruction about when to use `supabase_*` tools vs. `execute_sql` directly. The MCP exposes both — the agent may double-query.
- [ ] Are the tool names `supabase_*` accurate? Verify with actual `listTools()` output.

**Verdict:** 🟡 Medium risk — functional but underspecified. Needs multi-MCP and tool-name fixes.

---

### Review Task 3: Migration Instruction Prompt (`packages/extension/src/agent/migrationInstruction.ts`)

**Status:** **NEW** — added by us. Largest prompt artifact (~195 lines).

**What it covers:** 12-phase Supabase region migration guide (Discovery → Create target → Transfer encryption key → Copy secrets → DB migration commands → Extensions → Realtime → Webhooks → Edge Functions → Storage objects → Verification → Cutover).

**Review Checklist:**
- [ ] **Accuracy:** Phase 3 references `vault.secrets` — confirm this table exists in all Supabase projects using Vault.
- [ ] **Accuracy:** Phase 5 references `get_migration_commands` — is this an actual MCP tool? Verify against current Supabase MCP server.
- [ ] **Accuracy:** Phase 6–8 tell the agent to navigate to the Supabase dashboard — does the agent have working browser auth for dashboard pages?
- [ ] **Safety:** Phase 12 says "you can pause or delete the old project" — should we soften this?
- [ ] **Token budget:** At ~195 lines, injected on EVERY task when `supabaseMcpProjectRef` is set. Massive waste on non-migration tasks.
- [ ] **Conditionality:** Currently injected unconditionally via `useAgent.ts` line 133. Should be gated by task keywords.
- [ ] **Missing phases:** PostgREST config, Auth config (site_url, SMTP, external providers), Storage bucket policies/RLS, Cron jobs (pg_cron).

**Verdict:** 🔴 High risk — comprehensive but heavy, unconditionally injected, and potentially out of sync with MCP tools.

---

### Review Task 4: Dynamic `supabaseHint` Construction (`useAgent.ts`)

**Status:** **NEW** — added during MCP integration.
**File:** `packages/extension/src/agent/useAgent.ts` (lines 118–145)

**Variant A — MCP Connected:**
```typescript
supabaseHint = [
  `You have supabase_* tools available for the project "${supabaseMcpProjectRef}"...`,
  SUPABASE_MIGRATION_INSTRUCTION,  // <-- ALWAYS appended
].join('\n\n')
```

**Variant B — MCP Failed:**
```typescript
supabaseHint = `A Supabase project ("${supabaseMcpProjectRef}") is configured but the MCP tools failed to load (${mcpErr}). You do NOT have supabase_* tools right now...`
```

**Review Checklist:**
- [ ] **Token waste:** Variant A always appends the full 195-line migration instruction.
- [ ] **Tool name accuracy:** Uses `supabase_*` wildcard. Actual MCP tool names may differ.
- [ ] **Error leakage:** Variant B includes raw `${mcpErr}` — may leak JWTs or stack traces into LLM context.
- [ ] **Missing:** Project `name` (stored in `supabaseMcpProjectName`) is unused in the hint.
- [ ] **Missing:** No guidance on which Supabase scopes are available.

**Verdict:** 🔴 High risk — wasteful, imprecise, and leaks errors.

---

### Review Task 5: System Prompt Assembly Logic (`PageAgentCore.ts`)

**Status:** Inherited — modified by rebrand.
**File:** `packages/core/src/PageAgentCore.ts` (lines 460–510, 587–610)

**Assembly order:**
1. `systemInstructions` (system_prompt.md + supabaseHint + migrationInstruction)
2. `pageInstructions` (per-page DOM instructions)
3. `llmsTxt` (fetched from `/llms.txt` if `experimentalLlmsTxt` enabled)
4. `skillContext` (from SkillRouter if configured)
5. `agent_state` (user_request + step_info + browser_state)
6. `agent_history`

**Review Checklist:**
- [ ] **Ordering:** `<system_instructions>` XML block position — is this optimal for OpenRouter/Gemini token weighting?
- [ ] **Duplication:** Risk of duplicate `<tool_priority_rules>` if skill router also injects tool guidance.
- [ ] **Language injection:** `{{LANGUAGE}}` replacement still works after `detectLanguage()` hardcoded to `'en-US'`.
- [ ] **Missing:** No token-counting or truncation logic before sending to LLM.

**Verdict:** 🟢 Low risk — stable architecture. Minor overflow risk.

---

### Review Task 6: Skill Router Prompt Injection (`packages/skill-router`)

**Status:** **NEW** — added by us.

**Review Checklist:**
- [ ] Confirm wiring in `useAgent.ts` (lines 95–98).
- [ ] Does skill router have a Supabase-specific skill? If yes, does it duplicate `system_prompt.md` or `migrationInstruction.ts` content?
- [ ] Are skill chunks bounded in size? Unbounded context could blow the token budget.
- [ ] **Missing from audit:** Server-side skill content is not in the repo. Cannot review without access.

**Verdict:** 🟡 Medium risk — client-side wiring correct, server-side content unaudited.

---

### Review Task 7: LLM Error/Retry Prompts (`packages/llms`)

**Status:** **MODIFIED** during rebrand.
**Files:** `packages/llms/src/index.ts`, `packages/llms/src/OpenAIClient.ts`

**What changed:**
- `withRetry`: `lastError` removed from `onRetry` callback; separate `onError` handler added.
- `OpenAIClient`: `INVALID_SCHEMA` error mapping → `UNKNOWN`; `AbortError` re-throw logic altered.

**Review Checklist:**
- [ ] Do error messages returned to the agent (in `agent_history`) provide enough context for self-correction?
- [ ] When `finish_reason` is `length` (context window exceeded), does the agent get a clear signal?
- [ ] **Gap:** No prompt-level instruction telling the agent what to do on `InvokeError` or retryable errors. The agent may loop.

**Verdict:** 🟡 Medium risk — code-level changes need prompt-level guidance.

---

## Part B: Core Architecture Regressions

---

### Review Task 8: AbortSignal / Cooperative Cancellation (`packages/core`)

**Status:** 🔴 **REGRESSED** — signal support stripped during rebrand or integration.

**Original (`alibaba/page-agent`):**
- `ToolContext` interface with `signal: AbortSignal`
- `waitFor(seconds, signal)` — cancellable wait
- `onAskUser(question, { signal })` — cancellable user prompt

**Current (`supa-agent`):**
- ❌ `ToolContext` interface **deleted** entirely
- ❌ `waitFor()` has **no signal parameter**
- ❌ `onAskUser` signature is `(question: string)` **only** — no signal option

**Impact:** When the user clicks "stop" during a task, `agent.stop()` calls `abortController.abort()`, but:
- In-flight `wait` tool calls cannot be interrupted.
- `ask_user` prompts may hang indefinitely because the agent cannot abort the wait.
- Background network requests (e.g., MCP tool calls) continue even after abort.

**Review Checklist:**
- [ ] Restore `ToolContext` interface with `signal` field in `packages/core/src/tools/index.ts`
- [ ] Restore signal-aware `waitFor()` in `packages/core/src/utils/index.ts`
- [ ] Restore `{ signal }` parameter in `onAskUser` signature in `packages/core/src/PageAgentCore.ts`
- [ ] Update `Panel.ts` (`packages/ui/src/panel/Panel.ts`) to reject `#askUser` promise on abort signal
- [ ] Update `OpenAIClient.ts` to re-throw `AbortError` before wrapping in `InvokeError`
- [ ] Add test: start a task with a `wait` tool call, call `stop()`, verify the task terminates within N seconds.

**Verdict:** 🔴 **CRITICAL** — `stop()` is unreliable. Tools and prompts may hang after abort.

---

### Review Task 9: Language Support (`zh-CN` Removal)

**Status:** **INTENTIONALLY REMOVED** during rebrand.

**Current state:**
- `detectLanguage()` in `MultiPageAgent.ts` **hardcoded** to return `'en-US'`
- `zh-CN` locale file deleted from `packages/ui/src/i18n/locales.ts`
- `SupportedLanguage` type may still include `zh-CN` in core types, but extension never uses it

**Review Checklist:**
- [ ] Confirm `SupportedLanguage` type definition in `packages/core/src/types.ts`
- [ ] Decide: is the target market English-only? If yes, remove `zh-CN` from the type entirely for clarity.
- [ ] If global market is intended: restore `zh-CN` locale and dynamic `detectLanguage()`

**Verdict:** 🟡 Medium risk — intentional but may limit adoption. Decision needed.

---

### Review Task 10: Branding Consistency

**Status:** **INCONSISTENT** across codebase.

**What we found:**
- `[PageAgent]` chalk prefix still appears in error messages in some packages
- `McpServer` constructor still named `'page-agent'` in `packages/mcp/src/index.ts`
- `[SupaAgent]` only appears in `TabsController` group title
- `PageAgentExtUserAuthToken` storage key unchanged
- `window.pageAgent` global in demo.ts intentionally preserved for API compatibility

**Review Checklist:**
- [ ] Standardize all chalk prefixes to `[SupaAgent]`
- [ ] Update `McpServer({ name: 'page-agent' })` → `'supa-agent'`
- [ ] Rename `PageAgentExtUserAuthToken` → `SupaAgentExtUserAuthToken` (or keep for backward compatibility?)
- [ ] Verify `window.pageAgent` global is documented as legacy alias

**Verdict:** 🟢 Low risk — cosmetic. Should standardize before public release.

---

## Part C: Extension Build & Output

---

### Review Task 11: Extension Build Pipeline (`packages/extension`)

**Status:** 🔴 **BROKEN / STALE** — build output does not match source.

**Evidence from session logs:**
- User installed Chrome MV3 build and saw **purple buttons** instead of Supabase-branded UI
- User saw **missing OAuth button** in the installed extension despite it being present in `ConfigPanel.tsx` source
- `pnpm build:ext` produces output but it may be cached, from wrong branch, or bundling wrong files
- WXT build target confusion: multiple `output/` directories, wrong manifest

**Review Checklist:**
- [ ] Verify `wxt.config.ts` build target is `chrome-mv3` (not `chrome-mv2` or `firefox`)
- [ ] Check if `.wxt/` cache or `output/` directory contains stale files from pre-rebrand builds
- [ ] Confirm `pnpm build:ext` runs from `packages/extension/` (not root)
- [ ] Verify the `dist/` or `output/chrome-mv3/` contents match the current source (check timestamps)
- [ ] Inspect built `manifest.json` for correct name, permissions, and OAuth redirect URI
- [ ] Check if `background.ts` is included in the WXT bundle (it handles `MGMT_CONNECT_START`)
- [ ] Add CI step: `pnpm build:ext` then diff `manifest.json` against expected schema

**Verdict:** 🔴 **CRITICAL** — the build is the primary delivery mechanism. If it doesn't reflect source, users get broken output.

---

### Review Task 12: Extension Output Directory Confusion

**Status:** 🟡 **CONFUSING** — multiple output dirs, unclear which is "correct."

**Evidence:**
- User pasted image: "which is the right folder? why are there so many?"
- `output/chrome-mv3/`, `dist/`, `.wxt/`, `packages/extension/output/` all exist

**Review Checklist:**
- [ ] Document the canonical build output path in README/CLAUDE.md
- [ ] Clean up or `.gitignore` non-canonical output directories
- [ ] Verify `wxt.config.ts` `outDir` setting
- [ ] Ensure `.gitignore` excludes all build artifacts (including `.wxt/`, `dist/`, `output/`)

**Verdict:** 🟡 Medium risk — developer friction, not user-facing.

---

## Part D: OAuth & Authentication Flow

---

### Review Task 13: OAuth Connector Button (Lost in `git filter-repo`)

**Status:** 🔴 **MISSING FROM BUILD** — source exists but not reflected in extension output.

**What we know:**
- `ConfigPanel.tsx` (line 579) has `'Connect with Supabase'` button
- `useAuth.ts` has `MGMT_CONNECT_START` message
- `background.ts` (line 42) handles `MGMT_CONNECT_START`
- **But:** User installed extension and saw **no OAuth button** — only purple non-Supabase branded buttons

**Review Checklist:**
- [ ] Verify the built `output/chrome-mv3/` contains the latest `ConfigPanel.tsx` and `useAuth.ts`
- [ ] Check if the `SupabaseConnectDialog` component is tree-shaken or excluded from build
- [ ] Inspect built `background.js` for `MGMT_CONNECT_START` handler presence
- [ ] Confirm OAuth redirect URI (`akldabonmimlicnjlflnapfeklbfemhj.chromiumapp.org/`) is registered in the Supabase OAuth app
- [ ] Test end-to-end: click "Connect with Supabase" → DCR → PKCE → token storage → `SupaAgentMgmtToken` in `chrome.storage.local`

**Verdict:** 🔴 **CRITICAL** — the primary Supabase integration feature is invisible to users.

---

### Review Task 14: DCR + PKCE Token Exchange (422 `client_secret`)

**Status:** 🔴 **BROKEN** — token exchange returns `422 Unprocessable Content`.

**Errors observed:**
```
Token exchange failed (422): {"message":"Required parameter: client_secret"}
```
```
Access to fetch at 'https://api.supabase.com/v1/oauth/token' from origin 'http://localhost:3000' has been blocked by CORS policy
```
```
Dynamic client registration failed (400): {"message":"scope.12: Invalid enum value..."}
```

**Review Checklist:**
- [ ] **DCR flow:** The `client_secret` error suggests we are using the wrong OAuth grant type. Supabase DCR uses **Authorization Code + PKCE**, which does NOT require `client_secret`. Verify the token exchange request is NOT sending `client_secret`.
- [ ] **CORS:** The `api.supabase.com/v1/oauth/token` endpoint may not support CORS from `localhost:3000`. The exchange should happen in the **background script** (service worker), not the content script or dev server page.
- [ ] **Scopes:** The `Invalid enum value` error indicates a scope in the DCR request is not recognized. Compare our scope list against Supabase's accepted scopes:
  - `organizations:read`, `projects:read`, `projects:write`, `database:read`, `database:write`, `auth:read`, `storage:read`, `storage:write`, `edge_functions:read`, `edge_functions:write`, `realtime:read`, `secrets:read`, `secrets:write`
- [ ] **Token refresh:** Verify `SupabaseMcpClient.ts` auto-refresh logic works when the stored token expires.
- [ ] **Missing scope:** User noted "i think we wanted the storage scope also" — confirm the full required scope set.

**Verdict:** 🔴 **CRITICAL** — auth is the gateway to all MCP tools. Without it, the extension is just a browser agent.

---

### Review Task 15: Supabase MCP Client (`SupabaseMcpClient.ts`)

**Status:** 🟡 **Partially functional** — connects but fails on auth.

**What works:**
- `StreamableHTTPClientTransport` connects to `https://mcp.supabase.com/mcp`
- Reads `SupaAgentMgmtToken` from `chrome.storage.local`
- Auto-refresh on 401 via `MGMT_REFRESH_TOKEN` background message

**What breaks:**
- `JWT failed verification` errors when token is expired or scopes insufficient
- `404 Not Found` on `mcp.supabase.com/mcp` (may be missing `project_ref` query param)
- No validation that the stored token has the required scopes for the requested operation

**Review Checklist:**
- [ ] Verify `projectRef` is correctly passed as query param or in request body
- [ ] Add scope validation: before calling a tool, check if the token's scopes include the required permission
- [ ] Improve error messages: distinguish between "token expired" (refreshable) vs "token invalid" (re-auth needed) vs "insufficient scopes" (re-consent needed)
- [ ] Add debug logging option in ConfigPanel to show MCP request/response traces

**Verdict:** 🟡 Medium risk — architecture is sound but auth layer is brittle.

---

## Part E: Lost UI Components (`git filter-repo` Disaster)

---

### Review Task 16: System Instructions Display in UI

**Status:** 🔴 **LOST** — existed before rebrand, now missing.

**Evidence:**
- User: "before it had it in system instructions in the ui. is that mean to be missing?"
- The agent assembles `systemInstructions` internally, but there is no UI panel showing the user what instructions the agent is operating under.

**What was likely lost:**
- A collapsible panel in the side panel or chat interface showing the current system prompt
- Possibly included the `SUPABASE_MIGRATION_INSTRUCTION` when active
- Helped users understand why the agent was behaving a certain way

**Review Checklist:**
- [ ] Search git history (pre-filter-repo) for any component that rendered `systemInstructions` or `system_prompt.md` content
- [ ] Check if `PageAgentCore` exposes `getInstructions()` or similar for UI consumption
- [ ] Rebuild: add a "System Instructions" collapsible section in the side panel UI
- [ ] Gate it behind an "Advanced" toggle so casual users aren't overwhelmed

**Verdict:** 🔴 High risk — user-facing feature missing. Affects transparency and debugging.

---

### Review Task 17: Concise Reasoning UI Toggle

**Status:** 🔴 **LOST / BROKEN** — full reasoning displayed instead of concise.

**Evidence:**
- User: "also i notied the fulll reasoning was displayed? we made that moree streamlined"
- User: "the reasoning i only want if the user needs it otherwise concise"

**What was likely lost:**
- A UI toggle or config option to switch between "full reasoning" (evaluation + memory + next_goal visible) and "concise" (only actions shown)
- Possibly a `verbosity` or `showReasoning` field in `AdvancedConfig`

**Review Checklist:**
- [ ] Search git history for `verbosity`, `showReasoning`, `concise`, `streamlined` in the extension source
- [ ] Check `AdvancedConfig` interface in `useAgent.ts` for any removed fields
- [ ] Check the side panel/chat UI components for reasoning display logic
- [ ] Rebuild: add `showReasoning: boolean` to `AdvancedConfig`, default `false`, wire into the UI rendering layer

**Verdict:** 🔴 High risk — user experience regression. The agent looks noisy and unprofessional.

---

### Review Task 18: "Connect to Supabase" Button Styling

**Status:** 🔴 **LOST** — was a "nice green button above everything", now missing or wrong color.

**Evidence:**
- User pasted image: "this is what im missing — when we had the Connect to Supabase button"
- User: "before it was a nice green button above everything"
- Current build shows purple buttons (non-Supabase branded)

**What was likely lost:**
- A styled Supabase-branded button (green, matching Supabase design system)
- Possibly a standalone button in the main UI (not buried in ConfigPanel)
- The button may have been in a different component that was deleted during rebrand or filter-repo

**Review Checklist:**
- [ ] Search git history for "Connect to Supabase" button implementation outside `ConfigPanel.tsx`
- [ ] Check if there was a top-level banner or toolbar component for auth status
- [ ] Rebuild: add a prominent, Supabase-branded connection button to the main side panel header
- [ ] Match Supabase design system colors (green primary, not purple)

**Verdict:** 🔴 High risk — primary CTA is invisible or wrong-branded.

---

## Part F: Integration & Data Flow

---

### Review Task 19: `useAgent.ts` Wiring Completeness

**Status:** 🟡 **Partially broken** — some config fields are collected but unused.

**Fields collected in `AdvancedConfig` but potentially unused:**
- `supabaseMcpProjectName` — stored but never interpolated into the system prompt or UI
- `secretKey` (from manual connect dialog) — labeled "Local only" but not persisted into `ExtConfig` or used in agent layer
- `skillRouterUrl`, `skillRouterKey`, `skillRouterSkill` — wired, but is the skill router server actually running?

**Review Checklist:**
- [ ] Add `supabaseMcpProjectName` to the `supabaseHint` so the agent knows the human-readable project name
- [ ] Wire `secretKey` into `ExtConfig` if needed for any MCP tool calls (or remove the field if not needed)
- [ ] Verify Skill Router server URL is reachable and returning valid skill chunks
- [ ] Add debug logging for each config field: "loaded X from storage", "using Y for Z"

**Verdict:** 🟡 Medium risk — config bloat and unused fields create confusion.

---

### Review Task 20: `prefillFromEnv` No-Op

**Status:** 🟡 **BROKEN** — button exists, function is empty.

**Location:** `useSupabaseConnect.ts` (line 119), `ConfigPanel.tsx` button

**Current implementation:**
```typescript
const prefillFromEnv = useCallback(() => {
  setError('Prefill from .env is not yet implemented.')
}, [])
```

**Review Checklist:**
- [ ] Implement: read `.env` or `.env.local` from the project directory
- [ ] Parse `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Pre-fill manual connect dialog fields
- [ ] Or remove the button if not planned for v1

**Verdict:** 🟢 Low risk — minor UX issue.

---

## Summary: All Review Tasks by Risk

### 🔴 Critical (Must Fix Before Release)

| # | Task | Domain | Action |
|---|------|--------|--------|
| 8 | AbortSignal / Cooperative Cancellation | Core | Restore `ToolContext.signal`, signal-aware `waitFor`, `onAskUser(signal)` |
| 11 | Extension Build Pipeline | Build | Verify WXT outputs latest source; clear caches; fix manifest |
| 13 | OAuth Connector Button | Auth/UI | Confirm build includes `ConfigPanel` + `SupabaseConnectDialog`; test end-to-end |
| 14 | DCR + PKCE Token Exchange | Auth | Fix 422 `client_secret` error; move exchange to background script; validate scopes |
| 3 | Migration Instruction Prompt | Prompt | **Gate by keyword** (not unconditional); verify MCP tool names; add missing phases |
| 4 | `supabaseHint` Construction | Prompt | Remove unconditional migration append; use actual tool names; sanitize errors |

### 🟡 Medium (Should Fix Before Release)

| # | Task | Domain | Action |
|---|------|--------|--------|
| 2 | Extension System Prompt | Prompt | Add `ask_user` guidance; generalize for multi-MCP; verify tool names |
| 7 | LLM Error/Retry Prompts | Prompt/LLM | Add agent guidance for error recovery; fix `INVALID_SCHEMA` → `UNKNOWN` mapping |
| 9 | Language Support (`zh-CN`) | Core/i18n | Decide on Chinese market; restore or remove from types |
| 15 | Supabase MCP Client | Auth | Add scope validation; improve error messages; add debug logging |
| 16 | System Instructions Display | UI | Rebuild collapsible system prompt viewer in side panel |
| 17 | Concise Reasoning Toggle | UI | Restore `showReasoning` config and UI toggle |
| 18 | Connect Button Styling | UI | Rebuild prominent Supabase-branded connection button |
| 12 | Output Directory Confusion | Build | Document canonical path; clean up non-canonical dirs |
| 19 | `useAgent.ts` Wiring | Config | Use `projectName` in hints; fix or remove `secretKey`; verify skill router |
| 6 | Skill Router Injection | Prompt | Audit server-side skills for duplication and size bounds |

### 🟢 Low (Nice to Have)

| # | Task | Domain | Action |
|---|------|--------|--------|
| 1 | Core System Prompt | Prompt | Minor model reference updates |
| 5 | Prompt Assembly Logic | Core | Add token-count safety check |
| 10 | Branding Consistency | Core/Extension | Standardize `[SupaAgent]`, server name, storage keys |
| 20 | `prefillFromEnv` No-Op | UI | Implement or remove the button |

---

## Immediate Action Plan (Suggested Order)

### Week 1: Critical Path
1. **Fix the build** (Task 11) — verify `pnpm build:ext` produces correct, current output
2. **Fix OAuth** (Tasks 13–14) — background-script DCR+PKCE flow, scope validation, CORS handling
3. **Fix AbortSignal** (Task 8) — restore cooperative cancellation across core tools

### Week 2: Prompt & UX
4. **Gate migration instruction** (Tasks 3–4) — inject only on migration keywords; use actual tool names
5. **Restore lost UI** (Tasks 16–18) — system instructions display, concise reasoning toggle, green connect button

### Week 3: Polish
6. **Standardize branding** (Task 10) + fix error classification (Task 7)
7. **Clean up config** (Tasks 19–20)

---

*End of full audit. Each numbered Review Task can be assigned to an independent reviewer, agent, or sub-team.*
