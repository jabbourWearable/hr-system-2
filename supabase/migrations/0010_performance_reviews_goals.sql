-- HR-78: Performance reviews & goals/OKRs — hibob-inspired Performance
-- module. Three independent-but-related capabilities:
--   1. Review cycles + performance_reviews (self-assessment -> manager
--      assessment/rating, per employee per cycle).
--   2. goals: OKRs owned by the employee (objectives + key results).
--   3. one_on_ones + one_on_one_notes: manager/employee 1:1 meetings with
--      shared notes both can see/edit and private notes only the author
--      (not even admin) can read — a deliberate departure from every other
--      table in this project, documented below.
--
-- Same conventions as 0009_onboarding_offboarding.sql: `is_admin()` /
-- `is_manager_of()` helpers from 0002_rls_policies.sql are reused; this file
-- adds exactly one new helper, `is_one_on_one_participant()`, needed because
-- one_on_one_notes has no employee_id/manager_id column of its own to check
-- directly.

create table if not exists public.review_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  start_date date,
  end_date date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint review_cycles_name_not_blank check (length(btrim(name)) > 0)
);

comment on table public.review_cycles is
  'A named performance review period (e.g. "Q1 2026 Review") admins open and close (HR-78).';

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  -- Defaults to the employee's manager_id at generation time, but is its own
  -- column (not re-derived from profiles.manager_id) so a review's reviewer
  -- stays fixed even if the employee is later reassigned to a new manager,
  -- and so an admin can hand a review to someone other than the direct
  -- manager (e.g. a skip-level review) without a schema change.
  reviewer_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending_self'
    check (status in ('pending_self', 'pending_manager', 'completed')),
  self_assessment text,
  self_submitted_at timestamptz,
  manager_assessment text,
  rating integer check (rating between 1 and 5),
  manager_submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cycle_id, employee_id)
);

comment on table public.performance_reviews is
  'One review instance per employee per cycle: employee self-assessment, then reviewer assessment + 1-5 rating (HR-78).';

