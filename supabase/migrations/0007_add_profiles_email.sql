-- Add profiles.email (denormalized copy of auth.users.email).
--
-- Neither the spec's §7 data-model sketch nor 0001_initial_schema.sql's
-- profiles table includes an email column (email lives on auth.users only).
-- HR-15's own acceptance criteria (task list Task 19) explicitly require
-- showing each employee's email in the admin account-management list — same
-- category of gap as HR-13's review_comment (0005): the task list asks for a
-- field the original schema sketch didn't include.
--
-- No SUPABASE_SERVICE_ROLE_KEY is available in this workspace to read
-- auth.users directly (see ARCHITECTURE.md's recurring DDL-access blocker),
-- so this column is populated entirely at the database layer instead of by
-- application code:
--   - existing rows are backfilled in this same migration (the SQL Editor
--     runs as the database owner and can join auth.users directly, no
--     service_role/anon key involved);
--   - a BEFORE INSERT trigger keeps populating it for every future sign-up.
-- This deliberately avoids touching src/app/signup/actions.ts (HR-10,
-- already live and QA-verified) — coupling that insert to an `email` column
-- would break real sign-ups the moment the code shipped, for however long
-- this migration takes to actually land in the SQL Editor (the same gap
-- that stalled 0004/0005 for hours). The trigger runs regardless of what
-- columns the application's own INSERT sets.

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select email into new.email from auth.users where id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_sync_email on public.profiles;

create trigger profiles_sync_email
  before insert on public.profiles
  for each row
  execute function public.sync_profile_email();
