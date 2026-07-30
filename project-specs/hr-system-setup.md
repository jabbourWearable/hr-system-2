# HR Management & Geo-Attendance System — Project Specification

Status: DRAFT — awaiting user confirmation (see "Open Questions" below) before any implementation work begins.

## 1. Goal

Build a web-based HR Management & Geo-Attendance system, inspired by
[MadhavPruthi/HR-Management-and-Geo-Attendance-System](https://github.com/MadhavPruthi/HR-Management-and-Geo-Attendance-System)
(a Flutter + Firebase mobile app). That reference app is mobile-only and
Firebase-backed; this project re-implements its feature set as a web app so it
can run on the requested stack.

## 2. Mandatory constraints (from the issue)

- **Deployment**: Vercel.
- **Database**: Supabase.
- **Auth**: email + password only. No third-party/social login, no magic
  links. Email confirmation is **disabled** — users can sign up and log in
  immediately without clicking a verification link.

## 3. Tech stack (proposed)

- **Frontend/Backend**: Next.js (App Router, TypeScript) — single deployable
  app, server actions/route handlers for privileged operations, deployed on
  Vercel.
- **Styling**: Tailwind CSS.
- **Database + Auth**: Supabase (Postgres, Supabase Auth with email/password,
  Row Level Security, Realtime for live notification updates).
- **Geolocation**: browser Geolocation API (`navigator.geolocation`) — no
  native maps SDK needed since this is a web app, not the original's Flutter
  app.

## 4. Roles

Three roles, stored on each user's profile:

- **Employee** — default role. Marks own attendance, requests leave, views
  own history.
- **Manager** — everything an Employee can do, plus approves/rejects leave
  for employees who report to them.
- **Admin** — full access: manages employees, work sites (geofences), and
  can approve/reject any leave request; views company-wide reports.

(Reference app has Employee + Manager + a separate Admin mobile app; this
spec folds Admin into role-based views inside the same web app instead of a
second application — see Open Questions #2.)

## 5. Core features (MVP scope)

Directly carried over from the reference app's feature list, adapted to web:

1. **Auth** — sign up (email, password, full name), log in, log out. No
   email verification step.
2. **Employee profile** — name, email, employee code, role, assigned
   manager, assigned work site.
3. **Work site management** (Admin) — CRUD for office sites: name,
   latitude, longitude, geofence radius (meters).
4. **Geo-attendance** — Employee dashboard has "Check In" / "Check Out".
   On click, browser requests location; the app computes the distance
   (haversine formula) from the employee's current position to their
   assigned site's coordinates. Within the radius → attendance recorded
   with timestamp + coordinates. Outside the radius → rejected with a
   clear error message.
5. **Attendance history** — employee sees their own check-in/check-out log;
   manager/admin see it for their team/company.
6. **Leave request** — employee submits a leave request (date range, type,
   reason) and sees its status (pending/approved/rejected).
7. **Leave approval** — manager sees pending requests from direct reports
   and approves/rejects (with optional comment); admin can do this for
   anyone.
8. **Notifications** — in-app notification list, updated in real time
   (Supabase Realtime) when a leave request's status changes. This replaces
   the reference app's Firebase Cloud Messaging push notifications, since a
   web app has no native push channel by default (see Open Questions #4).
9. **Admin dashboard** — manage employee accounts (role, manager, site
   assignment), manage sites, company-wide attendance & leave overview.

## 6. Explicitly out of scope for MVP

- Native mobile apps.
- Push notifications (FCM/APNs) — using in-app + Realtime instead.
- Biometric or photo-based attendance verification.
- Payroll, timesheets/hours-worked calculations, shift scheduling.
- Multi-tenant / multi-company support.
- SSO/OAuth social logins.

## 7. Data model (Supabase/Postgres, sketch)

- `profiles` — id (FK → `auth.users`), full_name, employee_code, role
  (`employee` \| `manager` \| `admin`), manager_id (FK → `profiles`),
  site_id (FK → `sites`), created_at.
- `sites` — id, name, latitude, longitude, radius_meters, created_at.
- `attendance` — id, user_id (FK → `profiles`), site_id, check_in_at,
  check_in_lat, check_in_lng, check_out_at, check_out_lat, check_out_lng,
  created_at.
- `leave_requests` — id, user_id (FK → `profiles`), start_date, end_date,
  leave_type, reason, status (`pending`\|`approved`\|`rejected`),
  reviewed_by (FK → `profiles`), reviewed_at, created_at.
- `notifications` — id, user_id (FK → `profiles`), message, is_read,
  created_at.

Row Level Security: employees can read/write only their own `attendance`
and `leave_requests` rows; managers can read + update leave rows where the
requester's `manager_id` matches them; admins have unrestricted access via a
role check.

## 8. Pages / routes (Next.js)

- `/login`, `/signup`
- `/dashboard` — employee home: check in/out, my attendance history, apply
  for leave, my leave status, notifications
- `/admin` — role-gated: employees list, sites list, leave approvals,
  attendance reports

## 9. Deployment plan

- **Supabase**: create project, run schema migration + RLS policies,
  disable "Confirm email" in Auth settings, capture project URL + anon key
  (+ service role key for server-side privileged operations).
- **Vercel**: connect this GitHub repo, set env vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`), deploy. Vercel serves over HTTPS by
  default, which the Geolocation API requires.

## 10. Delivery pipeline

Once this spec is confirmed, work proceeds through the standard pipeline:

1. **project-manager-senior** turns this spec into
   `project-tasks/hr-system-tasklist.md` (concrete, scoped tasks).
2. **ArchitectUX** defines the Next.js project structure, Supabase client
   setup, and route/auth-guard architecture.
3. **Developer ↔ EvidenceQA loop**, one task at a time — each task must
   pass QA (with screenshot evidence) before the next task starts.
4. **testing-reality-checker** — final integration pass across the whole
   system.
5. Deployment to Vercel + Supabase per section 9.

## 11. Open questions

1. **Roles**: is the 3-tier Employee/Manager/Admin split above right, or
   would a simpler 2-tier Employee/Admin (Admin approves all leave) be
   preferable for MVP?
2. **Admin app**: the reference project ships a *separate* admin mobile
   app. This spec instead folds admin functionality into the same web app
   under `/admin`, gated by role. Confirm that's fine (recommended — avoids
   building/maintaining two apps).
3. **Password reset**: "no email verification" is read here as "no signup
   confirmation email" only. Should a "forgot password" flow (which does
   send an email via Supabase) be included in MVP, or skipped entirely?
4. **Notifications**: in-app + real-time list (no push to a phone/browser)
   — acceptable for MVP?
5. Any specific default geofence radius (e.g. 200m), or should this always
   be admin-configurable per site with no fixed default?
6. Branding — any name/logo for the system, or is a generic placeholder
   fine for MVP?

Default assumptions above will be used if no response is received before
implementation starts; all are easy to change later.