create index if not exists performance_reviews_cycle_id_idx on public.performance_reviews (cycle_id);
create index if not exists performance_reviews_employee_id_idx on public.performance_reviews (employee_id);
create index if not exists performance_reviews_reviewer_id_idx on public.performance_reviews (reviewer_id);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  -- Optional: ties a goal to a review cycle without requiring one (an OKR
  -- can be quarterly/cycle-scoped or a standalone standing goal).
  cycle_id uuid references public.review_cycles (id) on delete set null,
  goal_type text not null default 'goal' check (goal_type in ('objective', 'key_result', 'goal')),
  -- Only a key_result may roll up into an objective; a top-level
  -- objective/goal always has parent_goal_id null.
  parent_goal_id uuid references public.goals (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'not_started'
    check (status in ('not_started', 'on_track', 'at_risk', 'completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_title_not_blank check (length(btrim(title)) > 0),
  constraint goals_parent_only_for_key_result
    check (goal_type = 'key_result' or parent_goal_id is null)
);

comment on table public.goals is
  'Employee-owned OKR: a standalone goal, an objective, or a key_result rolling up into an objective via parent_goal_id (HR-78).';

create index if not exists goals_employee_id_idx on public.goals (employee_id);
create index if not exists goals_cycle_id_idx on public.goals (cycle_id);
create index if not exists goals_parent_goal_id_idx on public.goals (parent_goal_id);

create table if not exists public.one_on_ones (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  manager_id uuid not null references public.profiles (id) on delete cascade,
  meeting_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.one_on_ones is
  '1:1 meeting metadata between a manager and one direct report (HR-78). Note bodies live in one_on_one_notes, not here.';

create index if not exists one_on_ones_employee_id_idx on public.one_on_ones (employee_id);
create index if not exists one_on_ones_manager_id_idx on public.one_on_ones (manager_id);

create table if not exists public.one_on_one_notes (
  id uuid primary key default gen_random_uuid(),
  one_on_one_id uuid not null references public.one_on_ones (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- 'shared': either participant can read/edit (a joint agenda/action-items
  -- doc). 'private': only the author can ever read or write it, enforced by
  -- RLS below with no admin bypass — see the file-level comment.
  visibility text not null check (visibility in ('private', 'shared')),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.one_on_one_notes is
  'Note attached to a one_on_ones meeting. visibility=private is never readable by anyone but its author, not even admin (HR-78).';

create index if not exists one_on_one_notes_one_on_one_id_idx on public.one_on_one_notes (one_on_one_id);

-- At most one shared note per meeting, and at most one private note per
-- (meeting, author) — i.e. one private note for the employee, one for the
-- manager. Partial unique indexes since the uniqueness rule differs by
-- visibility (shared has no author scoping, private does).
create unique index if not exists one_on_one_notes_shared_unique
  on public.one_on_one_notes (one_on_one_id)
  where visibility = 'shared';

create unique index if not exists one_on_one_notes_private_unique
  on public.one_on_one_notes (one_on_one_id, author_id)
  where visibility = 'private';

-- Helper: is auth.uid() a participant (employee or manager) of this
-- one_on_ones row? Needed because one_on_one_notes has no employee_id/
-- manager_id of its own to check directly — same security-definer shape as
-- is_admin()/is_manager_of() in 0002_rls_policies.sql, so it can be called
-- from within one_on_one_notes' own RLS policies without recursive-subquery
-- issues.
create or replace function public.is_one_on_one_participant(oo_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.one_on_ones
    where id = oo_id
      and (employee_id = auth.uid() or manager_id = auth.uid())
  );
$$;

-- review_cycles RLS ----------------------------------------------------
-- Cycle name/dates are readable by anyone authenticated (same "internal
-- company directory" posture as profiles/sites per ARCHITECTURE.md) so an
-- employee's own review page can show which cycle it belongs to. Only
-- admin/HR creates, renames, or opens/closes a cycle.
alter table public.review_cycles enable row level security;

drop policy if exists review_cycles_select_all on public.review_cycles;
create policy review_cycles_select_all
  on public.review_cycles for select
  to authenticated
  using (true);

drop policy if exists review_cycles_admin_all on public.review_cycles;
create policy review_cycles_admin_all
  on public.review_cycles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- performance_reviews RLS ------------------------------------------------
-- The employee sees + edits their own self-assessment; the assigned
-- reviewer sees + edits the manager assessment/rating; admin has full
-- read/write (a normal HR function, unlike the 1:1-notes privacy carve-out
-- below). Same "policy gates which rows, not which columns" note as
-- leave_requests_update_manager (0002_rls_policies.sql) — the app's Server
-- Actions only ever submit the fields appropriate to the caller's stage.
alter table public.performance_reviews enable row level security;

drop policy if exists performance_reviews_select_own on public.performance_reviews;
create policy performance_reviews_select_own
  on public.performance_reviews for select
  to authenticated
  using (employee_id = auth.uid());

drop policy if exists performance_reviews_select_reviewer on public.performance_reviews;
create policy performance_reviews_select_reviewer
  on public.performance_reviews for select
  to authenticated
  using (reviewer_id = auth.uid());

drop policy if exists performance_reviews_update_own on public.performance_reviews;
create policy performance_reviews_update_own
  on public.performance_reviews for update
  to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

drop policy if exists performance_reviews_update_reviewer on public.performance_reviews;
create policy performance_reviews_update_reviewer
  on public.performance_reviews for update
  to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

drop policy if exists performance_reviews_admin_all on public.performance_reviews;
create policy performance_reviews_admin_all
  on public.performance_reviews for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- goals RLS ---------------------------------------------------------------
-- The employee fully owns their own goals (create/edit/delete); their
-- manager can view (not edit) for visibility into direct reports' OKRs;
-- admin has full read/write for company-wide reporting.
alter table public.goals enable row level security;

drop policy if exists goals_select_own on public.goals;
create policy goals_select_own
  on public.goals for select
  to authenticated
  using (employee_id = auth.uid());

drop policy if exists goals_select_manager on public.goals;
create policy goals_select_manager
  on public.goals for select
  to authenticated
  using (public.is_manager_of(employee_id));

drop policy if exists goals_insert_own on public.goals;
create policy goals_insert_own
  on public.goals for insert
  to authenticated
  with check (employee_id = auth.uid());

drop policy if exists goals_update_own on public.goals;
create policy goals_update_own
  on public.goals for update
  to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

drop policy if exists goals_delete_own on public.goals;
create policy goals_delete_own
  on public.goals for delete
  to authenticated
  using (employee_id = auth.uid());

drop policy if exists goals_admin_all on public.goals;
create policy goals_admin_all
  on public.goals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- one_on_ones RLS -----------------------------------------------------
-- Meeting metadata (who/when/status) is visible to both participants and
-- admin (oversight that 1:1s are happening at all, without exposing note
-- content — see one_on_one_notes below). Only the manager side schedules a
-- new 1:1, and only with their own direct report.
alter table public.one_on_ones enable row level security;

drop policy if exists one_on_ones_select_employee on public.one_on_ones;
create policy one_on_ones_select_employee
  on public.one_on_ones for select
  to authenticated
  using (employee_id = auth.uid());

drop policy if exists one_on_ones_select_manager on public.one_on_ones;
create policy one_on_ones_select_manager
  on public.one_on_ones for select
  to authenticated
  using (manager_id = auth.uid());

drop policy if exists one_on_ones_insert_manager on public.one_on_ones;
create policy one_on_ones_insert_manager
  on public.one_on_ones for insert
  to authenticated
  with check (manager_id = auth.uid() and public.is_manager_of(employee_id));

drop policy if exists one_on_ones_update_participant on public.one_on_ones;
create policy one_on_ones_update_participant
  on public.one_on_ones for update
  to authenticated
  using (employee_id = auth.uid() or manager_id = auth.uid())
  with check (employee_id = auth.uid() or manager_id = auth.uid());

drop policy if exists one_on_ones_admin_all on public.one_on_ones;
create policy one_on_ones_admin_all
  on public.one_on_ones for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- one_on_one_notes RLS ----------------------------------------------------
-- Deliberate departure from every other table in this project: there is NO
-- admin bypass here. A private 1:1 note (an employee's or manager's own
-- reflection ahead of a meeting) is readable only by the person who wrote
-- it, full stop — not the other participant, not admin/HR. A shared note is
-- readable/writable by either participant (two policies below, since the
-- author of a shared note isn't necessarily the only one who should be able
-- to edit it later). Admin still sees that a 1:1 happened via one_on_ones
-- above; it just can't read what was written.
alter table public.one_on_one_notes enable row level security;

drop policy if exists one_on_one_notes_select on public.one_on_one_notes;
create policy one_on_one_notes_select
  on public.one_on_one_notes for select
  to authenticated
  using (
    author_id = auth.uid()
    or (visibility = 'shared' and public.is_one_on_one_participant(one_on_one_id))
  );

drop policy if exists one_on_one_notes_insert on public.one_on_one_notes;
create policy one_on_one_notes_insert
  on public.one_on_one_notes for insert
  to authenticated
  with check (author_id = auth.uid() and public.is_one_on_one_participant(one_on_one_id));

drop policy if exists one_on_one_notes_update_author on public.one_on_one_notes;
create policy one_on_one_notes_update_author
  on public.one_on_one_notes for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists one_on_one_notes_update_shared_participant on public.one_on_one_notes;
create policy one_on_one_notes_update_shared_participant
  on public.one_on_one_notes for update
  to authenticated
  using (visibility = 'shared' and public.is_one_on_one_participant(one_on_one_id))
  with check (visibility = 'shared' and public.is_one_on_one_participant(one_on_one_id));

drop policy if exists one_on_one_notes_delete_author on public.one_on_one_notes;
create policy one_on_one_notes_delete_author
  on public.one_on_one_notes for delete
  to authenticated
  using (author_id = auth.uid());
