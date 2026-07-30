# HR Management & Geo-Attendance System — Development Tasks

Source spec: `project-specs/hr-system-setup.md` (approved 2026-07-30).

## Specification Summary

**Goal** (§1): "Build a web-based HR Management & Geo-Attendance system" — a web
re-implementation of a Flutter/Firebase reference app's feature set.

**Mandatory constraints** (§2): Deploy to Vercel. Database on Supabase. Auth is
"email + password only. No third-party/social login, no magic links... Email
confirmation is disabled — users can sign up and log in immediately without
clicking a verification link."

**Technical stack** (§3): Next.js (App Router, TypeScript), Tailwind CSS,
Supabase (Postgres, Supabase Auth, Row Level Security, Realtime), browser
Geolocation API. No mobile app, no native maps SDK.

**Roles** (§4): Employee, Manager, Admin — three tiers, stored on the user's
profile.

**Baked-in defaults** (per §11 "Open questions," no reviewer response received
— using the spec's own stated fallback: "Default assumptions above will be
used if no response is received before implementation starts"):

- 3-tier Employee/Manager/Admin roles as written in §4 (Q1).
- Admin functionality lives at `/admin` inside this same Next.js app — **no
  separate admin app** (Q2).
- **No password-reset / forgot-password flow in this MVP** (Q3) — do not build
  one; do not add a "Forgot password?" link.
- Notifications are **in-app + Supabase Realtime only** — no push/FCM/APNs
  (Q4, and restated as out of scope in §6).
- Geofence radius has **no fixed default value** — it is always an
  admin-configurable number per site (Q5). Do not hardcode a "default radius"
  like 200m anywhere; the input is a required field with no pre-filled value
  (or an obviously-a-placeholder value the admin must consciously accept).
- **Generic placeholder branding** — no custom name/logo work (Q6).

## Explicitly Out of Scope (§6 — do not build any of this)

- Native mobile apps.
- Push notifications (FCM/APNs).
- Biometric or photo-based attendance verification.
- Payroll, timesheets/hours-worked calculations, shift scheduling.
- Multi-tenant / multi-company support.
- SSO/OAuth social logins.
- (Per the baked-in defaults above, also treat as out of scope for this MVP:
  password-reset/forgot-password flow, any push-notification channel, any
  fixed/default geofence radius value, custom branding/logo work.)

---

## Development Tasks

### Foundation

#### [ ] Task 1: Supabase schema migration
**Description**: Create the Supabase Postgres schema exactly as sketched in the
spec: `profiles`, `sites`, `attendance`, `leave_requests`, `notifications`
tables with the columns and foreign keys listed.
**Acceptance Criteria**:
- `profiles`: id (FK → `auth.users`), full_name, employee_code, role (enum/check:
  `employee`\|`manager`\|`admin`), manager_id (FK → `profiles`, nullable),
  site_id (FK → `sites`, nullable), created_at.
- `sites`: id, name, latitude, longitude, radius_meters, created_at.
- `attendance`: id, user_id (FK → `profiles`), site_id, check_in_at,
  check_in_lat, check_in_lng, check_out_at (nullable), check_out_lat
  (nullable), check_out_lng (nullable), created_at.
- `leave_requests`: id, user_id (FK → `profiles`), start_date, end_date,
  leave_type, reason, status (`pending`\|`approved`\|`rejected`, default
  `pending`), reviewed_by (FK → `profiles`, nullable), reviewed_at (nullable),
  created_at.
- `notifications`: id, user_id (FK → `profiles`), message, is_read (default
  false), created_at.
- Migration runs cleanly against a fresh Supabase project.
- No extra tables/columns beyond what's listed above (e.g. no payroll,
  timesheet, or shift columns — see §6).
**Reference**: Spec §7 (Data model).

#### [ ] Task 2: Row Level Security policies
**Description**: Implement RLS policies matching the spec's access rules.
**Acceptance Criteria**:
- RLS enabled on `attendance`, `leave_requests`, `notifications`, `sites`,
  `profiles`.
- Employees can read/write only their own `attendance` and `leave_requests`
  rows.
- Managers can read + update `leave_requests` rows where the requester's
  `manager_id` matches the manager's own profile id.
- Admins have unrestricted access via a role check (e.g. a policy checking
  `profiles.role = 'admin'` for the requesting user).
- Verify with at least one manual test per role (e.g. via Supabase SQL editor
  impersonating a JWT, or a script) confirming an employee cannot read another
  employee's attendance/leave rows.
**Reference**: Spec §7 (Row Level Security paragraph).

#### [ ] Task 3: Supabase Auth config + Next.js Supabase client wiring
**Description**: Configure Supabase Auth for email/password with confirmation
disabled, and wire up Supabase client helpers in the Next.js app for browser
and server (route handler/server action) use.
**Acceptance Criteria**:
- Supabase project Auth settings: email/password provider enabled, all
  social/OAuth providers left off, "Confirm email" toggle disabled.
