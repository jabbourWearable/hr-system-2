-- HR-77: Onboarding & offboarding workflows — hibob-inspired core-HR
-- lifecycle capability. Structured new-hire/departing-employee checklists:
-- a workflow per employee (onboarding or offboarding), made up of tasks with
-- an assignee, an optional due date, and a status, so progress can be
-- tracked to completion.
--
-- Design goal: mirror the existing leave_requests RLS shape (a row-owner
-- column checked directly by policy, using the same is_admin()/
-- is_manager_of() helper functions from 0002_rls_policies.sql — no new
-- helper functions needed). onboarding_tasks carries its own `employee_id`
-- (a denormalized copy of the parent workflow's employee_id) purely so its
-- RLS policies can check it directly, the same way every other table here
-- does, instead of an EXISTS-subquery join into onboarding_workflows.

create table if not exists public.onboarding_workflows (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  workflow_type text not null check (workflow_type in ('onboarding', 'offboarding')),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  -- Onboarding: the new hire's start date. Offboarding: their last working day.
  -- Task due dates below are computed relative to this.
  target_date date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.onboarding_workflows is
  'One onboarding or offboarding checklist instance per employee lifecycle event (HR-77).';

create index if not exists onboarding_workflows_employee_id_idx
  on public.onboarding_workflows (employee_id);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.onboarding_workflows (id) on delete cascade,
  -- Denormalized from onboarding_workflows.employee_id — see file header.
  employee_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  order_index integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint onboarding_tasks_title_not_blank check (length(btrim(title)) > 0)
);

comment on table public.onboarding_tasks is
  'Individual checklist item within an onboarding_workflows row: an assignee, an optional due date, and a status (HR-77).';

create index if not exists onboarding_tasks_workflow_id_idx on public.onboarding_tasks (workflow_id);
create index if not exists onboarding_tasks_employee_id_idx on public.onboarding_tasks (employee_id);
create index if not exists onboarding_tasks_assignee_id_idx on public.onboarding_tasks (assignee_id);

-- onboarding_workflows RLS ---------------------------------------------------
-- The employee sees their own workflow; their manager sees it too (mirrors
-- attendance_select_manager/leave_requests_select_manager); admin/HR has
-- full read/write since they own the checklist end-to-end (create, edit,
-- close out).
alter table public.onboarding_workflows enable row level security;

drop policy if exists onboarding_workflows_select_own on public.onboarding_workflows;
create policy onboarding_workflows_select_own
  on public.onboarding_workflows for select
  to authenticated
  using (employee_id = auth.uid());

drop policy if exists onboarding_workflows_select_manager on public.onboarding_workflows;
create policy onboarding_workflows_select_manager
  on public.onboarding_workflows for select
  to authenticated
  using (public.is_manager_of(employee_id));

drop policy if exists onboarding_workflows_admin_all on public.onboarding_workflows;
create policy onboarding_workflows_admin_all
  on public.onboarding_workflows for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- onboarding_tasks RLS --------------------------------------------------
-- Read: the employee the workflow is about, their manager, or the task's own
-- assignee (a manager/admin task like "provision laptop" may be assigned to
-- someone who is neither the employee nor their manager, e.g. IT — the
-- assignee still needs to see and act on their own task).
alter table public.onboarding_tasks enable row level security;

drop policy if exists onboarding_tasks_select_own on public.onboarding_tasks;
create policy onboarding_tasks_select_own
  on public.onboarding_tasks for select
  to authenticated
  using (employee_id = auth.uid() or assignee_id = auth.uid());

drop policy if exists onboarding_tasks_select_manager on public.onboarding_tasks;
create policy onboarding_tasks_select_manager
  on public.onboarding_tasks for select
  to authenticated
  using (public.is_manager_of(employee_id));

-- An assignee may update their own task (e.g. mark it in-progress/done).
-- Same "policy only gates which rows, not which columns" note as
-- leave_requests_update_manager (0002_rls_policies.sql) — the app's own
-- Server Actions only ever submit a status change through this path.
drop policy if exists onboarding_tasks_update_assignee on public.onboarding_tasks;
create policy onboarding_tasks_update_assignee
  on public.onboarding_tasks for update
  to authenticated
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());

drop policy if exists onboarding_tasks_admin_all on public.onboarding_tasks;
create policy onboarding_tasks_admin_all
  on public.onboarding_tasks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Realtime, matching 0003_realtime.sql's pattern for notifications, so a
-- future live-progress view can subscribe (not used by the MVP dashboard
-- yet, but wiring it up now costs nothing and matches the rest of the app).
-- Wrapped in existence checks (unlike 0003) so this migration is safely
-- re-runnable, matching the `if not exists`/`drop ... if exists` guards
-- used everywhere else in this file.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'onboarding_workflows'
  ) then
    alter publication supabase_realtime add table public.onboarding_workflows;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'onboarding_tasks'
  ) then
    alter publication supabase_realtime add table public.onboarding_tasks;
  end if;
end $$;
