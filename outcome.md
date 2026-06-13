# Realtime Trace Bridge — Outcome

Implementation of [supa-agent#2](https://github.com/JesseVent/supa-agent/issues/2) (publisher) and [supabasehire.me#3](https://github.com/JesseVent/supabasehire.me/issues/3) (subscriber). Both sides are implemented, verified against the live project, and committed on `feat/realtime-trace-bridge` branches in both repos:

- **supa-agent**: `4544d54` (publisher + shared package + DB assets), `3bd35a1` (public-channel fallback)
- **supabase-devtool**: `960edb7` (subscriber + UI)

Progress comments with full checklists posted on [supa-agent#2](https://github.com/JesseVent/supa-agent/issues/2#issuecomment-4689702998) and [supabasehire.me#3](https://github.com/JesseVent/supabasehire.me/issues/3#issuecomment-4689704446).

## What was built

### `@supa-agent/bridge-events` (new workspace package)

The shared event contract: the four bridge actions, payload types, `TraceEventEnvelope`, and `getChannelName()` topic derivation. Core now re-exports its trace types from this package, and a unit test pins the topic hash to the SQL helper's output (verified byte-identical against the live database).

### DB assets — one TLE-ready SQL file

`supabase/extensions/supa_agent_trace/` (versioned SQL + `.control` + README, ready for your database.dev publish):

- `agent_trace_events` table with owner-only RLS (`auth.uid() = user_id`)
- AFTER INSERT trigger that broadcasts each row via `realtime.send()` to the private topic `agent-trace:{sha256hex(user_id)}`
- Channel-authorization policies on `realtime.messages` (owners may join/read/write only their own topic)
- `agent_trace_prune(interval)` retention helper, schedulable with pg_cron

Design choice: **single-write + trigger** instead of dual-write — everything broadcast is guaranteed persisted, ordering is DB-side (`seq`), and replay stays consistent.

### `agent-trace-token` edge function

Deployed to Prom Labs (v1, `verify_jwt` off). Validates the Management OAuth token against `api.supabase.com/v1/profile` and mints a 1-hour HS256 project JWT with `sub` = the platform `gotrue_id` — so the extension and the DevTool (separate DCR client ids) derive the same `auth.uid()` and the same channel topic.

### Extension publisher

`RealtimeTracePublisher` wired into `useAgent` behind a new `traceTransport` setting (`postMessage | realtime | both`, default `postMessage`):

- runId minted per task; sequenced inserts with retry and 32KB payload capping
- Presence tracking (`{ runId, status, startedAt }`) for the "agent online" indicator
- The side-panel path now emits `execute_result` (previously only the page-API path did)
- The OAuth connect dialog persists the project URL + publishable key for the publisher
- Fallback when not signed in: public channel keyed on the hashed `SupaAgentExtUserAuthToken`, direct `channel.send()` — live only, no persistence
- Publishing never throws into the agent loop; failures surface via state/`lastError` and console warnings

### DevTool subscriber

- `AgentTraceBridge` refactored to a transport-agnostic `ingest(action, payload)`; the postMessage listener is now just the tab-local adapter
- New `RealtimeTraceSource` singleton + `useRealtimeTrace` hook: auto-pairs from the active connection, backfills the latest run from `agent_trace_events`, dedupes by `(runId, seq)`, syncs presence
- Header badges: `extension` / `realtime` / `disconnected`, plus `agent online` from Presence
- Pasted-token fallback input in the agent config panel (persisted in `agent-store`)
- `src/lib/bridge-events.ts` is a header-commented mirror of `@supa-agent/bridge-events` so Vercel builds stay self-contained until the npm package is published
- Demo mode untouched

## Verification (all green)

| Check | Result |
| --- | --- |
| Topic hash: JS `getChannelName` vs SQL `agent_trace_topic` | Byte-identical (`906d2f42…`) |
| Insert → private broadcast row with correct envelope | Pass (live on Prom Labs) |
| Public-channel fallback round-trip (publish → receive) | Pass (live) |
| Anon client joining the private topic | Correctly rejected (`Unauthorized`) |
| Security advisors after SQL changes | Clean (execute-revokes added on trigger fn) |
| supa-agent tests / typecheck / lint | 64 pass, 0 fail / clean / clean |
| Extension build (WXT) + libs build | Pass |
| DevTool `next build` + lint on new files | Pass (repo-wide lint failures pre-date this change) |

## Remaining steps (yours)

1. **Set the JWT secret** on the host project:
   `supabase secrets set AGENT_TRACE_JWT_SECRET="<legacy JWT secret>"` — without it the private path returns a clear `not_configured` error. ⚠️ Prom Labs has its legacy *anon key* disabled; confirm the legacy *JWT secret* is still active in JWT settings. If it was revoked for asymmetric signing keys, minted HS256 tokens won't verify and only the public fallback will work.
2. **Publish `@supa-agent/bridge-events` to npm**, then replace the DevTool's `src/lib/bridge-events.ts` mirror with the package.
3. **Publish the TLE** from `supabase/extensions/supa_agent_trace/` to database.dev (`dbdev publish`), per your packaging plan.
4. **Interactive browser E2E** once the secret is set: sign in via OAuth, set transport to `both`, run a task, and watch the trace stream in a different tab.

## Known quirk

`realtime.messages` daily partitions only exist while the Realtime engine is active; `realtime.send()` silently no-ops (Postgres WARNING) when today's partition is missing. Any connected Realtime client keeps partitions current, so this only matters on long-idle projects — worth knowing if a trace ever "disappears".
