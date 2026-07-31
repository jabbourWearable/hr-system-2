# HR System — Technical Architecture & Foundation

Source: `project-specs/hr-system-setup.md` §3, §7, §8, §9 and
`project-tasks/hr-system-tasklist.md`. This is the ArchitectUX handoff for
the Developer agents implementing HR-10 through HR-15.

## Stack

- Next.js 16 (App Router, TypeScript), `src/` directory, React 19.
- Tailwind CSS v4 (CSS-first config — no `tailwind.config.ts`; tokens live
  in `src/app/globals.css`).
- Supabase (Postgres, Auth, Row Level Security, Realtime).
- `@supabase/ssr` for browser/server clients, `@supabase/supabase-js` for
  the service-role client.

**Next.js 16 breaking change to know about**: Middleware was renamed to
**Proxy**. The file is `src/proxy.ts` (not `middleware.ts`), exporting a
`proxy` function instead of `middleware`. Functionality is identical. See
`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
`next/headers`'s `cookies()` is async in this version
(`await cookies()`) — already accounted for in `src/lib/supabase/server.ts`.

## Project structure

```
src/
  app/
    layout.tsx          # root layout: theme script/toggle, header
    page.tsx             # public landing page (links to /login, /signup)
    globals.css          # design tokens, dark-mode variant, theme-toggle styles
    login/page.tsx        # placeholder UI — HR-10 wires up the server action
    signup/page.tsx       # placeholder UI — HR-10 wires up the server action
    dashboard/page.tsx    # requireUser() guard — reference implementation
    admin/page.tsx        # requireRole('admin') guard — reference implementation
  components/
    theme/                # light/dark/system theme toggle (see below)
  lib/
    supabase/
      client.ts           # browser client (Client Components)
      server.ts            # server client (Server Components/Actions/Route Handlers)
      admin.ts             # service-role client — bypasses RLS, server-only
      proxy.ts              # session-refresh + optimistic redirect, used by src/proxy.ts
    auth/
      session.ts            # DAL: getAuthenticatedUser / requireUser / requireRole
  proxy.ts                 # Next.js 16 Proxy entry point (was middleware.ts)
  types/
    database.ts             # hand-written Database type — regenerate once Supabase is live
supabase/
  migrations/
    0000_reset_legacy_dating_app_schema.sql  # drops the project's old (confirmed-retired) dating-app tables
    0001_initial_schema.sql  # profiles, sites, attendance, leave_requests, notifications
    0002_rls_policies.sql    # RLS policies + is_admin()/is_manager_of() helper functions
    0003_realtime.sql        # adds notifications to the supabase_realtime publication
    0004_fix_profiles_self_insert_privilege_escalation.sql  # closes a role self-escalation RLS gap (HR-11)