- Env vars present and read correctly: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- A browser-side Supabase client and a server-side Supabase client are
  available for use in later tasks (exact file locations per ArchitectUX's
  project structure).
- A signed-up test user can log in immediately with no verification email
  step required.
**Reference**: Spec §2 (mandatory constraints — auth), §9 (deployment plan,
env vars), §7 (Supabase/Postgres).

---

### Auth (Spec §5, item 1)

> Quote: "**Auth** — sign up (email, password, full name), log in, log out. No
> email verification step."

#### [ ] Task 4: Sign-up page and flow
**Description**: Build `/signup` — form with email, password, full name.
Submitting creates a Supabase Auth user and a corresponding `profiles` row.
**Acceptance Criteria**:
- Form fields: email, password, full name — nothing else required.
- On success, a `profiles` row is created for the new user with `role`
  defaulted to `employee`, `full_name` set, `employee_code` populated (e.g.
  generated or left for admin to set later — pick one and document it),
  `manager_id`/`site_id` null until an admin assigns them.
- User is logged in immediately after sign-up (no "check your email" step,
  no verification link).
- Basic inline validation errors (e.g. duplicate email) are shown to the
  user.
- No "Forgot password?" link or forgot-password route is present anywhere on
  this page (baked-in default, Q3).
**Files**: `/signup` route/page and its server action or API call.
**Reference**: Spec §5.1, §11 Q3 default.

#### [ ] Task 5: Login page and flow
**Description**: Build `/login` — email + password form, authenticates
against Supabase Auth and redirects to `/dashboard`.
**Acceptance Criteria**:
- Form fields: email, password only.
- Successful login redirects to `/dashboard`.
- Invalid credentials show a clear error message without revealing whether
  the email exists.
- No social/OAuth login buttons, no magic-link option, no "Forgot password?"
  link (Q3 default).
**Files**: `/login` route/page.
**Reference**: Spec §5.1, §2, §8.

#### [ ] Task 6: Logout and session handling
**Description**: Implement logout action and ensure unauthenticated users are
redirected away from protected pages.
**Acceptance Criteria**:
- A visible logout control (e.g. in dashboard nav) ends the Supabase session
  and redirects to `/login`.
- Visiting `/dashboard` or `/admin` while logged out redirects to `/login`.
**Reference**: Spec §5.1, §8.

#### [ ] Task 7: Role-based route guard for `/dashboard` and `/admin`
**Description**: Enforce role checks so `/admin` is reachable only by users
whose `profiles.role = 'admin'`; `/dashboard` is reachable by any
authenticated user regardless of role.
**Acceptance Criteria**:
- An authenticated Employee or Manager visiting `/admin` is redirected (e.g.
  to `/dashboard`) or shown a 403 — not the admin UI.
- An authenticated Admin can reach both `/dashboard` and `/admin`.
- Role check reads `profiles.role`, not client-trusted state alone (server-
  side check on protected routes/actions).
**Reference**: Spec §4 (Roles), §8 (Pages/routes).

---

### Employee Profile (Spec §5, item 2)

> Quote: "**Employee profile** — name, email, employee code, role, assigned
> manager, assigned work site."

#### [ ] Task 8: Employee profile view
**Description**: On `/dashboard`, show the logged-in user's own profile info.
**Acceptance Criteria**:
- Displays: full name, email, employee code, role, assigned manager's name
  (or "Unassigned"), assigned work site's name (or "Unassigned").
- Read-only for Employee and Manager roles (editing role/manager/site
  assignment is an Admin-only action — see Task 17).
**Reference**: Spec §5.2, §7 (`profiles` table).

---

### Work Site Management (Spec §5, item 3)

> Quote: "**Work site management** (Admin) — CRUD for office sites: name,
> latitude, longitude, geofence radius (meters)."

#### [ ] Task 9: Admin — work sites CRUD
**Description**: Build the `/admin` sites section: list, create, edit, delete
work sites.
**Acceptance Criteria**:
- List view shows all sites: name, latitude, longitude, radius (meters).
- Create/edit form has four fields: name, latitude, longitude,
  radius_meters — all required, no pre-filled/default radius value (Q5
  default: always admin-configurable, no fixed default).
- Delete removes a site (decide and document behavior for sites with
  assigned employees/attendance — e.g. block delete or require reassignment
  first; do not silently orphan foreign keys).
