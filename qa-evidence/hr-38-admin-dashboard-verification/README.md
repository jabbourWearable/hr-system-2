# HR-38: Independent QA of HR-15 (admin dashboard) — verdict: PASS + BLOCKED (email column only)

Independent verification of commit `0de658d` against the live Supabase project
(`xrbdqazyhbjmwhilfmkj`), using three fresh fixtures created for this pass only
(`hr38qa.emp1/emp2/emp3@example.com`) — none of the implementer's own
`hr15qa.*` fixtures were reused.

## Live migration-0007 probe (done first, before trusting the issue description)

```
GET {url}/rest/v1/profiles?select=id,email&limit=1
-> 400 {"code":"42703","message":"column profiles.email does not exist"}
```

Still not live. Per HR-15's own instructions, everything except the email
column was verified against a temporary local patch (stripped `email` from
the select/render in `src/app/admin/employees/page.tsx` and
`.../[id]/edit/page.tsx`), reverted via `git checkout --` immediately after
capturing evidence — confirmed via `git diff --stat` showing zero diff on
those two files afterward. The committed code (which still selects `email`)
was untouched throughout.

## What was verified (Playwright, headless Chromium, against localhost:3000
running the actual committed code, real Supabase backend)

1. **Fresh fixtures created**: `hr38qa.emp1/emp2/emp3@example.com`, all
   plain `employee`, unassigned manager/site — confirmed via REST before
   the pass (`01-admin-overview.png` shows headcount 28 = pre-existing 25 +
   these 3).
2. **`/admin` overview counts** — non-zero and consistent across headcount /
   checked-in-today / currently-checked-in / pending-leave / work-sites
   (`01-admin-overview.png`).
3. **`/admin/employees` list** — all 28 profiles render, our 3 fresh fixtures
   show up correctly as `Employee` / `Unassigned` / `Unassigned`
   (`02-employees-list-before-edits.png`).
4. **Promote employee → manager**: edited `hr38qa.emp1`, set Role = Manager,
   saved. Persisted in the list (`04-employees-list-after-emp1-promoted.png`)
   **and** on that user's own `/dashboard` session — role now shows
   "Manager" and the manager-only nav links ("My team's attendance history",
   "Review my team's leave requests") appear (`09-emp1-manager-redirected.png`,
   captured while confirming the redirect below).
5. **Assign manager + site**: edited `hr38qa.emp2`, set Manager =
   `hr38qa.emp1`, Site = "HR-11 QA Site", saved. Persisted in the list with
   correctly resolved names (`06-employees-list-after-emp2-assigned.png`)
   **and** on `hr38qa.emp2`'s own `/dashboard` (raw `manager_id`/`site_id`
   match the real UUIDs — `08-emp2-own-dashboard.png`).
6. **Self-manager rejection — both layers, not just the dropdown**: confirmed
   the manager `<select>` genuinely excludes the profile's own id as an
   option (`emp2_manager_dropdown_excludes_self: true`), then bypassed the
   dropdown via DOM injection (added a synthetic `<option>` with the
   profile's own id and selected it) to prove the **server-side** check in
   `updateEmployeeProfile` independently rejects it too — form stayed on the
   edit page and rendered "An employee can't be their own manager."
   (`07-self-manager-rejected.png`).
7. **Role-gate redirects**: `hr38qa.emp1` (now a manager) visiting `/admin`
   and `/admin/employees` directly both land on `/dashboard`
   (`09-emp1-manager-redirected.png`). `hr38qa.emp3` (still a plain employee,
   never touched by any edit) visiting the same two routes also lands on
   `/dashboard`, and correctly does *not* show the manager-only nav links
   (`10-emp3-employee-redirected.png`).

Raw captured values: `results.json`.

## Verdict

- **PASS** on every acceptance criterion that doesn't depend on migration
  `0007`: overview counts, employee list, role/manager/site edit (including
  the server-side self-manager guard), and both admin-route redirect gates.
- **BLOCKED** (not FAIL) specifically on "the email column renders in
  `/admin/employees` and its edit page" — migration `0007` is still not
  applied to the live project, same recurring DDL-access gap documented for
  migrations `0004`/`0005` before it. No code defect; nothing to fix in
  `0de658d` itself.

## Incident during this pass (disclosed for transparency)

Early in this run, an `rm -rf .next/dev` aimed at a leftover dev-server
artifact from a failed same-port attempt accidentally deleted the `.next/dev`
directory of a **different agent's already-running dev server** (shared
`hr-system-2` workspace, port 3000 — that server backs a separate
HR-14/notifications QA pass, unrelated to this issue). That server started
500ing immediately after. Fixed within the same turn by killing the broken
process and restarting `next dev` on port 3000 cleanly (confirmed `200` on
`/` and `/login` afterward, and `/dashboard` served fine on the next
request). No files belonging to that other agent's in-progress work
(`src/app/dashboard/page.tsx`, `src/lib/leave/review.ts`,
`src/app/dashboard/notifications-*.tsx`,
`supabase/migrations/0006_notifications_insert_reviewer.sql`, or
`qa-evidence/hr-14-notifications/`) were touched or committed by this pass.
