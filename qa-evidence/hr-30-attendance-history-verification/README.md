# HR-30 — independent QA verification of HR-12 (attendance history views)

Independent pass against the live Supabase project (`xrbdqazyhbjmwhilfmkj`), using entirely
fresh fixtures created by this QA pass (not the implementer's `qa+hr12-*` accounts):
`hr30qa.admin@example.com`, `hr30qa.manager@example.com`, `hr30qa.empa@example.com` and
`hr30qa.empb@example.com` (both direct reports of the QA manager), and
`hr30qa.outsider@example.com` (role `employee`, `manager_id = null` — deliberately *not* a
report of the QA manager, to test RLS scoping with an account nobody else touched).

Fixtures were built via raw REST calls (Supabase Auth sign-up + a direct `POST
/rest/v1/profiles`), same still-open `profiles_insert_self` gap tracked separately as HR-24
(not re-reported here) used by every prior QA pass (HR-23/HR-27) — it's the only way to set
`role`/`manager_id` on a fixture without a service_role key. A site (`HR-30 QA Site`) and five
`attendance` rows (three for EmpA including one open shift, one for EmpB, one for Outsider)
were likewise inserted directly via REST across several dates, since simulating real
geolocation check-in/out for historical dates isn't practical — this only exercises the
history *views*, which is what HR-12 built; the check-in/check-out action itself was already
covered by HR-11/HR-23.

Verified live via Playwright (headless Chromium) driving the actual login form and pages:

1. `01` — EmpA's own `/dashboard/attendance`: exactly EmpA's 3 rows, newest first (7/31, 7/28,
   7/25), open shift renders as "—" for check-out, correct site name. No EmpB or Outsider rows.
2. `02` — Manager's `/dashboard/attendance/team`, unfiltered: exactly the 4 rows belonging to
   the manager's two direct reports (EmpA ×3, EmpB ×1), newest first. Outsider's row (not a
   report) is correctly absent even with no filter applied.
3. `03` — Employee filter set to EmpB: narrows to EmpB's 1 row only. Filter dropdown lists only
   the two direct reports (confirmed no "Outsider" option present).
4. `04` — Date filter From/To both `2026-07-25`: narrows to exactly EmpA's single row dated
   that day, confirming both bounds work (not just "from").
5. `05` — EmpA (plain employee) navigating directly to `/dashboard/attendance/team` is
   redirected to `/dashboard` (`requireRole('manager')`) — no team data shown.
6. `06` — Admin's `/admin/attendance`, unfiltered: shows every row company-wide, including
   Outsider's (absent from the manager's view in `02`) and leftover rows from prior QA passes
   (HR-11/HR-12/HR-23 fixtures) — confirms `attendance_admin_all`'s unrestricted scope, not an
   app-level filter mirroring the manager's.
7. `07` — Admin's employee filter set to Outsider: narrows to Outsider's 1 row — the dropdown
   here lists *all* employees (not just one manager's reports), matching spec.
8. `08` — The QA manager (non-admin) navigating directly to `/admin/attendance` is redirected
   to `/dashboard` (`requireRole('admin')`) — no company data shown.

**Verdict: PASS.** All three views scope correctly (own / direct-reports / company-wide), both
filters (employee dropdown, date range) narrow results correctly on both the manager and admin
pages, and both direct-URL redirect checks behave as specified.