- Only reachable by Admin role (relies on Task 7's route guard).
**Reference**: Spec §5.3, §7 (`sites` table), §11 Q5 default.

---

### Geo-Attendance (Spec §5, item 4)

> Quote: "**Geo-attendance** — Employee dashboard has 'Check In' / 'Check
> Out'. On click, browser requests location; the app computes the distance
> (haversine formula) from the employee's current position to their assigned
> site's coordinates. Within the radius → attendance recorded with timestamp
> + coordinates. Outside the radius → rejected with a clear error message."

#### [ ] Task 10: Check-in flow with haversine geofence validation
**Description**: Implement the "Check In" button on `/dashboard`: request
browser geolocation, compute haversine distance to the employee's assigned
site, and record or reject accordingly.
**Acceptance Criteria**:
- Clicking "Check In" triggers `navigator.geolocation.getCurrentPosition`
  (with a clear message if the user denies permission or it's unavailable).
- Distance from returned coordinates to the employee's assigned
  `sites.latitude/longitude` is computed using the haversine formula.
- If distance ≤ `sites.radius_meters`: create an `attendance` row with
  `user_id`, `site_id`, `check_in_at` (server time), `check_in_lat`,
  `check_in_lng`.
- If distance > radius: no row is created; a clear on-screen error states
  the check-in was rejected for being outside the site radius.
- An employee with no assigned site sees a clear message instead of a crash
  (e.g. "No work site assigned — contact your admin").
- Haversine distance calculation happens server-side (route handler/server
  action), not client-only, so it can't be bypassed by editing client code.
**Reference**: Spec §5.4, §7 (`attendance` table).

#### [ ] Task 11: Check-out flow
**Description**: Implement the "Check Out" button, mirroring check-in logic
against the same open attendance record.
**Acceptance Criteria**:
- "Check Out" is only actionable when the employee has an open attendance
  record for today (checked in, not yet checked out).
- Same geolocation + haversine + radius validation as check-in.
- On success, updates the existing `attendance` row's `check_out_at`,
  `check_out_lat`, `check_out_lng`.
- Outside-radius check-out is rejected with a clear error message, same as
  check-in.
**Reference**: Spec §5.4, §7 (`attendance` table).

---

### Attendance History (Spec §5, item 5)

> Quote: "**Attendance history** — employee sees their own check-in/check-out
> log; manager/admin see it for their team/company."

#### [ ] Task 12: Employee — own attendance history
**Description**: On `/dashboard`, list the logged-in employee's past
attendance records.
**Acceptance Criteria**:
- Table/list of the employee's own `attendance` rows: date, check-in time,
  check-out time (or "—" if still open), site name.
- Sorted newest first.
- No records from other employees are visible (relies on Task 2's RLS).
**Reference**: Spec §5.5.

#### [ ] Task 13: Manager/Admin — team/company attendance history
**Description**: Managers see attendance for their direct reports; Admins see
attendance company-wide.
**Acceptance Criteria**:
- Manager view (reachable from `/dashboard`) lists attendance rows for
  employees whose `manager_id` matches the manager, filterable by employee
  and/or date range.
- Admin view (in `/admin`) lists attendance rows for all employees, same
  filters.
- Each row shows employee name, date, check-in/out times, site.
**Reference**: Spec §5.5, §5.9 ("company-wide attendance & leave overview").

---

### Leave Request (Spec §5, item 6)

> Quote: "**Leave request** — employee submits a leave request (date range,
> type, reason) and sees its status (pending/approved/rejected)."

#### [ ] Task 14: Leave request form and status view
**Description**: On `/dashboard`, let an employee submit a leave request and
see the status of their own requests.
**Acceptance Criteria**:
- Form fields: start date, end date, leave type, reason — all required.
- Submitting creates a `leave_requests` row with `status = 'pending'`.
- Below/near the form, the employee sees a list of their own leave requests
  with current status (pending/approved/rejected) and, if reviewed, no
  further edit is possible on that request.
- End date must not be before start date (basic validation).
**Reference**: Spec §5.6, §7 (`leave_requests` table).

---

### Leave Approval (Spec §5, item 7)

> Quote: "**Leave approval** — manager sees pending requests from direct
> reports and approves/rejects (with optional comment); admin can do this for
> anyone."

#### [ ] Task 15: Manager — leave approval queue
**Description**: Manager-facing view (reachable from `/dashboard`) listing
pending leave requests from direct reports, with approve/reject actions.
**Acceptance Criteria**:
- Lists `leave_requests` where `status = 'pending'` and the requester's
  `manager_id` equals the manager's profile id.
- Approve/Reject buttons update `status`, `reviewed_by` (the manager),
  `reviewed_at`.
- Optional comment field is captured on approve/reject (decide storage — a
  `review_comment` column if one is added, document the addition since it's
  not in the §7 sketch but is explicitly requested in §5.7).
- A manager cannot approve/reject requests from employees who are not their
  direct reports (server-side check, not just UI hiding).
**Reference**: Spec §5.7, §7 (`leave_requests` table).

#### [ ] Task 16: Admin — leave approval for any employee
**Description**: In `/admin`, list all pending (and optionally historical)
leave requests company-wide with approve/reject actions available for any
employee.
**Acceptance Criteria**:
- Lists `leave_requests` across all employees, not just a manager's reports.
- Approve/Reject works the same as Task 15, with `reviewed_by` set to the
  admin.
- Only reachable by Admin role.
**Reference**: Spec §5.7, §5.9.

---

### Notifications (Spec §5, item 8)

> Quote: "**Notifications** — in-app notification list, updated in real time
> (Supabase Realtime) when a leave request's status changes."

#### [ ] Task 17: Write notification on leave status change
**Description**: When a leave request's status changes (Task 15/16's
approve/reject actions), insert a `notifications` row for the requesting
employee.
**Acceptance Criteria**:
- Approving or rejecting a leave request creates a `notifications` row for
  that request's `user_id` with a message describing the new status (e.g.
  "Your leave request for 2026-08-01–2026-08-03 was approved.").
