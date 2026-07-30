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

**Partially done as of 2026-07-31.** `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` were shared on this issue and are now in
`.env.local` (gitignored, not committed). Read-only checks against the
live project's REST/Auth endpoints (no writes made) found:

- The project (`xrbdqazyhbjmwhilfmkj`) is live and reachable.
- `sites`, `attendance`, `leave_requests`, `notifications` do **not**
  exist yet — our migration hasn't been run against this project.
- A `profiles` table **already exists**, but its columns match neither
  our HR schema (`employee_code`/`role`/`manager_id`/`site_id` all
  errored as unknown columns) nor a Supabase quickstart template. A
  `likes` table also exists (surfaced via a PostgREST "did you mean"
  hint). **This project has pre-existing schema unrelated to the HR
  system** — see "Blocker" below before running the migration here.
- `GET /auth/v1/settings` shows `"mailer_autoconfirm": false` — "Confirm
  email" is still **enabled** (not yet disabled).

Remaining steps once the project-identity question below is resolved:

1. ~~Create a Supabase project~~ — done, pending confirmation it's the
   right one (see Blocker).
2. Run the three migration files in `supabase/migrations/` in order,
   either by pasting them into the SQL Editor, or via
   `supabase link --project-ref <ref>` + `supabase db push` once the CLI
   is available and authenticated.
3. Authentication → Providers → Email: leave enabled, leave all other
   providers off. Authentication → Settings (or Providers → Email, "Confirm
   email"): **disable "Confirm email"** — mandatory per spec §2/§9, so a
   signed-up user can log in immediately with no verification link.
4. Project Settings → API: copy the `service_role` key into `.env.local`
   (URL/anon key already there) and all three vars into the Vercel
   project's environment variables for deployment.
5. Realtime: migration `0003_realtime.sql` already adds `notifications` to
   the `supabase_realtime` publication; no separate dashboard toggle
   should be needed, but verify under Database → Replication after running
   the migrations.

### Env vars (spec §9)

| Variable | Where it's used | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/{client,server,proxy}.ts`, `admin.ts` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/{client,server,proxy}.ts` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/admin.ts` only | **No — server-only** |

Set all three in Vercel (Project Settings → Environment Variables) before
deploying (HR-17). Vercel serves over HTTPS by default, which the
Geolocation API (HR-11's check-in/out) requires.

## Blocker: live Supabase provisioning

URL + anon key are now available (see checklist above), but two things
still block this issue's live acceptance criteria:

1. **Project identity needs confirming.** The project these credentials
   point to already contains a `profiles` table (wrong shape for our
   schema) and a `likes` table — i.e. pre-existing schema unrelated to
   the HR system. Running `0001_initial_schema.sql` as-is against it will
   fail on `CREATE TABLE profiles` ("relation already exists"), and nothing
   here should assume it's safe to drop tables that might hold someone
   else's real data. Needs a human answer: is this project dedicated to
   the HR system (and the existing tables are junk, safe to drop), or is
   it shared/other-purpose (in which case a fresh project is the fix)?
2. **No credential that can execute SQL or toggle Auth config.** The anon
   key can't run DDL or change project config. Once (1) is resolved, this
   doesn't require sharing more secrets — whoever has dashboard access can
   paste the three migration files into the SQL Editor (in order) and
   flip off Authentication → Providers → Email → "Confirm email"
   directly; no service_role key or DB password needs to change hands for
   that path. `service_role` is only needed later, for `.env.local`/Vercel
   (HR-13's admin-bypass insert, HR-17 deploy).

This blocks the *live* parts of this issue's acceptance criteria
("migration applied", "email confirmation disabled"); it does not block
HR-10 onward's *code* work, which only needs the three env vars to exist
locally once someone with Supabase access completes the checklist above.

Separately, `git push` to `origin` (github.com/jabbourWearable/hr-system-2)
still fails with 403 for this workspace's git credentials — a pre-existing,
already-tracked blocker (see prior comments on this project) that affects
eventual Vercel deployment (HR-17), not this issue's local work.

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
- No live Supabase project exists yet, so the guard pages
  (`/dashboard`, `/admin`) have not been exercised against a real session
  — that's covered by HR-10's evidence-collection QA once sign-up/login
  are wired up and a live project's env vars are available.
