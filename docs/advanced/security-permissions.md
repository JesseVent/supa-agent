# Security & Permissions

> 🚧 **Beta Stage**
> Current features are incomplete and the API may change at any time. Please do not use in production environments before the official release.

SupaAgent provides multiple security mechanisms to ensure AI operations stay within controlled boundaries.

## Browser Extension Permissions

The Chrome extension follows Manifest V3 least-privilege conventions.

**Install-time permissions** (always granted): `tabs`, `tabGroups`, `sidePanel`, `storage`, `identity`

**Optional host permission** (`<all_urls>`): Requested at runtime the first time the user runs a task. The user sees a one-time Chrome prompt; subsequent sessions resolve silently. If denied, the agent continues but cannot access pages on origins it has not been granted.

## Supabase MCP Guardrails

When a Supabase project is connected, the agent's system instructions enforce four hard rules:

1. **Read-only tasks use MCP query tools** — `execute_sql`, `list_tables`, etc. The agent does not navigate the Supabase dashboard UI for data queries.
2. **No migrations without explicit instruction** — The migration playbook is only injected when the user's message contains the word "migrate", "migration", "move project", or "transfer region". Partial matches (e.g. browsing to a types page) do not trigger it.
3. **No destructive SQL without confirmation** — `DROP`, `DELETE`, `TRUNCATE`, and destructive `ALTER` statements require the user to explicitly request them in the current message.
4. **Ambiguous requests require clarification** — If the intent is unclear, the agent calls `done` and asks the user to confirm before taking any irreversible action.

## Element Interaction Allowlist/Blocklist

**Blocklist** — Prevent AI from interacting with sensitive elements like delete buttons, payment buttons, etc.

**Allowlist** — Explicitly define which elements AI can interact with.

## Instruction Safety Constraints

**High-Risk Operation Control** — Define high-risk operations in AI instructions and control them through two strategies:

**Completely Forbidden** — Explicitly prohibit execution of extremely high-risk operations.

**Requires User Confirmation** — Require explicit user consent for medium-risk operations.
