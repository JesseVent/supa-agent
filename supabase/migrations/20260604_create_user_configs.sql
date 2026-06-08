create table if not exists public.user_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  supabase_project_ref text,
  supabase_access_token text,
  llm_base_url text,
  llm_model text,
  updated_at timestamptz default now() not null
);

alter table public.user_configs enable row level security;

create policy "users_manage_own_config"
  on public.user_configs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.upsert_user_config(
  p_supabase_project_ref text default null,
  p_supabase_access_token text default null,
  p_llm_base_url text default null,
  p_llm_model text default null
) returns void language plpgsql security definer as $$
begin
  insert into public.user_configs (user_id, supabase_project_ref, supabase_access_token, llm_base_url, llm_model, updated_at)
  values (auth.uid(), p_supabase_project_ref, p_supabase_access_token, p_llm_base_url, p_llm_model, now())
  on conflict (user_id) do update set
    supabase_project_ref = coalesce(excluded.supabase_project_ref, user_configs.supabase_project_ref),
    supabase_access_token = coalesce(excluded.supabase_access_token, user_configs.supabase_access_token),
    llm_base_url = coalesce(excluded.llm_base_url, user_configs.llm_base_url),
    llm_model = coalesce(excluded.llm_model, user_configs.llm_model),
    updated_at = now();
end;
$$;
