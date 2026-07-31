-- Security fix: profiles self-insert allowed role self-escalation.
--
-- 0002_rls_policies.sql's `profiles_insert_self` policy only checked
-- `id = auth.uid()`, with no restriction on which columns the inserting
-- user could set. The app's own /signup Server Action never sends a
-- `role`, but that's an application-layer convention, not something RLS
-- enforced — any authenticated user could bypass the app entirely and
-- `POST /rest/v1/profiles` with `role: "admin"` for their own row (their
-- very first, only insert, since profiles.id is the primary key) using
-- nothing but the public anon key + their own session. That grants full
-- admin access (sites CRUD, all employees' data, leave approval for
-- anyone) with no credential beyond a normal sign-up.
--
-- Found 2026-07-31 while building HR-11 (work sites + geo check-in/out),
-- confirmed by reproducing it directly against the live project to set up
-- a QA test admin account (no service_role key or SQL Editor access was
-- needed to pull it off).
--
-- Fix: a self-insert may only ever create an `employee` row. Promoting a
-- user to `manager`/`admin` remains possible only via
-- `profiles_update_admin` (0002_rls_policies.sql), i.e. an existing admin
-- doing it through the admin UI (task list Task 19) — never at sign-up.
-- This still leaves the "first ever admin" bootstrap problem, same as
-- before: that has to be done once via the Supabase SQL Editor
-- (`update public.profiles set role = 'admin' where id = '<uuid>'`) by
-- whoever provisioned the project, matching the manual-SQL-Editor pattern
-- already used for every other privileged one-off step in this project
-- (see ARCHITECTURE.md).

drop policy if exists profiles_insert_self on public.profiles;

create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role = 'employee');
