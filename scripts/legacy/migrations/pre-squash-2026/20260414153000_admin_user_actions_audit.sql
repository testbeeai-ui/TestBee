-- Governance audit trail for admin user actions (suspend/ban/soft-delete/restore).
create table if not exists public.admin_user_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  reason text null,
  old_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_user_actions_target_created
  on public.admin_user_actions (target_user_id, created_at desc);

create index if not exists idx_admin_user_actions_actor_created
  on public.admin_user_actions (actor_user_id, created_at desc);

alter table public.admin_user_actions enable row level security;

drop policy if exists admin_user_actions_select_admin on public.admin_user_actions;
create policy admin_user_actions_select_admin
  on public.admin_user_actions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'::public.app_role
    )
  );

drop policy if exists admin_user_actions_insert_admin on public.admin_user_actions;
create policy admin_user_actions_insert_admin
  on public.admin_user_actions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'::public.app_role
    )
  );
