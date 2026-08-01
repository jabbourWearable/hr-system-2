# HR-72 — Production hardening & E2E regression verification (live)

**Target:** https://hr-system-2-iota.vercel.app (Vercel + Supabase, production)
**Date:** 2026-08-01
**Verdict:** ✅ PASS — one production regression found and fixed; full E2E green (25/25).

## Regression found & fixed

**Symptom:** The People Hub routes returned **404** for authenticated users on
live production:
- `/dashboard/directory` → 404
- `/dashboard/org` → 404
- `/dashboard/kudos` → 404

Evidence: `verdict.json` (read-only route sweep, 13/16 pass, 3× "this page could
not be found").

**Root cause:** The Vercel project is **not connected to Git** (deploys are
manual `vercel --prod` only). HR-68 (People Hub, commit `fe38d0b`) was merged to
`origin/main` at 15:38 but **no production deploy was run afterward**, so the
live build still predated HR-68 (last pre-fix prod deploy was ~4h earlier). The
code was correct and worked locally; it simply had never shipped to production.

**Fix:** Re-deployed the current `main` (HR-68) to Vercel production
(`vercel --prod`). New production deployment `hr-system-2-7ze9klhqs…` went Ready
at 16:39 and the production alias `hr-system-2-iota.vercel.app` now serves it.

## Post-fix full E2E (write flows + admin-as-admin) — 25/25 PASS

Run: `BASE_URL=https://hr-system-2-iota.vercel.app node e2e-full.js`
(seeded users; Playwright, dark mode, geolocation inside the HR-30 QA Site
geofence). Machine verdict: `e2e-full.json`.

| Flow | Result | Evidence |
|------|--------|----------|
| Employee login → dashboard | PASS | `v-01-employee-dashboard.png` |
| Geo **check-in** (mutation) | PASS — button → "Check Out" | `v-02-checked-in.png` |
| People Hub **directory** (was 404) | PASS — 44 people | `v-03-directory.png` |
| People Hub **profile** | PASS | `v-04-profile.png` |
| People Hub **org chart** (was 404) | PASS | `v-05-org.png` |
| People Hub **kudos** (was 404) | PASS | `v-06-kudos.png` |
| Attendance history | PASS | `v-07-attendance-history.png` |
| **Leave request submit** (mutation) | PASS — pending row | `v-08-leave-submitted.png` |
| Manager login → approvals | PASS | `v-09-approvals-before.png` |
| **Leave approval** (mutation) | PASS | `v-10-approvals-after.png` |
| Employee **approval notification** | PASS | `v-11-employee-notifications.png` |
| Admin dashboard (as admin) | PASS | `v-12-admin-dashboard.png` |
| Admin attendance | PASS | `v-13-admin-attendance.png` |
| Admin leave | PASS | `v-14-admin-leave.png` |
| Admin employees | PASS | `v-15-admin-employees.png` |
| Admin sites | PASS | `v-16-admin-sites.png` |

## Database-level confirmation of the write paths (live Supabase)

- **Check-in** persisted: `attendance` row today 13:41 UTC at geofence coords
  `32.0853, 34.7818`, shift open.
- **Leave approval** persisted: a request was approved today 13:42 by
  `hr13.manager@example.com` with the exact E2E comment
  "Approved — HR-72 verification".
- **Notification** created for the employee: "Your leave request for
  2026-08-10–2026-08-12 was approved." (unread).

## Test-data setup used

- Assigned `hr13.employee@example.com` to `HR-30 QA Site` (Tel Aviv geofence) so
  the geo check-in flow was exercisable.
- The manager's "Approve" click approved the first pending request in the list
  (several stale pending requests exist from prior QA runs), not the brand-new
  09-14 one — a data-ordering artifact, not a bug; the approval mutation +
  notification are proven fresh (reviewed today, my comment, notification fired).

## Follow-up (root-cause prevention)

Because Vercel is not git-connected, every merge to `main` needs a manual
`vercel --prod` or it silently fails to ship. A follow-up issue proposes
connecting Vercel's Git integration (or adding a mandatory post-merge deploy
step) so future features can't sit undeployed. See linked child issue.
