-- HR Management & Geo-Attendance System — Row Level Security
-- Source: project-specs/hr-system-setup.md §7 (Row Level Security paragraph)
--
-- Access rules implemented here:
--   - Employees: read/write only their own attendance and leave_requests rows.
--   - Managers: read attendance + read/update leave_requests for direct
--     reports (profiles.manager_id = the manager's own id).
--   - Admins: unrestricted access via a role check (profiles.role = 'admin').
--   - profiles/sites RLS is not spelled out in §7's RLS paragraph but is
--     required by task list Task 2 ("RLS enabled on ... sites, profiles");
--     see the per-table rationale comments below for the choices made.

-- Helper functions ------------------------------------------------------
-- security definer: these run with the privileges of the function owner
-- and therefore bypass RLS on their internal query, avoiding recursive
-- RLS evaluation when a policy on `profiles` needs to check `profiles`.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_manager_of(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id and manager_id = auth.uid()
  );
$$;

-- profiles ----------------------------------------------------------------
-- Rationale: this is an internal company directory (names, roles, manager/
-- site assignment) needed by every dashboard/admin view (e.g. showing an
-- employee's assigned manager or site name, or a manager's/admin's staff
-- list) — so any authenticated user may SELECT all rows. Writes are
-- restricted: a user may INSERT only their own row (sign-up), and only an
-- admin may UPDATE any row (role/manager/site assignment, task list Task 19).
alter table public.profiles enable row level security;

create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- sites ---------------------------------------------------------------------
-- Rationale: site name/coordinates/radius are needed for read-only display
-- everywhere (dashboard, attendance history, admin lists); only an admin
-- manages sites (task list Task 9).
alter table public.sites enable row level security;

create policy sites_select_authenticated
  on public.sites for select
  to authenticated
  using (true);

create policy sites_write_admin
  on public.sites for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attendance ------------------------------------------------------------
alter table public.attendance enable row level security;

create policy attendance_select_own
  on public.attendance for select
  to authenticated
  using (user_id = auth.uid());

-- Manager read access on attendance isn't spelled out in §7's RLS
-- paragraph (only leave_requests is), but is required for task list
-- Task 13 ("Manager ... team attendance history").
create policy attendance_select_manager
  on public.attendance for select
  to authenticated
  using (public.is_manager_of(user_id));

create policy attendance_insert_own
  on public.attendance for insert
  to authenticated
  with check (user_id = auth.uid());

-- Needed for check-out (Task 11), which updates an existing open record.
create policy attendance_update_own
  on public.attendance for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy attendance_admin_all
  on public.attendance for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- leave_requests --------------------------------------------------------
alter table public.leave_requests enable row level security;

create policy leave_requests_select_own
  on public.leave_requests for select
  to authenticated
  using (user_id = auth.uid());

create policy leave_requests_select_manager
  on public.leave_requests for select
  to authenticated
  using (public.is_manager_of(user_id));

create policy leave_requests_insert_own
  on public.leave_requests for insert
  to authenticated
  with check (user_id = auth.uid());

-- Manager approve/reject for direct reports (task list Task 15). Server-
-- side code sets status/reviewed_by/reviewed_at — this policy only gates
-- which rows a manager may touch, not which columns.
create policy leave_requests_update_manager
  on public.leave_requests for update
  to authenticated
  using (public.is_manager_of(user_id))
  with check (public.is_manager_of(user_id));

create policy leave_requests_admin_all
  on public.leave_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- notifications -----------------------------------------------------------
-- No INSERT policy for the `authenticated` role: a notification's owner
-- (the employee) is never the actor who triggers it (a manager/admin
-- approving/rejecting leave, task list Task 17). That write happens
-- server-side using the service-role client in the same server action
-- that updates leave_requests.status, bypassing RLS intentionally.
alter table public.notifications enable row level security;

create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_admin_all
  on public.notifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