- `is_read` defaults to false.
- No notification is created for the pending→pending no-op case.
**Reference**: Spec §5.8, §7 (`notifications` table).

#### [ ] Task 18: In-app notification list with Supabase Realtime
**Description**: Add a notification list/indicator on `/dashboard` (visible to
all roles) that updates live via Supabase Realtime as new rows arrive.
**Acceptance Criteria**:
- Shows the logged-in user's own notifications, newest first, with read/
  unread state.
- Subscribes to Supabase Realtime on the `notifications` table filtered to
  the current user; a new row appears without a page reload.
- Clicking a notification (or a "mark read" control) sets `is_read = true`.
- No push notification, browser notification API, or FCM/APNs integration is
  added — in-app list only (§6, §11 Q4 default).
**Reference**: Spec §5.8, §11 Q4 default, §6 (push out of scope).

---

### Admin Dashboard (Spec §5, item 9)

> Quote: "**Admin dashboard** — manage employee accounts (role, manager, site
> assignment), manage sites, company-wide attendance & leave overview."

#### [ ] Task 19: Admin — employee account management
**Description**: In `/admin`, list all employee accounts and allow editing
role, assigned manager, and assigned site.
**Acceptance Criteria**:
- List view: all `profiles` rows with name, email, employee code, role,
  manager, site.
- Edit action lets an admin change `role` (employee/manager/admin),
  `manager_id` (pick from existing profiles), `site_id` (pick from existing
  sites) for any employee.
- Only reachable by Admin role.
**Reference**: Spec §5.9, §4 (Roles), §7 (`profiles` table).

#### [ ] Task 20: Admin — company-wide overview
**Description**: A summary view in `/admin` combining attendance and leave
data across the whole company (this may reuse Task 13/16's underlying
queries in a combined "overview" landing page for `/admin`).
**Acceptance Criteria**:
- Shows at-a-glance company-wide counts (e.g. checked-in today, pending leave
  requests count) and links into the detailed attendance/leave views from
  Tasks 13 and 16.
- No payroll, hours-worked, or shift-scheduling calculations are included
  (§6 explicitly out of scope).
**Reference**: Spec §5.9, §6.

---

## Quality Requirements

- [ ] Server-side checks (RLS + route/action guards) enforce role and
  ownership rules — never rely on hiding a button in the UI as the only
  access control.
- [ ] Geolocation permission-denied and geolocation-unsupported cases show a
  clear message, not a silent failure or crash.
- [ ] No task introduces password-reset/forgot-password, push notifications,
  photo/biometric verification, payroll/timesheet/shift features,
  multi-company support, or social/OAuth login (§6, §11 baked-in defaults).
- [ ] No hardcoded default geofence radius anywhere in code or seed data
  beyond what an admin explicitly enters per site (§11 Q5).
- [ ] Basic responsive layout for the check-in/check-out controls on
  `/dashboard`, since employees will use them from a phone browser in the
  field.

## Technical Notes

**Stack** (§3): Next.js (App Router, TypeScript) on Vercel; Tailwind CSS;
Supabase (Postgres, Auth, RLS, Realtime); browser Geolocation API for
check-in/out. No native maps SDK, no mobile app shell.

**Branding**: generic placeholder name/logo — no custom branding work in any
task above (§11 Q6 default).

**Deployment** (§9, not a development task but required before go-live):
Supabase project schema + RLS migration, "Confirm email" disabled in Supabase
Auth settings; Vercel project connected to this repo with
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` set.

**Pipeline** (§10): This task list is input to ArchitectUX next, who defines
the concrete Next.js project structure, Supabase client setup, and
route/auth-guard architecture referenced generically in Tasks 3 and 7 above.
Detailed file paths within each task should be finalized against that
architecture, not invented ahead of it.
