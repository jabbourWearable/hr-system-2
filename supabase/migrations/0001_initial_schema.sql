-- HR Management & Geo-Attendance System — initial schema
-- Source: project-specs/hr-system-setup.md §7 (Data model)
--
-- Run this against a fresh Supabase project's SQL editor, or via the
-- Supabase CLI (`supabase db push`) once the project is linked. See
-- ARCHITECTURE.md for the full Supabase setup checklist.

create extension if not exists pgcrypto;

-- profiles ------------------------------------------------------------
-- One row per auth.users row. Created by the sign-up flow (HR-10);
-- role/manager/site are admin-editable via the admin dashboard (HR-15).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  -- Nullable: HR-10 decides whether employee_code is auto-generated at
  -- sign-up or left null for an admin to assign later (task list Task 4).
  employee_code text unique,
  role text not null default 'employee'
    check (role in ('employee', 'manager', 'admin')),
  manager_id uuid references public.profiles (id) on delete set null,
  -- FK to sites added below, once the sites table exists.
  site_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Employee/manager/admin profile, one row per auth.users row.';

-- sites -----------------------------------------------------------------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  -- No fixed default radius per spec §11 Q5 — admin must enter a value
  -- explicitly; do not add a `default` clause here.
  radius_meters double precision not null check (radius_meters > 0),
  created_at timestamptz not null default now()
);

comment on table public.sites is
  'Admin-managed office sites / geofences for check-in validation.';

-- profiles.site_id references sites, which is created after profiles
-- above for readability; add the FK now that both tables exist.
alter table public.profiles
  add constraint profiles_site_id_fkey
  foreign key (site_id) references public.sites (id) on delete set null;

-- attendance --------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  check_in_at timestamptz not null,
  check_in_lat double precision not null,
  check_in_lng double precision not null,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  created_at timestamptz not null default now()
);

comment on table public.attendance is
  'Geo-validated check-in/check-out log. Haversine + radius check happens server-side (see ARCHITECTURE.md); this table only stores the outcome.';

-- leave_requests ------------------------------------------------------------
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  leave_type text not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint leave_requests_date_range_check check (end_date >= start_date)
);

comment on table public.leave_requests is
  'Employee leave requests with manager/admin approval workflow.';

-- notifications ---------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications, delivered live via Supabase Realtime (no push/FCM).';

-- indexes -----------------------------------------------------------------
create index if not exists profiles_manager_id_idx on public.profiles (manager_id);
create index if not exists profiles_site_id_idx on public.profiles (site_id);
create index if not exists attendance_user_id_idx on public.attendance (user_id);
create index if not exists attendance_site_id_idx on public.attendance (site_id);
create index if not exists leave_requests_user_id_idx on public.leave_requests (user_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
