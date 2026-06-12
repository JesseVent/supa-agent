-- supa_agent_trace 0.1.0
--
-- Realtime agent trace bridge for SupaAgent.
--
-- Installs on the Supabase project that hosts the Realtime channel
-- ("the DevTool's connected project"). Provides:
--   * public.agent_trace_events       — persisted trace events (backfill/replay)
--   * public.agent_trace_topic(uuid)  — derives the private Realtime topic
--   * broadcast trigger               — every insert is broadcast via realtime.send()
--   * realtime.messages policies      — private-channel authorization (broadcast + presence)
--   * public.agent_trace_prune()      — retention helper (schedule with pg_cron if desired)
--
-- TLE-compatible: idempotent, schema-qualified, no transaction control.
-- Requires pgcrypto (preinstalled on Supabase in the `extensions` schema).
--
-- Pairing model: the extension (publisher) and the DevTool (subscriber) sign in
-- to the same Supabase platform account. A token-exchange edge function
-- (`agent-trace-token`) mints project JWTs whose `sub` is the shared platform
-- user id (gotrue_id), so auth.uid() is identical on both sides and the topic
-- `agent-trace:{sha256(user_id)}` matches. The topic hash must stay
-- byte-identical to `getChannelName()` in @supa-agent/bridge-events.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.agent_trace_events (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid(),
    run_id uuid not null,
    seq integer not null,
    action text not null check (
        action in (
            'status_change_event',
            'activity_event',
            'history_change_event',
            'execute_result'
        )
    ),
    payload jsonb,
    created_at timestamptz not null default now(),
    unique (run_id, seq)
);

comment on table public.agent_trace_events is
    'SupaAgent live trace events. Inserts are broadcast to the owner''s private Realtime topic by trigger.';

create index if not exists agent_trace_events_user_created_idx
    on public.agent_trace_events (user_id, created_at desc);

alter table public.agent_trace_events enable row level security;

grant select, insert on public.agent_trace_events to authenticated;

drop policy if exists "agent_trace_events_owner_select" on public.agent_trace_events;
create policy "agent_trace_events_owner_select"
    on public.agent_trace_events
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "agent_trace_events_owner_insert" on public.agent_trace_events;
create policy "agent_trace_events_owner_insert"
    on public.agent_trace_events
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Topic derivation
-- ---------------------------------------------------------------------------

-- Must stay byte-identical to getChannelName() in @supa-agent/bridge-events:
--   'agent-trace:' + sha256hex(lower(user_id))
create or replace function public.agent_trace_topic(uid uuid)
returns text
language sql
immutable
set search_path = ''
as $$
    select 'agent-trace:' || encode(extensions.digest(lower(uid::text), 'sha256'), 'hex')
$$;

comment on function public.agent_trace_topic(uuid) is
    'Private Realtime topic for a user''s agent trace: agent-trace:{sha256hex(user_id)}.';

-- ---------------------------------------------------------------------------
-- Broadcast trigger: every persisted event is sent to the private topic
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER is required because realtime.send() writes to
-- realtime.messages, which client roles cannot insert into directly.
-- Safe surface: trigger functions cannot be invoked through the Data API,
-- and the row content is already constrained by the table's RLS policies.
create or replace function public.agent_trace_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object(
            'runId', new.run_id,
            'seq', new.seq,
            'ts', (extract(epoch from new.created_at) * 1000)::bigint,
            'action', new.action,
            'payload', new.payload
        ),
        new.action,
        public.agent_trace_topic(new.user_id),
        true -- private channel
    );
    return new;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on new functions; this one must only ever
-- run as a trigger, so close the /rest/v1/rpc surface explicitly.
revoke execute on function public.agent_trace_broadcast() from public, anon, authenticated;

drop trigger if exists agent_trace_broadcast_trigger on public.agent_trace_events;
create trigger agent_trace_broadcast_trigger
    after insert on public.agent_trace_events
    for each row
    execute function public.agent_trace_broadcast();

-- ---------------------------------------------------------------------------
-- Realtime private-channel authorization
-- ---------------------------------------------------------------------------

-- Subscribers may only join/read their own topic; publishers may write to it
-- (used by Presence tracking — broadcast itself flows through the trigger).
drop policy if exists "agent_trace_topic_owner_select" on realtime.messages;
create policy "agent_trace_topic_owner_select"
    on realtime.messages
    for select
    to authenticated
    using (realtime.topic() = public.agent_trace_topic((select auth.uid())));

drop policy if exists "agent_trace_topic_owner_insert" on realtime.messages;
create policy "agent_trace_topic_owner_insert"
    on realtime.messages
    for insert
    to authenticated
    with check (realtime.topic() = public.agent_trace_topic((select auth.uid())));

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER: a regular caller only prunes their own rows (RLS applies);
-- scheduled via pg_cron it runs as postgres and prunes everything, e.g.:
--   select cron.schedule('prune-agent-traces', '0 3 * * *',
--          $$select public.agent_trace_prune()$$);
create or replace function public.agent_trace_prune(retention interval default interval '7 days')
returns bigint
language plpgsql
set search_path = ''
as $$
declare
    deleted bigint;
begin
    delete from public.agent_trace_events
    where created_at < now() - retention;
    get diagnostics deleted = row_count;
    return deleted;
end;
$$;

revoke execute on function public.agent_trace_prune(interval) from public, anon;
