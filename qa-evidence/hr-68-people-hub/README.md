# HR-68 — People Hub (hibob-inspired features) — QA evidence

Four new features modelled on hibob.com's Core-HR + engagement layer, built on
the existing profiles schema and the Resend design language (DESIGN.md):

1. **Company Directory** (`/dashboard/directory`) — searchable people list with
   department filter; rich profile pages (`/dashboard/directory/[id]`).
2. **Org Chart** (`/dashboard/org`) — reporting hierarchy from `manager_id`.
3. **Kudos / Recognition** (`/dashboard/kudos`) — give peer shoutouts + a
   company recognition feed.
4. **Celebrations** — upcoming birthdays & work anniversaries, on the dashboard.

## Verification performed (2026-08-01)

- **Migration `0008_people_hub.sql`** applied to the live Supabase project
  (adds `profiles.{job_title,department,start_date,birthday,about}` + the
  `kudos` table with RLS). Existing 44 profiles seeded with demo HR data.
- **`npx tsc --noEmit`** → 0 errors. **`npx next build`** → success; all four
  new routes present in the route manifest.
- **Live RLS data-path check** signed in as a real user
  (`hr13.employee@example.com`): directory reads all 44 profiles; kudos feed
  reads; kudos insert-to-another-user succeeds; **self-kudos blocked** by the
  `kudos_no_self` constraint (SQLSTATE 23514); **giver-spoofing blocked** by the
  `kudos_insert_own` RLS policy (`giver_id = auth.uid()`).
- **Screenshots** (Playwright, dark canonical palette, logged in):
  - `01-dashboard.png` — People nav + Celebrations + Recent recognition widgets.
  - `02-directory.png` — searchable directory, department filter pills.
  - `03-profile.png` — profile page, empty-recognition state.
  - `03b-profile-with-kudos.png` — profile with manager/site links, About bio,
    and a populated Recognition card.
  - `04-org-chart.png` — reporting hierarchy with indented reports + counts.
  - `05-kudos.png` — give-kudos form + company recognition feed.

Verdict: **PASS** — features build, render, and enforce access control end-to-end.
