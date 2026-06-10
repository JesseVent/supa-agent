-- Audit table for vault secret export calls.
-- RLS is disabled — this table is admin-only (service_role access only).
-- The edge function inserts a row on every successful export call.

create table if not exists public.vault_secret_exports (
    id          bigint generated always as identity primary key,
    called_at   timestamptz not null default now(),
    caller_ip   text,
    secret_count integer not null
);

-- No RLS policies — deny all access from anon/authenticated.
-- The table is only written to by the edge function using the service_role key.
alter table public.vault_secret_exports enable row level security;

-- Revoke default public access
revoke all on public.vault_secret_exports from anon, authenticated;

comment on table public.vault_secret_exports is
    'Audit log for export-vault-secrets edge function calls. Admin-only.';
