# supa_agent_trace

Realtime agent trace bridge for [SupaAgent](https://github.com/JesseVent/supa-agent). Install this on the Supabase project that hosts the live trace channel (the project your DevTool is connected to).

## What it installs

| Object | Purpose |
| --- | --- |
| `public.agent_trace_events` | Persisted trace events (RLS: owner-only), used for backfill/replay |
| `public.agent_trace_topic(uuid)` | Derives the private Realtime topic `agent-trace:{sha256hex(user_id)}` |
| `agent_trace_broadcast_trigger` | Broadcasts every inserted event to the owner's private topic via `realtime.send()` |
| Policies on `realtime.messages` | Private-channel authorization: owners may join/read/write only their own topic |
| `public.agent_trace_prune(interval)` | Retention helper — schedule with pg_cron |

Single write path: publishers `INSERT` into `agent_trace_events`; the trigger broadcasts. This guarantees everything broadcast is also persisted, gives DB-side ordering, and `realtime.send()` writes through `realtime.messages` so [Broadcast Replay](https://supabase.com/docs/guides/realtime/broadcast) (`since`) works for reconnect gap-fill.

## Install

### Via database.dev (once published)

```sql
select dbdev.install('jessevent@supa_agent_trace');
create extension "jessevent@supa_agent_trace";
```

### Direct SQL

Run `supa_agent_trace--0.1.0.sql` against the project (psql, MCP `execute_sql`, or SQL editor). The script is idempotent.

## Companion edge function (required for auth)

Both the extension and the DevTool authenticate with the Supabase **Management API** (account-level OAuth) — neither holds a project GoTrue session. The `agent-trace-token` edge function (in `supabase/functions/agent-trace-token/`) validates that the caller's Management token can access *this* project (`GET /v1/projects/{ref}`) and exchanges it for a short-lived project JWT whose `sub` is a deterministic project-scoped UUID (UUIDv5 of the project ref), so `auth.uid()` matches on both sides.

> Pairing is per **project**, not per platform user: anyone with Management API access to the project (e.g. org members who authorized the app) shares the same trace channel. The per-user design (`gotrue_id` from `/v1/profile`) is currently impossible because that endpoint rejects OAuth tokens (`"GET /v1/profile does not support oauth access yet"`).

```bash
supabase functions deploy agent-trace-token --no-verify-jwt
supabase secrets set AGENT_TRACE_JWT_SECRET="<project legacy JWT secret>"
```

The secret is the project's **legacy JWT secret** (Dashboard → Project Settings → API → JWT Settings).

> ⚠️ Projects that migrated to asymmetric JWT signing keys *and revoked the legacy secret* cannot verify HS256 tokens — the bridge then falls back to public-channel mode (unguessable hashed topic, no persistence).

## Retention

Events are kept until pruned. To prune daily at 03:00:

```sql
select cron.schedule('prune-agent-traces', '0 3 * * *', $$select public.agent_trace_prune()$$);
```

## Publishing to database.dev

```bash
cd supabase/extensions/supa_agent_trace
dbdev login
dbdev publish
```

`supa_agent_trace.control`, the versioned SQL file, and this README make up the package.
