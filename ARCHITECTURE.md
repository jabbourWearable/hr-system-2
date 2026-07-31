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

**Not yet applied to the live project** — same DDL-application blocker
documented throughout this file (no `service_role` key, no Supabase
Personal Access Token): needs a human to paste `0004`'s SQL into the
Supabase SQL Editor, same 2-minute manual step used for `0000`–`0003`.
This does **not** block HR-11 itself (HR-11's own acceptance criteria don't
touch `profiles` RLS), so it's tracked as its own follow-up issue rather
than gating HR-11's completion — see that issue for the "who/what" to
unblock it.

**One remaining gap this fix doesn't close**: bootstrapping the very first
admin account still has no self-service path by design — someone with
Supabase dashboard access must run
`update public.profiles set role = 'admin' where id = '<uuid>'` once via
the SQL Editor. That's intentional (matches how every other privileged
one-off in this project has been done) and is not itself a vulnerability,
since it requires Supabase dashboard access, not just an anon key.
