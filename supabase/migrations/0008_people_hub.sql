-- HR-68: "People Hub" — hibob-inspired core-HR + culture features.
--
-- Feature set (all employee-facing, read-mostly), modelled on hibob.com's
-- Core HR + engagement layer:
--   - Company Directory + rich employee profile pages  (new profiles columns)
--   - Org chart                                         (existing manager_id)
--   - Celebrations: birthdays / work anniversaries      (new birthday/start_date)
--   - Kudos / recognition wall                          (new kudos table)
--
-- Design goal: strictly additive + backward compatible. Every new profiles
-- column is nullable with no default, so the live sign-up insert
-- (src/app/signup/actions.ts) and the 0007 email BEFORE INSERT trigger keep
-- working untouched. kudos re-uses the exact RLS shape of the existing tables
-- and — unlike notifications — needs no service_role key, because the giver
-- *is* the row's actor (giver_id = auth.uid()), so a plain authenticated
-- INSERT policy authorizes it.

-- profiles: directory / profile-page fields --------------------------------
alter table public.profiles add column if not exists job_title  text;
alter table public.profiles add column if not exists department  text;
alter table public.profiles add column if not exists start_date  date;
alter table public.profiles add column if not exists birthday    date;
alter table public.profiles add column if not exists about       text;

comment on column public.profiles.job_title  is 'Directory/profile job title (HR-68).';
comment on column public.profiles.department is 'Directory grouping + org-chart department (HR-68).';
comment on column public.profiles.start_date is 'Employment start date; drives work-anniversary celebrations (HR-68).';
comment on column public.profiles.birthday   is 'Birthday; only month/day are surfaced in celebrations, the year is never displayed (HR-68).';
comment on column public.profiles.about      is 'Short bio shown on the employee profile page (HR-68).';

-- kudos: peer recognition wall --------------------------------------------
create table if not exists public.kudos (
  id uuid primary key default gen_random_uuid(),
  giver_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- A small, free-text-but-app-constrained recognition category
  -- ("Team player", "Above & beyond", …) rendered as a pill in the feed.
  category text not null default 'Kudos',
  message text not null,
  created_at timestamptz not null default now(),
  constraint kudos_no_self check (giver_id <> recipient_id),
  constraint kudos_message_not_blank check (length(btrim(message)) > 0)
);

comment on table public.kudos is
  'Peer-to-peer recognition (HR-68). Public company feed: any authenticated user may read; the giver creates their own rows; admins moderate.';

create index if not exists kudos_recipient_id_idx on public.kudos (recipient_id);
create index if not exists kudos_giver_id_idx on public.kudos (giver_id);
create index if not exists kudos_created_at_idx on public.kudos (created_at desc);

-- kudos RLS ----------------------------------------------------------------
-- Mirrors the existing tables' shape (see 0002_rls_policies.sql): a public,
-- company-wide recognition feed readable by every authenticated user; a user
-- may INSERT only rows where they are the giver (the kudos_no_self constraint
-- blocks self-kudos); admins get full access for moderation. No UPDATE for
-- regular users — kudos are immutable once posted. Policies are dropped first
-- so this migration is safely re-runnable.
alter table public.kudos enable row level security;

drop policy if exists kudos_select_authenticated on public.kudos;
create policy kudos_select_authenticated
  on public.kudos for select
  to authenticated
  using (true);

drop policy if exists kudos_insert_own on public.kudos;
create policy kudos_insert_own
  on public.kudos for insert
  to authenticated
  with check (giver_id = auth.uid());

drop policy if exists kudos_admin_all on public.kudos;
create policy kudos_admin_all
  on public.kudos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
