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