.env.local.example
```

## Auth-guard / role-gating pattern (`/dashboard` vs `/admin`)

Two layers, matching the Next.js team's own recommendation (see
`node_modules/next/dist/docs/01-app/02-guides/authentication.md`, "Optimistic
checks with Proxy" / "Creating a Data Access Layer"):

1. **`src/proxy.ts` → `src/lib/supabase/proxy.ts` (`updateSession`)** — runs
   on every request. Refreshes the Supabase session cookie and does a
   *cheap, optimistic* check: is there a session at all. No unauthenticated
   request reaches `/dashboard` or `/admin` (redirected to `/login`); no
   authenticated request can sit on `/login`/`/signup` (redirected to
   `/dashboard`). It deliberately does **not** check `profiles.role` —
   Proxy runs on every route including prefetches, so role checks belong
   closer to the data.

2. **`src/lib/auth/session.ts` (the DAL)** — `requireUser()` and
   `requireRole(role)` are called at the top of each page's Server
   Component. `requireRole('admin')` is what actually gates `/admin`; it
   queries `profiles.role` for the current `auth.uid()` (never trusts a
   client-supplied role) and `redirect()`s non-admins to `/dashboard`.

   `src/app/dashboard/page.tsx` and `src/app/admin/page.tsx` are reference
   implementations of this pattern using placeholder content.

**Important for future nested routes**: call `requireUser()` /
`requireRole()` again at the top of *each* page component you add under
`/dashboard/*` or `/admin/*` (e.g. `/admin/sites`, `/dashboard/leave`) —
do not rely on a shared `layout.tsx` to gate access. Next.js's Partial
Rendering means a layout shared across sibling routes does not necessarily
re-run its check on every client-side navigation between them; the
official Next.js auth guide calls this out explicitly. Page-level (or
nested Server Component) checks avoid that gap.

Route Handlers and Server Actions that mutate data need their own
`requireUser()`/`requireRole()` call too — the guard here only covers page
rendering, not actions.

## Data model & RLS

See `supabase/migrations/0001_initial_schema.sql` and
`0002_rls_policies.sql` for the full schema/policies with inline rationale
comments. Highlights:

- `profiles.employee_code` is nullable at the DB level — HR-10 decides
  whether to auto-generate it at sign-up or leave it for an admin to set
  later (task list Task 4 leaves this open; the schema doesn't force it).
- `sites.radius_meters` has **no default value** (spec §11 Q5) and a
  `check (radius_meters > 0)` — admins must always enter it explicitly.
- `profiles` and `sites` are readable by any authenticated user (an
  internal company directory: names, roles, manager/site assignment, site
  coordinates) but writable only by admins — see the RLS file for the
  full rationale, since §7's RLS paragraph only spells out
  `attendance`/`leave_requests` explicitly.
- `notifications` has no `INSERT` policy for regular users: the actor who
  triggers a notification (a manager/admin approving/rejecting leave,
  task list Task 17) is never its owner, so RLS can't authorize that
  cross-user insert. That write must go through `createAdminClient()`
  (service-role, bypasses RLS) inside the same server action that updates
  `leave_requests.status` — do the authorization check in that server
  action's code, not in RLS, for this one case.
- `is_admin()` / `is_manager_of(target_user_id)` are `security definer`
  SQL functions so admin/manager policies don't need a recursive
  subquery against `profiles` from within a `profiles` policy.

## Supabase project setup checklist

**Done as of 2026-07-31.** `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are in `.env.local` (gitignored, not
committed). The project owner ran migrations `0000`–`0003` through the
SQL Editor and disabled Confirm Email. Re-verified read-only against the
live project's REST/Auth endpoints:

- The project (`xrbdqazyhbjmwhilfmkj`) is live and reachable.
- `sites`, `attendance`, `leave_requests`, `notifications` all exist and
  are queryable (`200` from PostgREST).
- All six legacy dating-app tables (`profiles`'s old shape, `likes`,
  `matches`, `messages`, `blocks`, `reports`) are gone —
  `0000_reset_legacy_dating_app_schema.sql` ran; `profiles` now has our
  schema (`role`, `manager_id`, `site_id` columns query cleanly).
- `GET /auth/v1/settings` shows `"mailer_autoconfirm": true` — "Confirm
  email" is **disabled**, as required by spec §2/§9.

Remaining steps, in order:

1. ~~Create a Supabase project~~ — done.
2. ~~Confirm project identity~~ — done.
3. ~~Run migrations `0000`–`0003` in the SQL Editor~~ — done, verified above.
4. ~~Disable "Confirm email"~~ — done, verified above.
5. Project Settings → API: copy the `service_role` key into `.env.local`
   (URL/anon key already there) and all three vars into the Vercel
   project's environment variables for deployment. **Still outstanding** —
   not required for HR-9/HR-10, but needed before HR-13 (admin-side
   notification insert) and HR-17 (Vercel deploy).
6. Realtime: migration `0003_realtime.sql` already adds `notifications` to
   the `supabase_realtime` publication; no separate dashboard toggle
   should be needed, but worth a spot-check under Database → Replication
   whenever HR-14 (notifications) is implemented.

### Env vars (spec §9)

| Variable | Where it's used | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/{client,server,proxy}.ts`, `admin.ts` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/{client,server,proxy}.ts` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/admin.ts` only | **No — server-only** |

Set all three in Vercel (Project Settings → Environment Variables) before
deploying (HR-17). Vercel serves over HTTPS by default, which the
Geolocation API (HR-11's check-in/out) requires.

## Blocker: live Supabase provisioning — RESOLVED 2026-07-31

URL + anon key are available (see checklist above). Project identity was
confirmed (2026-07-31, this issue): the project is dedicated to the HR
system, and its pre-existing dating-app tables were junk, safe to drop.
The project owner ran migrations `0000`–`0003` via the SQL Editor and
disabled Confirm Email themselves (the manual, no-new-credential path).
Verified read-only via REST/Auth endpoints: all four new tables exist,
all six legacy tables are gone, `profiles` has the new column shape, and
`mailer_autoconfirm` is `true`. This issue's live acceptance criteria are
now fully met.

The only remaining item is the `service_role` key (still blank in
`.env.local`), needed for HR-13's admin-bypass notification insert and
HR-17's Vercel deploy — not required for HR-9 or HR-10.

Separately, `git push` to `origin` (github.com/jabbourWearable/hr-system-2)
previously 403'd for this workspace's git credentials; resolved by
switching the active `gh` account to `jabbourWearable`
(`gh auth switch --hostname github.com --user jabbourWearable &&
gh auth setup-git`). All commits through `a83560c` (including
`0000_reset_legacy_dating_app_schema.sql`) are pushed and visible on
`origin/main`.

## Blocker: Email provider disabled on the live Supabase project (HR-10)

**Status: blocking HR-10's live acceptance criteria as of 2026-07-31.**
Code is implemented and builds/lints clean (see "Verification done" below),
but no signup/login/logout can actually be exercised against the live
project right now.

`GET /auth/v1/settings` on the project shows:

```json
"external": { "email": false, ... },
"disable_signup": false,
"mailer_autoconfirm": true
```

`external.email: false` is a different toggle than `disable_signup` or
`mailer_autoconfirm` (both already correct, per the HR-9 checklist above).
It means the native email+password **auth provider itself** is switched
off for this project — not merely "confirm email" or "allow signups".
Confirmed directly against GoTrue:

- `supabase.auth.signUp()` → `422 email_provider_disabled`, `"Email
  signups are disabled"` (reproduced via the actual `/signup` form in a
  headless-browser run — screenshot shows the error rendered inline).
- `POST /auth/v1/token?grant_type=password` (a login attempt) → `422
  email_provider_disabled`, `"Email logins are disabled"`.

So both signup and login are dead end-to-end until this one project
setting changes. This is a dashboard/Management-API-level setting, not
something PostgREST, the anon key, or the (still-blank) service_role key
can touch — same category as the HR-9 "Confirm email" blocker above.

**Two ways to unblock, either works (same pattern as HR-9's blocker):**

1. *Manual (no secret changes hands):* whoever has Supabase dashboard
   access opens Authentication → Sign In / Providers → **Email**, and
   turns the provider **on** (distinct from the "Confirm email" sub-toggle
   already handled in HR-9). A few seconds.
2. *Agent-executed:* a Supabase **Personal Access Token** (Dashboard →
   Account → Access Tokens), then `PATCH
   https://api.supabase.com/v1/projects/{ref}/config/auth` with
   `{"external_email_enabled": true}`. Treat the token as sensitive
   (account-wide) — pass as an env var, don't commit it.

Once this is flipped, re-run the signup → dashboard → logout → login →
logout flow (headless-browser script used for this issue, not committed —
recreate from this description) to capture the Evidence Collector
screenshots and close out HR-10.

## Theming

Light/dark/system theme toggle, per ArchitectUX's standing foundation
requirement:

- `src/app/globals.css` defines tokens in `:root` (light) and
  `[data-theme="dark"]`, plus a `@custom-variant dark (...)` so Tailwind's
  `dark:` utilities key off `data-theme` rather than only OS preference.
- `src/components/theme/theme-toggle.tsx` (Client Component) — Light/Dark/
  System buttons, persists the choice to `localStorage`.
- `src/components/theme/theme-script.tsx` — inline script
  (`next/script`, `beforeInteractive`) that applies a stored preference
  before hydration, avoiding a flash of the wrong theme.
- Both are wired into `src/app/layout.tsx`'s header, so every route gets
  the toggle for free.

## Verification done for this issue

- `npm run build` passes (typecheck + lint + production build) against
  the scaffold, client helpers, guard pages, and theme system above.
- Guard redirects (`/dashboard`, `/admin` → `/login` when unauthenticated)
  were smoke-tested against a locally running dev server.
- Live Supabase project verified read-only (anon key, no writes): `sites`,
  `attendance`, `leave_requests`, `notifications` all return `200`; the
  six legacy dating-app tables (`likes`, `matches`, `messages`, `blocks`,
  `reports`, old `profiles` shape) are gone; `profiles` now has
  `role`/`manager_id`/`site_id`; `GET /auth/v1/settings` confirms
  `mailer_autoconfirm: true`.
- Not yet exercised: an actual signed-up user hitting `/dashboard`/`/admin`
  with a real session (no sign-up/login server action exists yet — that's
  HR-10's job, plus its own evidence-collection QA once wired up).

## Verification done for HR-10 (auth + employee profiles)

- Implemented: `src/app/signup/actions.ts` (`signUp()` + insert into
  `profiles`), `src/app/login/actions.ts` (`signInWithPassword()`),
  `src/lib/auth/actions.ts` (`logout()` → `signOut()` + redirect),
  wired to real `useActionState`-backed forms
  (`src/app/signup/signup-form.tsx`, `src/app/login/login-form.tsx`) and
  a shared `LogoutButton` (`src/components/auth/logout-button.tsx`) added
  to `/dashboard` and `/admin`. `src/lib/auth/session.ts` now also
  surfaces `employeeCode` so the dashboard can render the full profile
  record (role, employee code, manager, site — nullable fields shown as
  "Not assigned yet").
- `npm run build` and `npm run lint` both pass.
- Headless-browser (Playwright against the local dev server) run
  confirmed: `/` → `/signup` and `/` → `/login` render correctly;
  `/dashboard` and `/admin` still redirect unauthenticated visitors to
  `/login` (guard behavior unaffected by the new logout button); the
  signup form correctly surfaces a server-side error inline
  (`role="alert"`) when `signUp()` fails.
- **Not exercised, blocked**: the actual signup → logged-in-dashboard →
  logout → login → logout round trip, and the "profiles row created with
  role='employee'" acceptance criterion. See the blocker section above —
  the live project rejects all email/password auth right now
  (`email_provider_disabled`), independent of this code.

## Work sites + geo-attendance (HR-11)

Implements task list Tasks 9–11 (work site CRUD, check-in, check-out).
No new tables — `sites`/`attendance` already existed from
`0001_initial_schema.sql`, and their RLS policies (`sites_write_admin`,
`attendance_insert_own`/`attendance_update_own`) already covered this
feature; only application code was added.

- `src/lib/geo/haversine.ts` — pure haversine distance function (meters),
  shared by check-in and check-out.
- `src/app/dashboard/attendance-actions.ts` — `checkIn`/`checkOut` Server
  Actions. Distance/radius validation runs here (server-side, using the
  request's own RLS-scoped client — not the admin client), so it can't be
  bypassed by editing client code, per task list Task 10's explicit
  requirement. `checkOut` validates against the site the employee actually
  checked into (`attendance.site_id` on the open record), not their
  *current* `profiles.site_id`, so an admin reassigning someone's site
  mid-shift can't strand an open check-in.
- `src/app/dashboard/check-in-out.tsx` — Client Component. Calls
  `navigator.geolocation.getCurrentPosition`, then invokes the Server
  Action directly (not bound to a `<form>`) inside `startTransition`, per
  the Next.js Server Actions guide's "event handler ... wrapped in
  startTransition" pattern — geolocation must resolve asynchronously
  before the action can be called, which a plain form submission can't
  express.
- `src/app/admin/sites/` — `page.tsx` (list + create), `[id]/edit/page.tsx`
  (edit), `actions.ts` (`createSite`/`updateSite`/`deleteSite`),
  `site-form.tsx` (shared form, `defaultValues` omitted on create so
  `radius_meters` has no pre-filled value — spec §11 Q5), all gated by
  `requireRole('admin')`. Delete catches Postgres `23503`
  (foreign_key_violation) — `attendance.site_id` is `on delete restrict` —
  and shows a clear "reassign or remove those records first" message
  instead of a raw 500; `profiles.site_id` is `on delete set null`, so an
  employee's site assignment silently clears on site delete rather than
  erroring (accepted behavior, documented in the migration's own comments).

**Verification**: `npm run build`/`lint` clean. Full live end-to-end pass
against the real Supabase project (Playwright, headless Chromium, geolocation
mocked via `browserContext.setGeolocation`/the `geolocation` context option):
admin creates a site through `/admin/sites`, an employee is assigned to it
(via a direct admin-token REST call — the actual UI for this is Task 19/
HR-15, not yet built), then as that employee: check-in from ~13.4km away is
rejected with the exact distance/radius in the error and creates no row;
check-in from the site's own coordinates succeeds and flips the button to
"Check Out"; deleting a site with an attendance row against it is blocked
with the friendly FK message instead of a 500; deleting an unused site
succeeds. Screenshots in `qa-evidence/hr-11-geo-attendance/`. Left in the
live project as durable fixtures (consistent with HR-10 QA leaving its own
`QA Test User` behind): one test admin account, one test employee assigned
to `HR-11 QA Site`, and that site's one attendance row (needed for the
delete-blocked screenshot to make sense).

## Security note: profiles self-insert role escalation — found + fixed during HR-11

While creating a test admin account for HR-11's own QA (no `service_role`
key or SQL Editor access available, same as every prior blocker in this
file), discovered that `0002_rls_policies.sql`'s `profiles_insert_self`
policy only checks `id = auth.uid()` — it does not restrict `role`. Any
authenticated user (i.e. anyone who has ever signed up, using nothing but
the public anon key) can `POST /rest/v1/profiles` with `role: "admin"` for
their own row and grant themselves full admin access, bypassing the app's
own `/signup` action (which never sends `role`) entirely. Confirmed by
reproducing it directly against the live project.

**Fix**: `supabase/migrations/0004_fix_profiles_self_insert_privilege_escalation.sql`
tightens the policy to `with check (id = auth.uid() and role = 'employee')`
— a self-insert can only ever create an `employee` row; `role` defaults to
`'employee'` at the column level so the app's existing signup insert (which
never sets `role`) is unaffected. Promoting someone to `manager`/`admin`
still only happens via `profiles_update_admin`, i.e. an existing admin
using the Task 19/HR-15 admin UI.

**Applied and verified live 2026-07-31** (HR-24) — a human pasted `0004`'s
SQL into the Supabase SQL Editor. Confirmed directly rather than trusting
the report: signed up a fresh throwaway account and re-ran the exact
exploit (`POST /rest/v1/profiles` with `role: "admin"`, anon key + that
account's own session) — now correctly rejected with `403 42501 new row
violates row-level security policy for table "profiles"`. Also confirmed
the legitimate path is unaffected: the same account's self-insert with no
`role` field (matching the app's real `/signup` action) still succeeds
(`201`, defaults to `role: "employee"`).

**One remaining gap this fix doesn't close**: bootstrapping the very first
admin account still has no self-service path by design — someone with
Supabase dashboard access must run
`update public.profiles set role = 'admin' where id = '<uuid>'` once via
the SQL Editor. That's intentional (matches how every other privileged
one-off in this project has been done) and is not itself a vulnerability,
since it requires Supabase dashboard access, not just an anon key.

## Leave request + approval workflow (HR-13)

Implements spec §5 items 6-7 (employee leave requests, manager/admin
approval). No new tables — `leave_requests` already existed from
`0001_initial_schema.sql` and its RLS policies (`leave_requests_insert_own`,
`leave_requests_select_own`, `leave_requests_select_manager`,
`leave_requests_update_manager`, `leave_requests_admin_all`, all in
`0002_rls_policies.sql`) already covered every access pattern this feature
needs — only one schema change and application code were added.

- `supabase/migrations/0005_add_leave_requests_review_comment.sql` — adds
  `leave_requests.review_comment` (nullable text). Neither the spec's §7
  data-model sketch nor the original schema had a column for this, but
  HR-13's acceptance criteria explicitly require approving/rejecting "with
  an optional comment". No RLS changes needed — the existing update
  policies already permit updating any column on rows a manager/admin is
  authorized to touch.
- `src/lib/leave/review.ts` — `applyLeaveDecision()`, shared by the manager
  and admin review Server Actions. Uses `.eq("status", "pending")` plus
  `.select().maybeSingle()` so a stale page re-submitting a decision, or a
  manager trying to touch a non-report's request, comes back as a clean
  "not pending / not authorized" error instead of a silent no-op — RLS
  returns zero matched rows rather than throwing.
- `src/lib/leave/requester-profiles.ts` — fetches requester profiles by id
  list and returns a `Map`, rather than a PostgREST embedded select
  (`leave_requests(...profiles(full_name))`). The hand-written `Database`
  type has no FK relationship metadata (`Relationships: []` everywhere), so
  embedded-select typing isn't reliable here; a second simple query
  (already the pattern in `src/app/dashboard/page.tsx`) sidesteps that.
- `src/app/dashboard/leave/` — employee-facing page: `LeaveRequestForm`
  (date range, type, reason) + own request list with a status badge and
  reviewer comment column.
- `src/app/dashboard/leave/approvals/` — manager-only (`requireRole
  ('manager')`) pending list, scoped to direct reports purely by RLS (no
  extra `manager_id` filter needed in the query).
- `src/app/admin/leave/` — admin-only (`requireRole('admin')`), same UI
  pattern but company-wide (RLS's `leave_requests_admin_all` removes the
  manager scoping). Spec §8 groups "leave approvals" under `/admin`
  generally, but HR-13's own acceptance criteria call out admin
  approve/reject explicitly, so a minimal version shipped here rather than
  deferring the whole capability to HR-15 (admin dashboard).
- `src/components/leave/review-form.tsx` — one `<form>`, two submit buttons
  (`name="decision" value="approved"` / `"rejected"`) sharing one comment
  textarea; native HTML only includes the clicked button's name/value pair
  in the submitted FormData, so one bound Server Action tells the two
  decisions apart without extra client state.

**Verification**: `npm run build`/`lint` clean. Full live end-to-end pass
against the real Supabase project (Playwright, headless Chromium): created
three fixture accounts (admin/manager/employee, the employee's
`manager_id` pointing at the manager — set up the same way HR-11's QA
built its fixtures, via the still-open `profiles_insert_self` role gap
from the "Security note" above, since `0004` isn't live yet either).
Confirmed live: employee submits a leave request → appears with a
"Pending" badge on their own page; manager's `/dashboard/leave/approvals`
shows only that employee's pending requests (RLS-scoped, not
application-filtered); manager approves one → it disappears from the
manager's pending list and the employee's own page shows "Approved";
admin's `/admin/leave` shows every pending request company-wide, not just
their own reports'; admin rejects one → same disappearance/status-update
behavor, `reviewed_by` correctly set to the admin's id regardless of
`manager_id`. Screenshots in `qa-evidence/hr-13-leave-workflow/`.

**Blocker: `review_comment` column not live yet.** Migration `0005` (like
`0004` before it) needs the same DDL access this whole project has lacked
since the HR-9 saga — no `SUPABASE_SERVICE_ROLE_KEY`, no Supabase Personal
Access Token, no `supabase` CLI session in this workspace. Unlike `0004`
(a security fix that didn't block HR-11's own acceptance criteria), this
column is load-bearing for HR-13's approve/reject-with-comment
requirement: every read of `leave_requests` in the new pages selects
`review_comment` and every review action's `update()` sets it, so **until
`0005` is applied, submitting a comment on an approve/reject — or even
just loading `/dashboard/leave`, `/dashboard/leave/approvals`, or
`/admin/leave` — will fail with Postgres `42703 column
"review_comment" does not exist`.**

The live verification above happened via a temporary local patch (comment
field stripped from the select/update calls, reverted immediately after
capturing evidence) to confirm the rest of the workflow — submission,
RLS-scoped visibility, approve/reject, status propagation back to the
employee — genuinely works end-to-end; that patch is not in the committed
code. The shipped code targets the real final schema and needed `0005` run
before it works live.

**`0005` applied and verified live 2026-07-31** (confirmed independently
while verifying HR-24's `0004`, same SQL Editor trip): `GET
/rest/v1/leave_requests?select=id,review_comment&limit=1` now returns
`200 []` instead of `42703`. The comment-field acceptance criterion (not
yet covered by HR-27's earlier PASS, which ran before `0005` was live) is
still unexercised end-to-end against the committed code — worth a follow-up
pass by whoever owns HR-13 next, but the schema blocker itself is gone.

**Comment-field acceptance criterion verified live 2026-07-31**, closing the
one gap HR-27 flagged. Reused the durable `hr13.admin@example.com` /
`hr13.manager@example.com` / `hr13.employee@example.com` fixtures (still
had their roles from before `0004` closed self-escalation, so no new SQL
bootstrap was needed). Ran a full Playwright pass against the real,
unpatched committed code (no local patch this time — the column genuinely
exists now): employee submits two requests; manager approves one with a
comment ("Approved - team coverage confirmed for these dates.") — the
employee's own page renders that exact text in the "Reviewer comment"
column; admin rejects the other, company-wide, with its own comment
("Rejected - conflicts with quarter-end close.") — same result. Screenshots
in `qa-evidence/hr-13-review-comment-verification/`. Combined with HR-27's
earlier independent PASS on every other acceptance-criterion fragment, all
of HR-13's acceptance criteria are now verified live against the real
schema.

## Attendance history views (HR-12)

Implements spec §5 item 5 / §5.9 (employee sees own check-in/out log,
manager sees direct reports, admin sees company-wide). No schema or RLS
changes — `attendance_select_own`, `attendance_select_manager`, and
`attendance_admin_all` (all already in `0002_rls_policies.sql`, added
ahead of time for HR-11's task list Task 13) already cover every access
pattern this feature needs. Only application code was added.

- `src/app/dashboard/attendance/page.tsx` — any authenticated user's own
  history (task list Task 12): date, check-in time, check-out time (or
  "—" for an open shift), site name, newest first.
- `src/app/dashboard/attendance/team/page.tsx` — manager-only
  (`requireRole('manager')`) view of direct reports' history, plus
  `src/app/admin/attendance/page.tsx` — admin-only, company-wide
  equivalent (task list Task 13). Both add an employee dropdown + date
  range as narrowing filters on top of the RLS-scoped base query (a
  manager can only ever narrow *down* from their own reports, never
  widen access) — filter state lives entirely in the URL query string via
  a plain `method="get"` form (`src/components/attendance/
  attendance-filters.tsx`, shared between the two pages since they're
  identical except for `action` and the employee list), so no client JS
  is needed.
- `src/lib/attendance/employee-profiles.ts`, `site-names.ts` — id → name
  lookups by id list, same two-query-instead-of-embedded-select pattern
  as `src/lib/leave/requester-profiles.ts` (kept as attendance's own copy
  rather than importing across features, since the two are independent
  and happen to need the same small query shape).
- `src/lib/attendance/date-range.ts` — `nextDayExclusive()`. A "to" date
  filter needs to include the whole day, but `check_in_at` is a
  `timestamptz`; comparing it against the bare date string would only
  match midnight, so `to` is converted to the exclusive start of the
  following day (`.lt("check_in_at", nextDayExclusive(to))`) instead.

**Verification**: `npm run build`/`lint` clean. Full live end-to-end pass
against the real Supabase project (Playwright, headless Chromium): built
five fixture accounts (admin, manager, two of the manager's direct
reports, one unmanaged employee — same still-open `profiles_insert_self`
role gap used for HR-11/HR-13's fixtures, since `0004` isn't live yet)
and inserted `attendance` rows directly via REST across several dates,
including one open (no `check_out_at`) shift. Confirmed live: the
employee's own page shows only their 3 rows with the open shift rendered
as "—"; the manager's team page shows exactly their 2 reports' 4 rows and
excludes the unmanaged employee, and its employee filter dropdown lists
only direct reports; selecting one employee narrows the table to just
their rows; the manager is redirected away from `/admin/attendance`
(`requireRole('admin')`) and a plain employee is redirected away from
both `/dashboard/attendance/team` and `/admin/attendance`; the admin's
company page shows every row including the unmanaged employee and
pre-existing rows left over from HR-11/HR-23's own QA fixtures; a date
range narrowed to "today" returned exactly the 3 rows actually dated
today (verified independently via a direct REST query first, since the
project already had two same-day leftover rows from prior QA). Screenshots
in `qa-evidence/hr-12-attendance-history/`.

## Admin dashboard (HR-15)

Implements spec §5 item 9 / §5.9 (task list Tasks 19-20): employee account
management (role/manager/site assignment) and a company-wide overview.
`profiles_update_admin` (0002_rls_policies.sql) already covers the write
this feature needs — no new RLS. One new schema gap (see below).

- `src/app/admin/page.tsx` — turned from a plain nav page into the overview
  (Task 20): total headcount, checked-in-today count, currently-checked-in
  (open shifts) count, pending leave requests count, and site count —
  plain `count: "exact", head: true` rollups, no payroll/hours-worked/shift
  calculations (§6, explicitly out of scope) — plus links into every
  detailed admin view (employees, sites, attendance, leave).
- `src/app/admin/employees/` — `page.tsx` (list: name, email, employee
  code, role, manager, site), `[id]/edit/page.tsx` + `actions.ts`
  (`updateEmployeeProfile`), `employee-form.tsx` (role/manager/site
  selects, same `useActionState` shape as `SiteForm`/`ReviewForm`).
  `managerId`/`siteId` are optional ("Unassigned"); a profile can't be set
  as its own manager (rejected server-side, and excluded from the
  dropdown's own options).
- `supabase/migrations/0007_add_profiles_email.sql` — adds
  `profiles.email` (nullable). Neither the spec's §7 sketch nor
  `0001_initial_schema.sql` has an email column on `profiles` (it lives on
  `auth.users` only), but Task 19's acceptance criteria explicitly require
  showing it in the employee list — same category of gap as HR-13's
  `review_comment` (0005). No `SUPABASE_SERVICE_ROLE_KEY` is available to
  read `auth.users` from application code, so this is handled entirely at
  the database layer instead: the migration backfills existing rows via a
  direct SQL join (the SQL Editor runs as the database owner, no
  service_role/anon key needed) and adds a `before insert` trigger
  (`sync_profile_email()`, security definer) that copies
  `auth.users.email` into the new row for every future sign-up.
  **Deliberately does not touch `src/app/signup/actions.ts`** (HR-10,
  already live and QA-verified) — coupling that Server Action's `profiles`
  insert to an `email` column would break real sign-ups for however long
  this migration takes to actually land in the SQL Editor (the same
  DDL-access gap that stalled `0004`/`0005` for hours; see the Supabase
  blocker history above). The trigger works regardless of what columns the
  application's own insert sets.

**Blocker: `0007` not live yet**, same recurring DDL-access gap as every
prior migration in this project (no `SUPABASE_SERVICE_ROLE_KEY`, PAT, or
CLI session in this workspace). Confirmed directly: `GET
{url}/rest/v1/profiles?select=id,email&limit=1` returns `400 42703 column
profiles.email does not exist`. Until it's applied, `/admin/employees` and
its edit page (both select `email`) fail the same all-or-nothing way
`leave_requests.review_comment` did before `0005` landed — this is scoped
to those two pages only; nothing else in `profiles` selects `email`.

**Verification**: `npm run build`/`lint` clean. Full live end-to-end pass
against the real Supabase project (Playwright, headless Chromium) using
the durable `hr13.admin@example.com` admin fixture (still holds its role
from before `0004` closed self-escalation — same reuse pattern as HR-13's
own final QA pass) plus two fresh throwaway fixtures
(`hr15qa.employee1@example.com`, `hr15qa.manager1@example.com`). Since
`0007` isn't live yet, the `email` select/render was temporarily stripped
from both pages for this pass only and reverted immediately after
capturing evidence — the committed code targets the real final schema.
Confirmed live: `/admin` overview renders correct non-zero counts across
headcount/checked-in-today/currently-checked-in/pending-leave/sites;
`/admin/employees` lists every profile (25 total, including every prior
feature's leftover QA fixtures) with correctly resolved manager/site
names; promoting `hr15qa.manager1` from employee → manager via the edit
form persists and is reflected both in the list and on that user's own
`/dashboard` profile view; assigning `hr15qa.employee1` a manager
(`hr15qa.manager1`) and a site persists and resolves correctly in the
list; the manager-dropdown correctly excludes a profile from being its own
manager; a manager and a plain employee are both redirected away from
`/admin` and `/admin/employees` to `/dashboard`. Screenshots in
`qa-evidence/hr-15-admin-dashboard/`.

## In-app real-time notifications (HR-14)

Implements spec §5 item 8: a notification list on `/dashboard`, created
when a leave request's status changes and updated live via Supabase
Realtime — the explicit MVP replacement for the reference app's push
notifications (§6 excludes FCM/APNs entirely).

- `src/lib/leave/review.ts` (`applyLeaveDecision`) — after the
  `leave_requests` status update commits, inserts one `notifications` row
  for the request's `user_id` (`Your leave request for {start}–{end} was
  {approved|rejected}.`). The `status = 'pending'` guard already used for
  the update doubles as the "no notification on a pending→pending no-op"
  rule — this function only ever runs on a real transition. The insert is
  best-effort: a failure there doesn't turn an already-successful review
  into an error response.
- `src/app/dashboard/notifications-list.tsx` (Client Component) +
  `notifications-actions.ts` (`markNotificationRead`) — renders the
  caller's own notifications (newest first, unread bolded) and subscribes
  to `postgres_changes` INSERT events on `notifications` filtered to
  `user_id=eq.<self>`; a new row appends to the top of the list with no
  page reload. Clicking "Mark read" calls the Server Action, which relies
  on `notifications_update_own` (0002) the same way `attendance-actions.ts`
  relies on `attendance_update_own`.
- `supabase/migrations/0006_notifications_insert_reviewer.sql` — adds an
  INSERT policy so a manager (for their own direct reports, `is_manager_of`)
  or admin (`is_admin`) can write a notification using their own
  authenticated session. 0002's original design left this insert to a
  service-role client instead (see that file's "notifications" section
  comment) — but `SUPABASE_SERVICE_ROLE_KEY` has been empty in
  `.env.local` since the HR-9 saga and shows no sign of arriving, so this
  feature's core acceptance criterion would otherwise depend indefinitely
  on a credential the project has never obtained. The new policy mirrors
  the authority a reviewer already has via
  `leave_requests_update_manager`/`leave_requests_admin_all` — a manager
  can already change a direct report's leave status, so letting them write
  that same status change's notification is the same trust boundary, not
  a new one. `notifications_admin_all` (already live) already covered the
  admin case without this migration; `0006` only adds the manager path.

**Real Realtime bug found and fixed during live QA** (not an infra
blocker — a genuine application bug): the browser Supabase client
(`createBrowserClient`, `@supabase/ssr`) hydrates the session from cookies
asynchronously. Calling `.channel(...).subscribe()` immediately on mount
(before that hydration resolves and supabase-js's internal
`onAuthStateChange` listener calls `realtime.setAuth()`) joins the
Realtime channel with no JWT — confirmed directly by capturing the
websocket frames: the `phx_join` payload had no `access_token` field, and
a REST-inserted row was never delivered even after 40+ seconds, despite
the server confirming `"Subscribed to PostgreSQL"` (that ack doesn't
validate RLS — only per-row delivery does, and with no JWT the connection
evaluates `notifications_select_own`'s `auth.uid()` as null, so no row
ever matches). Fixed in `notifications-list.tsx` by awaiting
`supabase.auth.getSession()` and calling `supabase.realtime.setAuth(session
.access_token)` before `.subscribe()`. Re-captured the same websocket
frames after the fix: `access_token` present in the join payload, and a
REST-inserted row arrived as a `postgres_changes` event in well under a
second. Any future Realtime feature in this codebase should follow the
same await-session-then-setAuth-then-subscribe order — subscribing first
looks like it works (no error, "Subscribed" ack) but silently drops every
event.

**Blocker: `0006` not live yet**, same recurring DDL-access gap as every
prior migration (no `SUPABASE_SERVICE_ROLE_KEY`, PAT, or CLI session in
this workspace). Confirmed directly: a manager session (`hr13.manager
@example.com`, still holds its role from before `0004` closed
self-escalation) attempting `POST .../rest/v1/notifications` for one of
their direct reports gets `403 42501` (RLS violation). Until `0006` lands,
approving/rejecting as a **manager** changes the request's status
correctly but does not create a notification; approving/rejecting as an
**admin** already works today without `0006`, since `notifications_admin_all`
(0002) already grants admins insert regardless of target user.

**Verification**: `npm run build`/`lint` clean. Full live end-to-end pass
against the real Supabase project (Playwright, headless Chromium) reusing
the `hr13.*@example.com` fixtures (employee/manager/admin, still hold
their roles). Employee submitted two pending requests and left `/dashboard`
open with no further navigation; admin approved one via `/admin/leave` —
the notification appeared on the employee's already-open dashboard within
seconds with no reload, and "Mark read" correctly cleared it; manager
rejected the other via `/dashboard/leave/approvals` — status changed
correctly but (as expected, `0006` not live) no notification appeared, and
no false positive was recorded either. Screenshots in
`qa-evidence/hr-14-notifications/`.
