# HR-75 — Production hardening & full E2E regression sweep

**Agent:** EvidenceQA (Evidence Collector) · **Target:** https://hr-system-2-iota.vercel.app (LIVE prod) · **Date:** 2026-08-01

Independent, screenshot-backed verification of the live Vercel+Supabase deploy. Every
result below was confirmed by looking at the actual full-page screenshots — not by
trusting a green log. Harness: `e2e.js` (→ `e2e.json`, `run-meta.json`).

## Deploy freshness (the HR-72 regression class)
- `GET /api/version` = `05746b41…` = **exact HEAD** at sweep start, deployed 14:01:45Z.
  No stale-deploy regression this cycle — the HR-73 deploy guard is holding. (HR-72's
  bug was a merged-but-never-deployed feature; that did **not** recur.)

## Automated E2E: 32/32 PASS (`e2e.json`)
Covers **more** than the HR-72 harness — adds a real sign-up flow, the full
check-in→check-out cycle, and a rigorous live-realtime notification test.

| Area | Evidence | Result |
|---|---|---|
| **Sign-up** (new throwaway user → `/dashboard`, auth+profile+session) | 01, 02 | PASS |
| Auth / login (employee, manager, admin) | 03, 13, 18 | PASS |
| Geo **check-in → check-out** cycle (HR-30 QA Site geofence) | 04, 05, 10 | PASS |
| People Hub — directory (45 people*), profile, org chart, kudos | 06, 07, 08, 09 | PASS |
| Attendance history (both check-in & check-out rows persisted) | 10 | PASS |
| Leave request submit (employee) | 11 | PASS |
| Leave approval (manager approves the exact request) | 14, 15 | PASS |
| **Real-time notification** — delivered live to the employee's OPEN dashboard, **no reload** (Supabase Realtime), then mark-read | 12→16→17 | PASS |
| Admin dashboard / attendance / leave / employees / sites | 18–22 | PASS |

\* Directory briefly showed 45 (44 + the throwaway sign-up user); cleaned back to 44 post-run.

### Strongest single piece of evidence
`16-notif-live.png`: the employee dashboard was parked on `/dashboard` **before** the
manager approved. On approval (separate browser context) the notification count went
**5 → 6** and the top row became *"Your leave request for 2026-10-05–2026-10-07 was
approved."* — with **no page reload**. `17-notif-marked-read.png` shows it drop back to
**5** and render read after Mark-read. This is genuine proof Realtime works in prod.

## Defect found AND fixed (production hardening — in scope, no new scope)
**Raw manager UUID leaking into the employee dashboard.** The Profile card rendered
`Manager: 275de9bd-0941-411d-b121-b878eb010910` (monospace UUID) instead of the
manager's name — while the admin employees table (`21`) and the org chart (`08`) both
resolve names correctly, proving the join exists. Root cause:
`src/app/dashboard/page.tsx:75` printed `user.managerId` verbatim.

**Fix:** resolve the id via the `nameById` profiles map **already loaded on the page**
(zero extra query) → now shows the manager's name; `mono` dropped since it's a name.
Verified live post-deploy in `23-fix-manager-name.png`.

## Data-hygiene note (not a bug, not fixed)
The manager approvals queue is accumulating stale **pending** leave requests from prior
test runs (HR-13/HR-14/HR-72 markers, `14-approvals-before.png`). Functionally correct
(RLS scoping works); just test-data clutter. Left as-is — not created by this run and
out of scope to prune.

## Verdict
**PASS with one fix shipped.** Live prod is healthy across every feature in the HR-75
scope; the one visible defect found was fixed, redeployed, and re-verified live.
